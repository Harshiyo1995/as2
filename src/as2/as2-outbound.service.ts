import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { CryptoService } from '../crypto/crypto.service';
import { TradingPartnerService } from '../database/trading-partner.service';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import { PassThrough } from 'stream';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import * as crypto from 'crypto';

@Injectable()
export class As2OutboundService {
  private readonly logger = new Logger(As2OutboundService.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly cryptoService: CryptoService,
    private readonly partnerService: TradingPartnerService 
  ) {}

  async sendPayload(filename: string, senderAs2Id: string, receiverAs2Id: string): Promise<void> {
    const messageId = `<${uuidv4()}@${senderAs2Id.toLowerCase()}>`;
    this.logger.log(`Starting Outbound Transmission for ${messageId} (${senderAs2Id} -> ${receiverAs2Id})`);

    const senderStation = await this.partnerService.getSystemCertificateByAs2Id(senderAs2Id);
    const receiverPartner = await this.partnerService.getPartnerWithCertificate(receiverAs2Id);

    if (!senderStation || !senderStation.private_key_pem) throw new BadRequestException(`Sender Station ${senderAs2Id} is missing a private key.`);
    if (!receiverPartner) throw new BadRequestException(`Receiver Partner ${receiverAs2Id} profile is missing.`);
    if (!receiverPartner.url) throw new BadRequestException(`Receiver Partner ${receiverAs2Id} is missing a destination URL.`);

    const certRepository = this.partnerService['certRepository'];
    const explicitCert = await certRepository.findOne({
      where: [
        { alias: `${receiverAs2Id}_public_cert` },
        { alias: `${receiverAs2Id}-public-cert` },
        { alias: 'connectionvault1021_public_cert' }
      ]
    });

    if (!explicitCert || !explicitCert.pem_data) {
      throw new BadRequestException(`Unable to resolve a valid public encryption certificate for target recipient ID: ${receiverAs2Id}`);
    }
    
    const encryptionCertPem = explicitCert.pem_data;

    const parsedUrl = new URL(receiverPartner.url);
    const headers: any = {
      'AS2-From': senderAs2Id,
      'AS2-To': receiverAs2Id,
      'Message-ID': messageId,
      'Subject': 'Outbound B2B Transmission',
      'Date': new Date().toUTCString(),
      'AS2-Version': '1.2',
    };

    if (receiverPartner.request_mdn) {
      const localMdnCallback = process.env.LOCAL_MDN_URL || 'http://localhost:8080/as2/mdn';
      headers['Disposition-Notification-To'] = localMdnCallback;
      if (receiverPartner.mdn_delivery_mode === 'ASYNC' && receiverPartner.mdn_url) {
        headers['Receipt-Delivery-Option'] = receiverPartner.mdn_url;
      }
    }

    const micalg = receiverPartner.signature_algorithm === 'SHA-1' ? 'sha1' : 'sha-256';
    const boundary = `----=_Part_${crypto.randomBytes(16).toString('hex')}`;

    if (receiverPartner.encrypt_outbound) {
        headers['Content-Type'] = 'application/pkcs7-mime; smime-type=enveloped-data; name="smime.p7m"';
        headers['Content-Transfer-Encoding'] = 'binary';
        headers['Content-Disposition'] = 'attachment; filename="smime.p7m"';
    } else if (receiverPartner.sign_outbound) {
        headers['Content-Type'] = `multipart/signed; protocol="application/pkcs7-signature"; micalg="${micalg}"; boundary="${boundary}"`;
    } else {
        headers['Content-Type'] = 'application/xml';
    }

    const options = {
      method: 'POST',
      headers: headers,
      timeout: (receiverPartner.connection_timeout || 60) * 1000,
    };

    const reqModule = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise(async (resolve, reject) => {
      const req = reqModule.request(parsedUrl, options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          this.logger.log(`Outbound HTTP Status: ${res.statusCode} from ${receiverPartner.url}`);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`HTTP request failed with status ${res.statusCode}: ${responseData}`));
          }
        });
      });

      req.on('error', (e) => reject(e));

      try {
        const readStream = this.storageService.createReadStream(filename);
        const passThroughToHttp = new PassThrough();
        const transforms: any[] = [readStream];

        if (receiverPartner.sign_outbound) {
          this.logger.log(`Applying Signature: ${receiverPartner.signature_algorithm}`);
          // If encrypting, the MIME header needs to be added by the stream itself
          const prependMime = receiverPartner.encrypt_outbound ? true : false;
          transforms.push(await this.cryptoService.createSignStream(
            senderStation.private_key_pem, 
            senderStation.pem_data, 
            receiverPartner.signature_algorithm,
            boundary,
            prependMime
          ));
        }

        if (receiverPartner.encrypt_outbound) {
          this.logger.log(`Applying Encryption: ${receiverPartner.encryption_algorithm}`);
          transforms.push(await this.cryptoService.createEncryptStream(
             encryptionCertPem, 
             receiverPartner.encryption_algorithm,
             receiverPartner.sign_outbound
          ));
        }

        transforms.push(passThroughToHttp);

        pipeline(transforms as any).catch(err => {
          this.logger.error('Streaming pipeline failed', err);
          req.destroy(err);
        });

        passThroughToHttp.pipe(req);

      } catch (err) {
        this.logger.error('Failed to initialize outbound pipeline', err);
        req.destroy(err);
        reject(err);
      }
    });
  }
}