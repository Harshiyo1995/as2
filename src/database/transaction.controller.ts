import { Controller, Get, Delete, Post, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import * as fs from 'fs/promises';
import * as path from 'path';

@Controller('api/transactions')
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) { }

  @Get()
  async getRecentTransactions() {
    return this.transactionService['transactionRepository'].find({
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  /**
   * On-demand local disk payload file asset reader proxy.
   * Pulls the plaintext decrypted XML document stream directly off storage drive lines.
   */
  @Get(':id/payload')
  async getDecryptedPayload(@Param('id') id: string): Promise<{ content: string }> {
    try {
      // 1. Find the transaction row registry using your current active repository instance
      const tx = await this.transactionService['transactionRepository'].findOne({
        where: { id: id }
      });

      if (!tx || !tx.raw_file_path) {
        return { content: `` };
      }

      // 2. Map the raw filename tracking string over to your decrypted target counterpart
      const decryptedFilename = tx.raw_file_path.replace('.raw.enc', '.decrypted.xml');
      
      // 3. Pin down the absolute location path straight inside your process directory space
      const targetDiskPath = path.join(process.cwd(), 'data_storage', decryptedFilename);

      // 4. Stream the raw text string content chunk buffer right into your memory allocation loop
      const plaintextXml = await fs.readFile(targetDiskPath, 'utf-8');
      
      return { content: plaintextXml };
    } catch (err) {
      // Gracefully catches disk miss exceptions (e.g., cleared file system cache storage) without throwing 500 crashes
      return { 
        content: `\n` 
      };
    }
  }

  /**
   * Targeted single record deletion hook
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSingleRecord(@Param('id') id: string) {
    await this.transactionService.deleteTransaction(id);
  }

  /**
   * Array-buffered bulk deletion hook
   */
  @Post('bulk-delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async bulkDeleteRecords(@Body('ids') ids: string[]) {
    if (!ids || ids.length === 0) {
      return;
    }
    await this.transactionService.bulkDeleteTransactions(ids);
  }
}