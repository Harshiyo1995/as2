import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { TradingPartner } from './trading-partner.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  alias: string;

  @Column({ unique: true })
  thumbprint: string;

  @Column('text')
  subject_dn: string;

  @Column('text')
  issuer_dn: string;

  @Column()
  serial_number: string;

  @Column({ default: false })
  is_private: boolean;

  @Column('text')
  pem_data: string;

  @Column({ type: 'text', nullable: true })
  private_key_pem: string;

  @Column({ type: 'timestamp with time zone' })
  valid_from: Date;

  @Column({ type: 'timestamp with time zone' })
  valid_to: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @OneToMany(() => TradingPartner, (partner) => partner.certificate)
  tradingPartners: TradingPartner[];
}
