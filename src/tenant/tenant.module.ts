import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { Tenant } from './entities/tenant.entity';

@Module({
  imports: [
    // Register Tenant entity with the default (public schema) TypeORM connection
    TypeOrmModule.forFeature([Tenant]),
  ],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService], // Exported for use by TenantMiddleware
})
export class TenantModule {}
