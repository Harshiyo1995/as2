import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
