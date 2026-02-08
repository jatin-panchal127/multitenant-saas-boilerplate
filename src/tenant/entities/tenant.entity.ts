import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Tenant entity — lives in the PUBLIC schema as the central registry.
 *
 * Each row represents an isolated tenant with their own PostgreSQL schema.
 * The `schemaName` field is the actual PostgreSQL schema name (e.g., "tenant_acme_corp").
 */
@Entity('tenants', { schema: 'public' })
export class Tenant {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'Acme Corporation' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @ApiProperty({
    example: 'acme-corp',
    description: 'URL-safe unique identifier for the tenant',
  })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug: string;

  @ApiProperty({
    example: 'tenant_acme_corp',
    description: 'PostgreSQL schema name for this tenant (auto-generated from slug)',
  })
  @Index({ unique: true })
  @Column({ name: 'schema_name', type: 'varchar', length: 100 })
  schemaName: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @Column({ name: 'admin_email', type: 'varchar', length: 255 })
  adminEmail: string;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty({ example: 'pro', enum: ['free', 'starter', 'pro', 'enterprise'] })
  @Column({ type: 'varchar', length: 50, default: 'free' })
  plan: string;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
