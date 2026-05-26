import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Certificate } from './certificate.entity'; // Make sure this path matches your project

@Entity('trading_partners')
export class TradingPartner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  as2_id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  url: string;

  @Column({ default: true })
  sign_outbound: boolean;

  @Column({ default: true })
  encrypt_outbound: boolean;
  
  @Column({ default: '3DES' })
  encryption_algorithm: string;

  @Column({ default: 'SHA256' })
  signature_algorithm: string;

  @Column({ default: true })
  request_mdn: boolean;

  @Column({ default: 'SYNC' })
  mdn_delivery_mode: string;

  @Column({ nullable: true })
  mdn_url: string;

  @Column({ default: 60 })
  connection_timeout: number;

  @Column({ nullable: true, type: 'uuid' })
  certificate_id: string;

  @ManyToOne(() => Certificate)
  @JoinColumn({ name: 'certificate_id' })
  certificate: Certificate;

  // ─── NEW SETTINGS TAB COLUMNS ───
  @Column({ default: true })
  require_signature: boolean;

  @Column({ default: true })
  require_encryption: boolean;

  @Column({ default: false })
  compress_outbound: boolean;

  @Column({ default: 'SIGNED' })
  mdn_security: string;

  // ─── NEW ADVANCED TAB COLUMNS ───
  @Column({ default: false })
  as2_reliability: boolean;

  @Column({ default: 30 })
  as2_reliability_interval: number;

  @Column({ nullable: true })
  alternate_local_as2_id: string;

  @Column({ nullable: true, type: 'uuid' })
  alternate_private_cert_id: string;

  @Column({ nullable: true })
  alternate_private_cert_password: string;

  @Column({ default: true })
  tls_use_profile_settings: boolean;

  @Column({ nullable: true, type: 'uuid' })
  tls_private_cert_id: string;

  @Column({ nullable: true })
  tls_private_cert_password: string;

  @Column({ default: false })
  http_auth_enabled: boolean;

  @Column({ default: 'BASIC' })
  http_auth_type: string;

  @Column({ nullable: true })
  http_auth_user: string;

  @Column({ nullable: true })
  http_auth_password: string;

  @Column({ nullable: true })
  tls_enabled_protocols: string;

  @Column({ nullable: true })
  temp_receive_directory: string;

  @Column({ nullable: true })
  custom_http_headers: string;

  @Column({ default: true })
  use_global_proxy: boolean;

  @Column({ default: 'None' })
  proxy_type: string;

  @Column({ nullable: true })
  proxy_host: string;

  @Column({ nullable: true })
  proxy_port: number;

  @Column({ nullable: true })
  proxy_user: string;

  @Column({ nullable: true })
  proxy_password: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}