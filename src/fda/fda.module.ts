import { Module } from '@nestjs/common';
import { FdaParserService } from './fda-parser.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [FdaParserService],
  exports: [FdaParserService],
})
export class FdaModule {}
