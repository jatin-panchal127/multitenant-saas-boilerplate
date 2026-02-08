import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export enum UserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

/**
 * User entity — tenant-scoped.
 *
 * IMPORTANT: No `schema` is specified in @Entity(). The schema is determined
 * at runtime by the DataSource's `schema` option, which TenantConnectionService
 * sets to the current tenant's schema name. This is what enables schema-per-tenant
 * isolation without modifying entity code.
 */
@Entity('users')
export class User {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ example: 'john@example.com' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @ApiProperty({ example: 'John Doe' })
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Excluded from serialization — never returned in API responses
  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar' })
  passwordHash: string;

  @ApiProperty({ enum: UserRole, example: UserRole.MEMBER })
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  role: UserRole;

  @ApiProperty({ example: true })
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
