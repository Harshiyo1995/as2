import { Controller, Post, Get, Put, Req, Res, Headers, HttpStatus, Logger, NotFoundException, Body, Param, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { As2Service } from './as2.service';
import { TradingPartnerService } from '../database/trading-partner.service';
import { TransactionService } from '../database/transaction.service';
import { As2OutboundService } from './as2-outbound.service';
import { Readable } from 'stream';

@Controller('as2')
export class As2Controller {
  private readonly logger = new Logger(As2Controller.name);

  private static mdnLogRegistry: Array<{
    timestamp: string;
    originalMessageId: string;
    headers: any;
    rawMdnBody: string;
  }> = [];

  constructor(
    private readonly as2Service: As2Service,
    private readonly partnerService: TradingPartnerService,
    private readonly transactionService: TransactionService,
    private readonly as2OutboundService: As2OutboundService
  ) { }


  /**
   * CREATE NEW PARTNER (POST)
   */
  @Post('partners')
  async createPartnerConfiguration(@Req() req: Request) {
    this.logger.log(`Received request to create a new trading partner.`);
    try {
      const body = req.body;
      const partnerRepository = this.partnerService['partnerRepository'];

      // Clean payload
      const cleanPayload = { ...body };
      delete cleanPayload.isNew; // Remove the UI flag

      // Create and save the new record to the database
      const newPartner = partnerRepository.create(cleanPayload);
      const savedPartner = await partnerRepository.save(newPartner);

      return { 
        success: true, 
        message: 'New trading partner created successfully.', 
        data: savedPartner 
      };
    } catch (error) {
      this.logger.error(`Failed to create trading partner: ${error.message}`);
      throw new BadRequestException(`Creation failed: ${error.message}`);
    }
  }
  /**
   * DYNAMIC PARTNER CONFIGURATION UPDATE (PUT)
   * Completely bypasses NestJS/TypeORM caching using Raw SQL to guarantee all fields are saved.
   */
  @Put('partners/:id')
  async updatePartnerConfiguration(
    @Param('id') id: string,
    @Req() req: Request
  ) {
    this.logger.log(`Received configuration update request for partner ID/AS2ID: ${id}`);
    try {
      // 1. Grab raw payload to avoid NestJS ValidationPipe stripping unknown fields
      const body = req.body;
      const partnerRepository = this.partnerService['partnerRepository'];

      // 2. Locate the partner
      let partner = await partnerRepository.findOne({ where: { id: id } });
      if (!partner) {
        partner = await partnerRepository.findOne({ where: { as2_id: id } });
      }

      if (!partner) {
        throw new NotFoundException(`Trading partner profile with ID or AS2 ID '${id}' could not be located.`);
      }

      // 3. Clean payload & system fields
      const cleanPayload = { ...body };
      delete cleanPayload.tls_protocols; // Handled as string
      delete cleanPayload.certificate;
      delete cleanPayload.id;
      delete cleanPayload.created_at;
      delete cleanPayload.updated_at;

      // 4. Build Parameterized Raw SQL Query
      const keys = Object.keys(cleanPayload);
      const values = [];
      const setStrings = [];
      let index = 1;

      for (const key of keys) {
        let val = cleanPayload[key];
        
        // Convert empty strings to null for PostgreSQL compatibility
        if (val === "") val = null;

        setStrings.push(`"${key}" = $${index}`);
        values.push(val);
        index++;
      }

      values.push(partner.id);
      const rawSql = `UPDATE trading_partners SET ${setStrings.join(', ')} WHERE id = $${index}`;

      this.logger.log(`Executing raw SQL update to bypass cache for: ${partner.as2_id}`);
      
      // 5. Fire Raw SQL directly
      await partnerRepository.query(rawSql, values);

      // 6. Return the updated record exactly as the React frontend expects it
      const updatedPartner = await partnerRepository.findOne({
          where: { id: partner.id },
          relations: ['certificate']
      });

      return { 
        success: true, 
        message: 'Trading partner configuration updated dynamically.', 
        data: updatedPartner 
      };

    } catch (error) {
      this.logger.error(`Failed to update trading partner configuration: ${error.message}`);
      throw new BadRequestException(`Database sync failed: ${error.message}`);
    }
  }

  /**
   * FETCH TRANSACTION HISTORY FOR A PARTNER
   */
  @Get('transactions/:as2_id')
  async getPartnerTransactions(@Param('as2_id') as2Id: string, @Req() req: Request) {
    try {
      const transactionRepository = this.as2Service['transactionService']['transactionRepository'];
      
      // Fetch all transactions where this partner is either the sender or receiver
      // Ordered by newest first
      const transactions = await transactionRepository.find({
        where: [
          { sender_as2_id: as2Id },
          { receiver_as2_id: as2Id }
        ],
        order: { created_at: 'DESC' },
        take: 50 // Limit to last 50 for performance
      });

      return { success: true, data: transactions };
    } catch (error) {
      this.logger.error(`Failed to fetch transactions for ${as2Id}: ${error.message}`);
      throw new BadRequestException('Failed to load transaction history');
    }
  }

  /**
   * OUTBOUND DISPATCH UI TRIGGER (POST)
   */
  @Post('send')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './data_storage',
      filename: (req, file, cb) => {
        // ─── THE OUTBOUND FIX: PRESERVE EXACT ORIGINAL FILENAME ───
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        cb(null, safeName);
      }
    })
  }))
  async sendOutboundPayload(
    @UploadedFile() file: Express.Multer.File,
    @Body('senderId') senderId: string,
    @Body('receiverId') receiverId: string
  ) {
    if (!file) throw new BadRequestException('An XML payload file is required.');
    if (!senderId || !receiverId) throw new BadRequestException('Sender and Receiver AS2 IDs are required.');

    this.logger.log(`Received UI dispatch request. File: ${file.filename}, Route: ${senderId} -> ${receiverId}`);

    try {
      const result = await this.as2OutboundService.sendPayload(file.filename, senderId, receiverId);
      return { success: true, message: 'Payload dispatched successfully', data: result };
    } catch (error) {
      this.logger.error(`Outbound dispatch failed: ${error.message}`);
      throw new BadRequestException(`Dispatch failed: ${error.message}`);
    }
  }

  @Post('receive')
  async receiveAs2Payload(@Req() req: Request, @Res() res: Response, @Headers() headers: any) {
    try {
      if (!headers['as2-from'] || !headers['as2-to'] || !headers['message-id']) {
        this.logger.warn('⚠️ Received request missing AS2-From, AS2-To, or Message-ID headers');
        return res.status(HttpStatus.BAD_REQUEST).send('Missing mandatory AS2 headers');
      }

      const messageId = headers['message-id'];
      const as2ToHeader = headers['as2-to'];
      const as2FromHeader = headers['as2-from'];

      this.logger.log(`📥 Inbound AS2 connection handshake initialized [${as2FromHeader} ──► ${as2ToHeader}]`);

      const receiverCert = await this.partnerService.getSystemCertificateByAs2Id(as2ToHeader);
      if (!receiverCert) {
        this.logger.error(`❌ B2B Routing Reject: Unknown or unauthorized receiver AS2-To ID: '${as2ToHeader}'`);
        return res.status(HttpStatus.BAD_REQUEST).send(`AS2 transmission routing failure: Unknown recipient '${as2ToHeader}'.`);
      }

      try {
        await this.partnerService.getPartnerWithCertificate(as2FromHeader);
      } catch (err) {
        this.logger.error(`❌ B2B Routing Reject: Unknown sender AS2-From ID: '${as2FromHeader}'`);
        return res.status(HttpStatus.BAD_REQUEST).send(`AS2 transmission routing failure: Unknown sender '${as2FromHeader}'.`);
      }

      this.logger.log(`✅ B2B Routing Match: Identities verified. Proceeding to pipeline...`);

      const buffers: Buffer[] = [];
      req.on('data', (chunk: Buffer) => buffers.push(chunk));

      await new Promise<void>((resolve, reject) => {
        req.on('end', resolve);
        req.on('error', reject);
      });

      const fullRawBodyBuffer = Buffer.concat(buffers);
      if (fullRawBodyBuffer.length === 0) return res.status(HttpStatus.BAD_REQUEST).send('Empty AS2 payload received');

      const existingTx = await this.transactionService.findByMessageId(messageId);
      if (existingTx && existingTx.status === 'COMPLETED' && existingTx.raw_mdn_content) {
         this.logger.warn(`⚠️ Duplicate Payload Detected for Message-ID: ${messageId}. Re-transmitting MDN.`);
         const isSigned = existingTx.raw_mdn_content.includes('application/pkcs7-signature');
         const boundaryMatch = existingTx.raw_mdn_content.match(/----=_Part_[^\n\r]+/);
         const boundary = boundaryMatch ? boundaryMatch[0].trim().replace('--', '') : `----=_Part_${Date.now()}`;
         
         if (isSigned) {
             res.setHeader('Content-Type', `multipart/signed; protocol="application/pkcs7-signature"; micalg="sha-256"; boundary="${boundary}"`);
         } else {
             res.setHeader('Content-Type', `multipart/report; report-type=disposition-notification; boundary="${boundary}"`);
         }
         res.setHeader('AS2-From', as2ToHeader);
         res.setHeader('AS2-To', as2FromHeader);
         res.setHeader('AS2-Version', '1.2');
         res.setHeader('Message-ID', `<MDN-${Date.now()}@${as2ToHeader}>`);
         
         return res.status(HttpStatus.OK).send(existingTx.raw_mdn_content);
      }

      if (headers['receipt-delivery-option']) {
        res.status(HttpStatus.OK).send();
        const processedStream = Readable.from(fullRawBodyBuffer);
        this.as2Service.processInboundStream(processedStream, headers).catch(err => {
          this.logger.error(`Background AS2 Processing Failed for Async delivery`, err.stack);
        });
        return;
      }

      const processedStream = Readable.from(fullRawBodyBuffer);
      const { syncMdn } = await this.as2Service.processInboundStream(processedStream, headers);

      if (syncMdn) {
        this.logger.log(`📤 Dispatching synchronous MDN transmission confirmation back to trading partner.`);
        
        for (const [key, value] of Object.entries(syncMdn.headers)) {
          res.setHeader(key, value as string);
        }
        return res.status(HttpStatus.OK).send(Buffer.from(syncMdn.body, 'utf8'));
      }

      return res.status(HttpStatus.OK).send();
    } catch (error) {
      this.logger.error('💥 Fatal error processing explicit AS2 incoming route request', error.stack);
      if (!res.headersSent) return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal Server Error');
    }
  }

  @Post('mdn')
  async receiveAsyncMdn(@Req() req: Request, @Res() res: Response, @Headers() headers: any) {
    const messageId = headers['original-message-id'] || headers['message-id'] || 'unknown';
    let bodyData = '';
    req.on('data', (chunk) => bodyData += chunk.toString('binary'));
    req.on('end', () => {
      As2Controller.mdnLogRegistry.unshift({ timestamp: new Date().toLocaleString(), originalMessageId: messageId, headers: headers, rawMdnBody: bodyData });
      if (As2Controller.mdnLogRegistry.length > 50) As2Controller.mdnLogRegistry.pop();
      return res.status(HttpStatus.OK).send('MDN Received and Logged Successfully');
    });
  }

  @Get('mdn')
  viewMdnLogs(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({ success: true, totalLogsCaptured: As2Controller.mdnLogRegistry.length, logs: As2Controller.mdnLogRegistry });
  }

  @Get('transactions/nrr')
  async getTransactionNrrEvidence(@Req() req: Request, @Res() res: Response) {
    const messageId = req.query.messageId as string;
    try {
      const transactionRepository = this.as2Service['transactionService']['transactionRepository'];
      const record = await transactionRepository.findOne({ where: { message_id: messageId } });
      if (!record) return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: 'Transaction tracking index entry not found.' });
      return res.status(HttpStatus.OK).json({ success: true, messageId: record.message_id, sender: record.sender_as2_id, receiver: record.receiver_as2_id, mic: record.mic_checksum, timestamp: record.nrr_validated_at || record.created_at, rawMdn: record.raw_mdn_content });
    } catch (err) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal Server Processing Error');
    }
  }
}