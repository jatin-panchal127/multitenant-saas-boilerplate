import {
  IsString,
  IsEmail,
  IsNotEmpty,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty({
    example: 'Acme Corporation',
    description: 'Display name for the tenant organization',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  name: string;

  @ApiProperty({
    example: 'acme-corp',
    description:
      'Unique URL-safe slug. Used in subdomains and the x-tenant-id header. ' +
      'Only lowercase letters, digits, and hyphens are allowed.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message:
      'slug must contain only lowercase letters, numbers, and hyphens (cannot start or end with hyphen)',
  })
  slug: string;

  @ApiProperty({
    example: 'admin@acme.com',
    description: 'Primary admin email for this tenant',
  })
  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;
}
