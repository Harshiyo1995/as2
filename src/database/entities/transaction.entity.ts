import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TransactionStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum Direction {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MdnStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  NOT_REQUIRED = 'NOT_REQUIRED',
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 512, unique: true })
  message_id: string;

  @Column({ length: 512, nullable: true })
  correlation_id: string;

  @Column({ type: 'enum', enum: Direction })
  direction: Direction;

  @Column()
  sender_as2_id: string;

  @Column()
  receiver_as2_id: string;

  @Column('text', { nullable: true })
  subject: string;

  @Column({ length: 1024, nullable: true })
  raw_file_path: string;

  @Column({ length: 1024, nullable: true })
  decrypted_file_path: string;

  @Column({ type: 'enum', enum: TransactionStatus })
  status: TransactionStatus;

  @Column({ type: 'enum', enum: MdnStatus, nullable: true })
  mdn_status: MdnStatus;

  @Column({ length: 512, nullable: true })
  mdn_message_id: string;

  @Column({ nullable: true })
  mic: string;

  @Column({ default: 0 })
  retry_count: number;

  @Column({ type: 'text', nullable: true }) // Changed from default varchar/string to text
  error_details: string;

  @Column({ type: 'varchar', length: 255, nullable: true }) // Give statuses more breathing room
  fda_submission_status: string;

  @Column({ type: 'varchar', nullable: true, name: 'mic_checksum' })
  mic_checksum: string;

  @Column({ type: 'text', nullable: true, name: 'raw_mdn_content' })
  raw_mdn_content: string;

  @Column({ type: 'timestamp', nullable: true, name: 'nrr_validated_at' })
  nrr_validated_at: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
