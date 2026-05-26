import { Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';
import * as crypto from 'crypto';

@Injectable()
export class MdnService {
  private readonly logger = new Logger(MdnService.name);

  constructor(private readonly cryptoService: CryptoService) { }

  async generateSyncMdn(
    messageId: string,
    senderAs2Id: string,
    receiverAs2Id: string,
    mic: string,
    disposition: string = 'processed'
  ): Promise<{ headers: Record<string, string>, body: string }> {

    this.logger.log(`Generating Signed Sync MDN for Message-ID: ${messageId}`);

    const innerBoundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const outerBoundary = `----=_Part_${crypto.randomBytes(16).toString('hex')}`;
    const mdnMessageId = `<MDN-${Date.now()}@${receiverAs2Id}>`;

    const body = 
      `Content-Type: multipart/report; report-type=disposition-notification; boundary="${innerBoundary}"\r\n\r\n` +
      `--${innerBoundary}\r\n` +
      `Content-Type: text/plain; charset=utf-8\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `The AS2 message has been received successfully.\r\n\r\n` +
      `--${innerBoundary}\r\n` +
      `Content-Type: message/disposition-notification\r\n` +
      `Content-Transfer-Encoding: 7bit\r\n\r\n` +
      `Reporting-UA: AS2-Enterprise-Gateway\r\n` +
      `Original-Recipient: rfc822; ${receiverAs2Id}\r\n` +
      `Final-Recipient: rfc822; ${receiverAs2Id}\r\n` +
      `Original-Message-ID: ${messageId}\r\n` +
      `Disposition: automatic-action/MDN-sent-automatically; ${disposition}\r\n` +
      `Received-Content-MIC: ${mic}\r\n\r\n` +
      `--${innerBoundary}--\r\n`;

    const signedBody = await this.cryptoService.signMdn(body, receiverAs2Id, outerBoundary);

    const headers = {
      'AS2-From': receiverAs2Id,
      'AS2-To': senderAs2Id,
      'AS2-Version': '1.2',
      'Message-ID': mdnMessageId,
      'Content-Type': `multipart/signed; protocol="application/pkcs7-signature"; micalg="sha-256"; boundary="${outerBoundary}"`,
    };

    return { headers, body: signedBody };
  }

  async dispatchAsyncMdn(
    url: string,
    messageId: string,
    senderAs2Id: string,
    receiverAs2Id: string,
    mic: string,
    disposition: string = 'processed'
  ): Promise<void> {
    this.logger.log(`Dispatching Async MDN to ${url} for Message-ID: ${messageId}`);
    try {
      const mdn = await this.generateSyncMdn(messageId, senderAs2Id, receiverAs2Id, mic, disposition);
      const response = await fetch(url, {
        method: 'POST',
        headers: mdn.headers,
        body: mdn.body,
      });
      this.logger.log(`Async MDN delivery handshake acknowledged by remote endpoint. HTTP Status: ${response.status}`);
    } catch (err) {
      this.logger.error(`Failed to deliver Async MDN network packet to ${url}`, err.stack);
    }
  }
}