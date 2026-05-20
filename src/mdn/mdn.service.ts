import { Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../crypto/crypto.service';

@Injectable()
export class MdnService {
  private readonly logger = new Logger(MdnService.name);

  constructor(private readonly cryptoService: CryptoService) { }

  /**
   * Generates a synchronous MDN multipart/report response
   */
  async generateSyncMdn(
    messageId: string,
    senderAs2Id: string,
    receiverAs2Id: string,
    mic: string,
    disposition: string = 'processed'
  ): Promise<{ headers: Record<string, string>, body: string }> {

    this.logger.log(`Generating Sync MDN for Message-ID: ${messageId}`);

    const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const mdnMessageId = `<MDN-${Date.now()}@${receiverAs2Id}>`;

    const body = `
--${boundary}
Content-Type: text/plain; charset=utf-8
Content-Transfer-Encoding: 7bit

The AS2 message has been received successfully.

--${boundary}
Content-Type: message/disposition-notification
Content-Transfer-Encoding: 7bit

Reporting-UA: AS2-Enterprise-Gateway
Original-Recipient: rfc822; ${receiverAs2Id}
Final-Recipient: rfc822; ${receiverAs2Id}
Original-Message-ID: ${messageId}
Disposition: automatic-action/MDN-sent-automatically; ${disposition}
Received-Content-MIC: ${mic}

--${boundary}--
    `.trim();

    // In a full implementation, you would sign this body using CryptoService here
    // const signedBody = await this.cryptoService.signMdn(body, receiverAs2Id);

    const headers = {
      'AS2-From': receiverAs2Id,
      'AS2-To': senderAs2Id,
      'AS2-Version': '1.2',
      'Message-ID': mdnMessageId,
      'Content-Type': `multipart/report; report-type=disposition-notification; boundary="${boundary}"`,
      // Add Date, Server, etc.
    };

    return { headers, body };
  }

  /**
   * Dispatches an asynchronous MDN to an external URL.
   * Executes a live HTTP POST network sequence to the requested callback URL.
   */
  async dispatchAsyncMdn(
    url: string,
    messageId: string,
    senderAs2Id: string,
    receiverAs2Id: string,
    mic: string
  ): Promise<void> {
    this.logger.log(`Dispatching Async MDN to ${url} for Message-ID: ${messageId}`);

    try {
      // 1. Generate a fully compliant AS2 multipart structure using your unchanged synchronous generator
      const mdn = await this.generateSyncMdn(messageId, senderAs2Id, receiverAs2Id, mic);

      // 2. Fire a live HTTP POST network payload to deliver the receipt to the target URL callback
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