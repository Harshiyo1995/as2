import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificate } from './entities/certificate.entity';
import { TradingPartner } from './entities/trading-partner.entity';
import { Transaction } from './entities/transaction.entity';
import { TradingPartnerService } from './trading-partner.service';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { TradingPartnerController } from './trading-partner.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Certificate, TradingPartner, Transaction])],
  controllers: [TransactionController, TradingPartnerController],
  providers: [TradingPartnerService, TransactionService],
  exports: [TradingPartnerService, TransactionService],
})
export class DatabaseModule {}
