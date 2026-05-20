import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { CryptoService } from '../crypto/crypto.service';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';

@Injectable()
export class As2OutboundService {
  private readonly logger = new Logger(As2OutboundService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Orchestrates the outbound streaming pipeline:
   * Read Raw -> Compress -> Sign -> Encrypt -> HTTP POST
   */
  async sendPayload(
    filename: string,
    senderAs2Id: string,
    receiverAs2Id: string,
    targetUrl: string,
    certificatePem: string,
    privateKeyPem: string,
    receiverCertPem: string
  ): Promise<void> {
    const messageId = `<${uuidv4()}@${senderAs2Id}>`;
    this.logger.log(`Starting Outbound Transmission for ${messageId} to ${targetUrl}`);

    const readStream = this.storageService.createReadStream(filename);
    const passThroughToHttp = new PassThrough();

    // Setup HTTP Request
    const parsedUrl = new URL(targetUrl);
    const options = {
      method: 'POST',
      headers: {
        'AS2-From': senderAs2Id,
        'AS2-To': receiverAs2Id,
        'AS2-Version': '1.2',
        'Message-ID': messageId,
        'Content-Type': 'application/pkcs7-mime; smime-type=enveloped-data; name="smime.p7m"',
        'Disposition-Notification-To': `http://our-gateway.com/as2/receive-mdn`,
        'Receipt-Delivery-Option': `http://our-gateway.com/as2/receive-mdn`
      }
    };

    const reqModule = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = reqModule.request(parsedUrl, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          this.logger.log(`Outbound HTTP Status: ${res.statusCode}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP request failed with status ${res.statusCode}`));
          }
        });
      });

      req.on('error', (e) => reject(e));

      // Build the Crypto Pipeline
      this.buildCryptoPipeline(
        readStream,
        passThroughToHttp,
        privateKeyPem,
        certificatePem,
        receiverCertPem
      ).catch(reject);

      // Pipe the final output to the HTTP request
      passThroughToHttp.pipe(req);
    });
  }

  private async buildCryptoPipeline(
    readStream: NodeJS.ReadableStream,
    writeStream: NodeJS.WritableStream,
    privateKeyPem: string,
    certificatePem: string,
    receiverCertPem: string
  ) {
    try {
      const compressStream = this.cryptoService.createCompressStream();
      const signStream = await this.cryptoService.createSignStream(privateKeyPem, certificatePem);
      const encryptStream = await this.cryptoService.createEncryptStream(receiverCertPem);

      // $O(1)$ memory pipeline
      await pipeline(
        readStream,
        compressStream,
        signStream,
        encryptStream,
        writeStream
      );
      this.logger.log('Outbound Crypto Pipeline completed. Data piped to HTTP.');
    } catch (err) {
      this.logger.error('Outbound Pipeline Error', err);
      throw err;
    }
  }
}
