import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Certificate } from './certificate.entity';

@Entity('trading_partners')
export class TradingPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  as2_id: string;

  @Column()
  name: string;

  @Column({ length: 1024, nullable: true })
  url: string;

  @Column({ length: 1024, nullable: true })
  mdn_url: string;

  @ManyToOne(() => Certificate, (cert) => cert.tradingPartners, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
