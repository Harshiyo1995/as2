import { Controller, Post, Get, Req, Res, Headers, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { Request, Response } from 'express';
import { As2Service } from './as2.service';
import { TradingPartnerService } from '../database/trading-partner.service';
import { TransactionService } from '../database/transaction.service';
import { Readable } from 'stream';

@Controller('as2')
export class As2Controller {
  private readonly logger = new Logger(As2Controller.name);

  // An in-memory array to temporarily hold async MDN records for browser diagnostic review
  private static mdnLogRegistry: Array<{
    timestamp: string;
    originalMessageId: string;
    headers: any;
    rawMdnBody: string;
  }> = [];

  constructor(
    private readonly as2Service: As2Service,
    private readonly partnerService: TradingPartnerService,
    private readonly transactionService: TransactionService
  ) { }

  @Post('receive')
  async receiveAs2Payload(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: any
  ) {
    try {
      // Validate core AS2 identification headers
      if (!headers['as2-from'] || !headers['as2-to'] || !headers['message-id']) {
        this.logger.warn('⚠️ Received request missing AS2-From, AS2-To, or Message-ID headers');
        return res.status(HttpStatus.BAD_REQUEST).send('Missing mandatory AS2 headers: AS2-From, AS2-To, or Message-ID');
      }

      const messageId = headers['message-id'];

      const as2ToHeader = headers['as2-to'];
      const as2FromHeader = headers['as2-from'];

      this.logger.log(`📥 Inbound AS2 connection handshake initialized [${as2FromHeader} ──► ${as2ToHeader}]`);

      // DYNAMIC B2B ROUTING GUARD: Enforce explicit partner identity matching for receiver
      const receiverCert = await this.partnerService.getSystemCertificateByAs2Id(as2ToHeader);
      if (!receiverCert) {
        this.logger.error(`❌ B2B Routing Reject: Unknown or unauthorized receiver AS2-To ID: '${as2ToHeader}'`);
        return res.status(HttpStatus.BAD_REQUEST).send(`AS2 transmission routing failure: Unknown or mismatched recipient identifier '${as2ToHeader}'.`);
      }

      // DYNAMIC B2B ROUTING GUARD: Enforce explicit partner identity matching for sender
      try {
        await this.partnerService.getPartnerWithCertificate(as2FromHeader);
      } catch (err) {
        this.logger.error(`❌ B2B Routing Reject: Unknown sender AS2-From ID: '${as2FromHeader}'`);
        return res.status(HttpStatus.BAD_REQUEST).send(`AS2 transmission routing failure: Unknown sender identifier '${as2FromHeader}'.`);
      }

      this.logger.log(`✅ B2B Routing Match: Identities verified. Receiver [${as2ToHeader}] and Sender [${as2FromHeader}] match gateway profile.`);
      this.logger.log(`🔄 Proceeding to cryptographic handshake and conversion pipeline...`);

      // Collect data directly from the network socket buffer array to prevent empty chunks
      const buffers: Buffer[] = [];

      req.on('data', (chunk: Buffer) => {
        buffers.push(chunk);
      });

      await new Promise<void>((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });

      const fullRawBodyBuffer = Buffer.concat(buffers);

      if (fullRawBodyBuffer.length === 0) {
        this.logger.error('❌ Inbound network payload stream contains 0 bytes.');
        return res.status(HttpStatus.BAD_REQUEST).send('Empty AS2 payload received');
      }

      // IDEMPOTENCY: Duplicate Message-ID detection
      const existingTx = await this.transactionService.findByMessageId(messageId);
      if (existingTx && existingTx.status === 'COMPLETED' && existingTx.raw_mdn_content) {
         this.logger.warn(`⚠️ Duplicate Payload Detected for Message-ID: ${messageId}. Re-transmitting original MDN.`);
         
         // Extract the boundary from the raw MDN content to construct the proper Content-Type
         const boundaryMatch = existingTx.raw_mdn_content.match(/----=_Part_[^\n\r]+/);
         const boundary = boundaryMatch ? boundaryMatch[0].trim().replace('--', '') : `----=_Part_${Date.now()}`;
         
         res.setHeader('Content-Type', `multipart/report; report-type=disposition-notification; boundary="${boundary}"`);
         return res.status(HttpStatus.OK).send(existingTx.raw_mdn_content);
      }

      this.logger.log(`📦 Payload buffering complete: ${fullRawBodyBuffer.length} bytes cleanly extracted from socket.`);

      // ASYNC MDN: Immediate socket release for background processing
      if (headers['receipt-delivery-option']) {
        this.logger.log(`🚀 Async MDN requested. Returning HTTP 200 early to free socket.`);
        res.status(HttpStatus.OK).send();
        
        // Detach execution to the background
        const processedStream = Readable.from(fullRawBodyBuffer);
        this.as2Service.processInboundStream(processedStream, headers).catch(err => {
          this.logger.error(`Background AS2 Processing Failed for Async delivery`, err.stack);
        });
        return;
      }

      // SYNC MDN: Wait for processing inline
      const processedStream = Readable.from(fullRawBodyBuffer);
      const { syncMdn } = await this.as2Service.processInboundStream(processedStream, headers);

      this.logger.log(`🎉 Transaction completed successfully. Cryptographic key pairs verified, envelope detached, and ledger records updated.`);

      // Handle synchronous MDN routing requirements
      if (syncMdn) {
        this.logger.log(`📤 Dispatching synchronous MDN transmission confirmation back to trading partner.`);
        for (const [key, value] of Object.entries(syncMdn.headers)) {
          res.setHeader(key, value as string);
        }
        return res.status(HttpStatus.OK).send(syncMdn.body);
      }

      // Return connection validation confirmation if async operations are deferred
      return res.status(HttpStatus.OK).send();

    } catch (error) {
      this.logger.error('💥 Fatal error processing explicit AS2 incoming route request', error.stack);
      if (!res.headersSent) {
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal Server Error');
      }
    }
  }

  /**
   * INBOUND ASYNC MDN WEBHOOK LISTENER (POST)
   * Captures, processes, and stores incoming out-of-band asynchronous transaction receipts.
   */
  @Post('mdn')
  async receiveAsyncMdn(
    @Req() req: Request,
    @Res() res: Response,
    @Headers() headers: any
  ) {
    const messageId = headers['original-message-id'] || headers['message-id'] || 'unknown';
    this.logger.log(`[MDN Webhook] Received Inbound Async MDN for original Message-ID: ${messageId}`);

    let bodyData = '';

    req.on('data', (chunk) => {
      bodyData += chunk.toString('binary');
    });

    req.on('end', () => {
      this.logger.debug(`[MDN Webhook] Raw MDN Receipt Body Length: ${bodyData.length} bytes`);

      // Save the structured incoming payload properties into our cache
      As2Controller.mdnLogRegistry.unshift({
        timestamp: new Date().toLocaleString(),
        originalMessageId: messageId,
        headers: headers,
        rawMdnBody: bodyData,
      });

      // Keep the history array capped to the last 50 entries to safeguard system memory resources
      if (As2Controller.mdnLogRegistry.length > 50) {
        As2Controller.mdnLogRegistry.pop();
      }

      if (bodyData.includes('disposition-type=processed') || bodyData.includes('processed/error')) {
        this.logger.log(`[MDN Webhook] Receipt parsed. MDN processing disposition match confirmed.`);
      }

      return res.status(HttpStatus.OK).send('MDN Received and Logged Successfully');
    });
  }

  /**
   * DIAGNOSTIC MDN LOG EXPLORER (GET)
   * Exposes a safe browser-friendly path to audit the stored data structures.
   */
  @Get('mdn')
  viewMdnLogs(@Res() res: Response) {
    this.logger.log(`[Diagnostic] Serving historical async MDN logs. Count: ${As2Controller.mdnLogRegistry.length}`);

    return res.status(HttpStatus.OK).json({
      success: true,
      totalLogsCaptured: As2Controller.mdnLogRegistry.length,
      logs: As2Controller.mdnLogRegistry,
    });
  }

  /**
   * NEW: GET /as2/transactions/nrr
   * Fetches Non-Repudiation evidence criteria logs for the UI compliance viewer
   */
  @Get('transactions/nrr')
  async getTransactionNrrEvidence(@Req() req: Request, @Res() res: Response) {
    // Read targeted message token cleanly out of query headers safely
    const messageId = req.query.messageId as string;
    this.logger.log(`[Diagnostic] Querying NRR Evidence profile parameters for key: ${messageId}`);

    try {
      const transactionRepository = this.as2Service['transactionService']['transactionRepository'];
      const record = await transactionRepository.findOne({ where: { message_id: messageId } });

      if (!record) {
        return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Transaction tracking index entry not found.' });
      }

      return res.status(HttpStatus.OK).json({
        success: true,
        messageId: record.message_id,
        sender: record.sender_as2_id,
        receiver: record.receiver_as2_id,
        mic: record.mic_checksum || 'Pending compilation / Not Required',
        timestamp: record.nrr_validated_at || record.created_at,
        rawMdn: record.raw_mdn_content || 'No MDN payload linked to this transmission record.'
      });
    } catch (err) {
      this.logger.error(`Failed to compile audit NRR evidence package`, err);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal Server Processing Error');
    }
  }
}