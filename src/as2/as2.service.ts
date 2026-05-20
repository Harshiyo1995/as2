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

    // ─── CRITICAL FIX: SANITIZE FILENAME FOR WINDOWS COMPATIBILITY ───────────
    const safeMessageId = messageId.replace(/[<>:"/\\|?*]/g, '_');

    const rawFilename = `${safeMessageId}.raw.enc`;
    const decryptedFilename = `${safeMessageId}.decrypted.xml`;
    // ───────────────────────────────────────────────────────────────────────────

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
    try {
      const systemCert = await this.partnerService.getSystemPrivateCertificate();
      systemPrivateKeyPem = systemCert.private_key_pem || systemCert.pem_data;
      systemCertPem = systemCert.pem_data;
    } catch (e) {
      this.logger.error(`Missing system private keys. Decryption aborted.`);
      await this.transactionService.updateStatus(messageId, TransactionStatus.FAILED, 'Missing credentials');
      throw new Error('System credentials missing for inline decryption processing');
    }

    const decryptStream = await this.cryptoService.createDecryptStream(systemPrivateKeyPem, systemCertPem);
    const decryptedWriteStream = this.storageService.createWriteStream(decryptedFilename);
    const hashStream = crypto.createHash('sha256');

    let computedMic = '';

    try {
      await pipeline(
        cryptoFork,
        decryptStream,
        async function* (source) {
          for await (const chunk of source) {
            hashStream.update(chunk);
            yield chunk;
          }
        },
        decryptedWriteStream
      );

      const micDigest = hashStream.digest('base64');
      computedMic = `${micDigest}, sha256`;
      this.logger.log(`Decryption complete. Generated Plaintext MIC: ${computedMic}`);

      await this.transactionService.updateStatus(messageId, TransactionStatus.COMPLETED);

      const absoluteDecryptedPath = `${this.storageService['storageBasePath']}/${decryptedFilename}`;

      // ─── RESTORED: PRIMARY BUSINESS VALUE OVERWRITE HOOK ──────────────────
      // Reads the XML content to capture the core business tracking number 
      // and swaps it with the transport-level header key wrapper.
      await this.fdaParserService.processInboundBasePayload(absoluteDecryptedPath, messageId).catch(err => {
        this.logger.error(`Primary safety document business ID re-keying failed`, err);
      });
      // ───────────────────────────────────────────────────────────────────────

      this.fdaParserService.processAck(absoluteDecryptedPath, messageId).catch(err => {
        this.logger.error(`FDA Acknowledgement extraction pass failed`, err);
      });

    } catch (pipelineError) {
      this.logger.error(`Decryption processing pipeline failure`, pipelineError);
      await this.transactionService.updateStatus(messageId, TransactionStatus.FAILED, pipelineError.message);
      throw pipelineError;
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

        // Dynamic lookup queries the active row state to handle mid-flight ID shifts smoothly
        try {
          const transactionRepository = this.transactionService['transactionRepository'];
          const activeRecord = await transactionRepository.findOne({ where: { raw_file_path: rawFilename } });
          const activeMessageId = activeRecord ? activeRecord.message_id : messageId;

          // Updates your operational status column using the correct database key context
          await this.transactionService.updateMdnStatus(activeMessageId, MdnStatus.PROCESSED);

          // Saves the remaining compliance evidence metrics fields alongside it
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