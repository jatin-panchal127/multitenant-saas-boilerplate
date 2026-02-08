import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

/**
 * Invoice entity — tenant-scoped.
 *
 * Like User, this entity has no `schema` in @Entity(). The schema is
 * determined at runtime by the tenant-specific DataSource, ensuring
 * invoices from different tenants never mix.
 */
@Entity('invoices')
export class Invoice {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'INV-2024-001' })
  @Index({ unique: true })
  @Column({ name: 'invoice_number', type: 'varchar', length: 50 })
  invoiceNumber: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiProperty({ example: 1500.0 })
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @ApiProperty({ example: 'USD' })
  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency: string;

  @ApiProperty({ enum: InvoiceStatus, example: InvoiceStatus.DRAFT })
  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @ApiProperty({ example: 'Monthly SaaS subscription' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiProperty({ example: '2024-12-31' })
  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
