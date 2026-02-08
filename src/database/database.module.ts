import { Global, Module } from '@nestjs/common';
import { TenantConnectionService } from './tenant-connection.service';

/**
 * DatabaseModule — Global module managing per-tenant database connections.
 *
 * Marked as @Global() so TenantConnectionService is available throughout
 * the application without explicit imports in every feature module.
 */
@Global()
@Module({
  providers: [TenantConnectionService],
  exports: [TenantConnectionService],
})
export class DatabaseModule {}
