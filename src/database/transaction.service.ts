import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionStatus, MdnStatus } from './entities/transaction.entity';

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) { }

  /**
   * Creates a new transaction record for an incoming or outgoing AS2 message.
   */
  async createTransaction(data: Partial<Transaction>): Promise<Transaction> {
    const tx = this.transactionRepository.create({
      ...data,
      status: TransactionStatus.PENDING,
    });
    return await this.transactionRepository.save(tx);
  }

  /**
   * Updates an existing transaction's status.
   */
  async updateStatus(messageId: string, status: TransactionStatus, errorDetails?: string): Promise<void> {
    await this.transactionRepository.update(
      { message_id: messageId },
      { status, error_details: errorDetails }
    );
  }

  /**
   * Updates FDA-specific acknowledgement details across correlated transaction rows.
   */
  async updateFdaAckDetails(ackMessageId: string, correlationId: string, fdaStatus: string): Promise<void> {
    this.logger.log(`Processing FDA ACK correlation lookup target: ${correlationId} via container: ${ackMessageId}`);

    await this.transactionRepository.update(
      { message_id: ackMessageId },
      {
        correlation_id: correlationId,
        fda_submission_status: `Container for ${correlationId}`,
        status: TransactionStatus.COMPLETED
      }
    );

    await this.transactionRepository.update(
      { message_id: correlationId },
      { fda_submission_status: fdaStatus }
    );

    this.logger.log(`Successfully cross-correlated FDA Status '${fdaStatus}' to original submission record row.`);
  }

  /**
   * Logs MDN status.
   */
  async updateMdnStatus(messageId: string, mdnStatus: MdnStatus, mdnMessageId?: string): Promise<void> {
    await this.transactionRepository.update(
      { message_id: messageId },
      { mdn_status: mdnStatus, mdn_message_id: mdnMessageId }
    );
  }

  /**
   * Removes a single unique transaction record from the datastore by its database UUID.
   */
  async deleteTransaction(id: string): Promise<void> {
    this.logger.log(`Executing targeted hard deletion for Transaction ID: ${id}`);
    await this.transactionRepository.delete(id);
  }

  /**
   * Removes multiple transaction records simultaneously using an array of target database UUIDs.
   */
  async bulkDeleteTransactions(ids: string[]): Promise<void> {
    this.logger.log(`Executing batch transaction hard deletion request for ${ids.length} records`);
    await this.transactionRepository.delete(ids);
  }
}