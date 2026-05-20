import { Module } from '@nestjs/common';
import { As2Controller } from './as2.controller';
import { As2Service } from './as2.service';
import { As2OutboundService } from './as2-outbound.service';
import { StorageModule } from '../storage/storage.module';
import { CryptoModule } from '../crypto/crypto.module';
import { MdnModule } from '../mdn/mdn.module';
import { FdaModule } from '../fda/fda.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [StorageModule, CryptoModule, MdnModule, FdaModule, DatabaseModule],
  controllers: [As2Controller],
  providers: [As2Service, As2OutboundService],
})
export class As2Module {}
