import { Injectable, Logger } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { CryptoService } from '../crypto/crypto.service';
import { MdnService } from '../mdn/mdn.service';
import { FdaParserService } from '../fda/fda-parser.service';
import { TransactionService } from '../database/transaction.service';
import { TradingPartnerService } from '../database/trading-partner.service';
import { Direction, TransactionStatus, MdnStatus } from '../database/entities/transaction.entity';
import * as crypto from 'crypto';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';

@Injectable()
export class As2Service {
  private readonly logger = new Logger(As2Service.name);

  constructor(
    private readonly storageService: StorageService,
    private readonly cryptoService: CryptoService,
    private readonly mdnService: MdnService,
    private readonly fdaParserService: FdaParserService,
    private readonly transactionService: TransactionService,
    private readonly partnerService: TradingPartnerService,
  ) { }

  async processInboundStream(inputStream: Readable, headers: any): Promise<{ syncMdn?: any }> {
    const messageId = headers['message-id'] || `auto-${Date.now()}`;
    const as2From = headers['as2-from'];
    const as2To = headers['as2-to'];
    const dispositionNotificationTo = headers['disposition-notification-to'];
    const receiptDeliveryOption = headers['receipt-delivery-option'];

    this.logger.log(`Processing conversion pipeline for message: ${messageId} (${as2From} -> ${as2To})`);

    const safeMessageId = messageId.replace(/[<>:"/\\|?*]/g, '_');
    const rawFilename = `${safeMessageId}.raw.enc`;
    const decryptedFilename = `${safeMessageId}.decrypted.xml`;

    await this.transactionService.createTransaction({
      message_id: messageId,
      direction: Direction.INBOUND,
      sender_as2_id: as2From,
      receiver_as2_id: as2To,
      subject: headers['subject'] || '',
      raw_file_path: rawFilename,
    });

    const diskFork = new PassThrough();
    const cryptoFork = new PassThrough();
    inputStream.pipe(diskFork);
    inputStream.pipe(cryptoFork);

    const rawWriteStream = this.storageService.createWriteStream(rawFilename);
    const saveRawPromise = pipeline(diskFork, rawWriteStream).catch(err => {
      this.logger.error(`Failed to save raw encrypted payload to disk`, err);
    });

    let systemPrivateKeyPem: string;
    let systemCertPem: string;
    let senderCertPem: string;
    try {
      const systemCert = await this.partnerService.getSystemCertificateByAs2Id(as2To);
      if (!systemCert) {
        throw new Error(`Missing system private key for receiver ${as2To}`);
      }
      systemPrivateKeyPem = systemCert.private_key_pem || systemCert.pem_data;
      systemCertPem = systemCert.pem_data;
      this.cryptoService.checkCertificateExpiration(systemCertPem, as2To);

      const senderPartner = await this.partnerService.getPartnerWithCertificate(as2From);
      if (!senderPartner || !senderPartner.certificate) {
        throw new Error(`Missing public certificate for sender ${as2From}`);
      }
      senderCertPem = senderPartner.certificate.pem_data;
      this.cryptoService.checkCertificateExpiration(senderCertPem, as2From);

    } catch (e) {
      this.logger.error(`Missing or expired credentials. Decryption aborted. Error: ${e.message}`);
      await this.transactionService.updateStatus(messageId, TransactionStatus.FAILED, e.message);
      
      const disposition = 'automatic-action/MDN-sent-automatically; processed/error: decryption-failed';
      const negativeMdn = await this.mdnService.generateSyncMdn(messageId, as2From, as2To, 'unknown', disposition);
      await this.transactionService.updateMdnStatus(messageId, MdnStatus.PROCESSED);
      
      if (receiptDeliveryOption) {
        this.mdnService.dispatchAsyncMdn(receiptDeliveryOption, messageId, as2From, as2To, 'unknown', disposition).catch(err => this.logger.error('Failed to dispatch Async Negative MDN', err));
        return { syncMdn: undefined };
      }
      return { syncMdn: negativeMdn };
    }

    const decryptStream = await this.cryptoService.createDecryptStream(systemPrivateKeyPem, systemCertPem);
    const verifyStream = (await this.cryptoService.createVerifyStream()) as any; 
    const decryptedWriteStream = this.storageService.createWriteStream(decryptedFilename);
    
    let computedMic = '';

    try {
      // ─── THE PIPELINE FIX ───
      // We pass the stream through VerifyStream so it can strip the signature away,
      // allowing us to calculate the hash strictly on the pure XML bytes!
      await pipeline(
        cryptoFork,
        decryptStream,
        verifyStream, 
        decryptedWriteStream
      );

      // ─── THE FINAL MIC FIX ───
      const hashStream = crypto.createHash('sha256');
      if (verifyStream.micContent) {
         hashStream.update(verifyStream.micContent);
      } else {
         this.logger.warn("VerifyStream did not expose micContent.");
      }
      
      const micDigest = hashStream.digest('base64');
      computedMic = `${micDigest}, sha256`;
      this.logger.log(`Decryption complete. Generated Canonicalized MIC: ${computedMic}`);

      await this.transactionService.updateStatus(messageId, TransactionStatus.COMPLETED);

      const absoluteDecryptedPath = `${this.storageService['storageBasePath']}/${decryptedFilename}`;

      await this.fdaParserService.processInboundBasePayload(absoluteDecryptedPath, messageId).catch(err => {
        this.logger.error(`Primary safety document business ID re-keying failed`, err);
      });

      this.fdaParserService.processAck(absoluteDecryptedPath, messageId).catch(err => {
        this.logger.error(`FDA Acknowledgement extraction pass failed`, err);
      });

    } catch (pipelineError) {
      this.logger.error(`Cryptographic processing pipeline failure: ${pipelineError.message}`);
      await this.transactionService.updateStatus(messageId, TransactionStatus.FAILED, pipelineError.message);

      let disposition = 'processed/error: unknown';
      if (pipelineError.message.includes('integrity-check-failed')) {
        disposition = 'automatic-action/MDN-sent-automatically; processed/error: integrity-check-failed';
      } else {
        disposition = 'automatic-action/MDN-sent-automatically; processed/error: decryption-failed';
      }

      const negativeMdn = await this.mdnService.generateSyncMdn(messageId, as2From, as2To, computedMic || 'unknown', disposition);
      await this.transactionService.updateMdnStatus(messageId, MdnStatus.PROCESSED);
      
      const transactionRepository = this.transactionService['transactionRepository'];
      await transactionRepository.update(
        { message_id: messageId },
        {
          raw_mdn_content: negativeMdn.body,
          nrr_validated_at: new Date(),
          error_details: pipelineError.message
        }
      );

      await saveRawPromise;

      if (receiptDeliveryOption) {
        this.mdnService.dispatchAsyncMdn(receiptDeliveryOption, messageId, as2From, as2To, computedMic || 'unknown', disposition)
          .catch(err => this.logger.error('Failed to dispatch Async Negative MDN', err));
        return { syncMdn: undefined };
      } else {
        return { syncMdn: negativeMdn };
      }
    }

    await saveRawPromise;

    let syncMdnResponse = null;
    if (dispositionNotificationTo) {
      if (receiptDeliveryOption) {
        this.mdnService.dispatchAsyncMdn(
          receiptDeliveryOption,
          messageId,
          as2From,
          as2To,
          computedMic
        ).catch(err => this.logger.error('Failed to dispatch Async MDN outbox route', err));
        await this.transactionService.updateMdnStatus(messageId, MdnStatus.PENDING);
      } else {
        syncMdnResponse = await this.mdnService.generateSyncMdn(messageId, as2From, as2To, computedMic);

        try {
          const transactionRepository = this.transactionService['transactionRepository'];
          const activeRecord = await transactionRepository.findOne({ where: { raw_file_path: rawFilename } });
          const activeMessageId = activeRecord ? activeRecord.message_id : messageId;

          await this.transactionService.updateMdnStatus(activeMessageId, MdnStatus.PROCESSED);

          await transactionRepository.createQueryBuilder()
            .update()
            .set({
              mic_checksum: computedMic,
              raw_mdn_content: syncMdnResponse.body,
              nrr_validated_at: new Date()
            })
            .where("raw_file_path = :path", { path: rawFilename })
            .execute();

          this.logger.log(`🔒 Transaction ledger columns and MDN status synchronized perfectly.`);
        } catch (nrrErr) {
          this.logger.error(`Failed to execute non-repudiation tracking status hooks`, nrrErr);
        }
      }
    } else {
      await this.transactionService.updateMdnStatus(messageId, MdnStatus.NOT_REQUIRED);
    }

    return { syncMdn: syncMdnResponse };
  }
}