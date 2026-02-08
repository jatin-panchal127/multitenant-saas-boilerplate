import {
  Module,
  MiddlewareConsumer,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ClsModule, ClsMiddleware } from 'nestjs-cls';

import { DatabaseModule } from './database/database.module';
import { TenantModule } from './tenant/tenant.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { InvoicesModule } from './invoices/invoices.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { Tenant } from './tenant/entities/tenant.entity';

@Module({
  imports: [
    // Configuration - global so all modules can access env vars
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // CLS (Continuation Local Storage) for request-scoped async context propagation.
    // mount: false — we mount ClsMiddleware manually in configure() to guarantee
    // it runs BEFORE TenantMiddleware (which calls cls.set('tenantId', ...)).
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: false,
        generateId: true,
      },
    }),

    // Primary TypeORM connection targeting the PUBLIC schema.
    // This connection ONLY manages the Tenant registry (tenant metadata).
    // All tenant-specific data uses dynamically created per-tenant connections.
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'saas_db'),
        schema: 'public',
        entities: [Tenant],
        synchronize: configService.get<string>('NODE_ENV') === 'development',
        logging: configService.get<string>('NODE_ENV') === 'development',
        poolSize: 10,
        ssl: configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
      inject: [ConfigService],
    }),

    // Rate limiting: 3-tier strategy (short/medium/long)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),

    DatabaseModule,
    TenantModule,
    AuthModule,
    UsersModule,
    InvoicesModule,
  ],
  providers: [
    // Apply rate limiting globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  /**
   * Configure middleware pipeline.
   * TenantMiddleware runs on all routes to extract and validate tenant context.
   */
  configure(consumer: MiddlewareConsumer) {
    // ClsMiddleware MUST be first — it creates the AsyncLocalStorage context
    // that TenantMiddleware writes into via cls.set('tenantId', ...).
    consumer
      .apply(ClsMiddleware, TenantMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
