import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { As2Module } from './as2/as2.module';
import { CryptoModule } from './crypto/crypto.module';
import { MdnModule } from './mdn/mdn.module';
import { StorageModule } from './storage/storage.module';
import { FdaModule } from './fda/fda.module';
import { DatabaseModule } from './database/database.module';
import { Certificate } from './database/entities/certificate.entity';
import { TradingPartner } from './database/entities/trading-partner.entity';
import { Transaction } from './database/entities/transaction.entity';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 5433,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_DATABASE || 'as2_gateway',
      entities: [Certificate, TradingPartner, Transaction],
      synchronize: false,
    }),
    DatabaseModule,
    As2Module,
    CryptoModule,
    MdnModule,
    StorageModule,
    FdaModule
  ],
  controllers: [AppController]
})
export class AppModule { }
