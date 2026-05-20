import { Module } from '@nestjs/common';
import { MdnService } from './mdn.service';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [CryptoModule],
  providers: [MdnService],
  exports: [MdnService],
})
export class MdnModule {}
