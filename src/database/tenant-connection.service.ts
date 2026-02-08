import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Invoice } from '../invoices/entities/invoice.entity';

/**
 * TenantConnectionService — Core of the Schema-per-Tenant architecture.
 *
 * How it works:
 * 1. Each tenant gets their own PostgreSQL schema (e.g., "tenant_acme_corp")
 * 2. This service maintains a pool of TypeORM DataSource instances, one per schema
 * 3. Each DataSource is configured with `schema: tenantSchemaName`, which:
 *    - Sets search_path to the tenant schema on every new connection
 *    - Ensures all DDL/DML targets the correct isolated schema
 * 4. Connections are cached (Map) to avoid reconnecting on every request
 * 5. Race conditions during first connection are handled via pending promise tracking
 *
 * Production considerations:
 * - Connection pool limits per tenant (max: 5 connections)
 * - Graceful cleanup on app shutdown
 * - Schema name validation to prevent SQL injection
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);

  /** Cache of initialized DataSources, keyed by schema name */
  private readonly connections = new Map<string, DataSource>();

  /** Pending connection promises to prevent duplicate initialization (race condition guard) */
  private readonly pendingConnections = new Map<string, Promise<DataSource>>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns a DataSource scoped to the given tenant schema.
   * Creates and caches the connection on first use.
   */
  async getConnection(tenantSchema: string): Promise<DataSource> {
    // Fast path: return cached initialized connection
    if (this.connections.has(tenantSchema)) {
      const existing = this.connections.get(tenantSchema)!;
      if (existing.isInitialized) {
        return existing;
      }
    }

    // Race condition guard: if another request is already initializing this connection, wait for it
    if (this.pendingConnections.has(tenantSchema)) {
      return this.pendingConnections.get(tenantSchema)!;
    }

    // Create new connection, track it as pending
    const connectionPromise = this.createConnection(tenantSchema);
    this.pendingConnections.set(tenantSchema, connectionPromise);

    try {
      const dataSource = await connectionPromise;
      this.connections.set(tenantSchema, dataSource);
      return dataSource;
    } finally {
      this.pendingConnections.delete(tenantSchema);
    }
  }

  /**
   * Provisions a new tenant: creates the PostgreSQL schema and initializes tables.
   * Called during tenant registration.
   */
  async createTenantSchema(
    tenantSchema: string,
    mainDataSource: DataSource,
  ): Promise<void> {
    this.validateSchemaName(tenantSchema);

    this.logger.log(`Provisioning schema for new tenant: ${tenantSchema}`);

    // Create the PostgreSQL schema
    await mainDataSource.query(`CREATE SCHEMA IF NOT EXISTS "${tenantSchema}"`);

    // Get (or create) the DataSource for this tenant
    const tenantConnection = await this.getConnection(tenantSchema);

    // Run migrations (production) or synchronize (development)
    if (this.configService.get<string>('NODE_ENV') === 'development') {
      await tenantConnection.synchronize();
    } else {
      await tenantConnection.runMigrations();
    }

    this.logger.log(`Schema "${tenantSchema}" provisioned successfully`);
  }

  /**
   * Tears down a tenant schema. Use with extreme caution — data is permanently destroyed.
   */
  async dropTenantSchema(
    tenantSchema: string,
    mainDataSource: DataSource,
  ): Promise<void> {
    this.logger.warn(`DROPPING schema: ${tenantSchema} — this is irreversible!`);

    // Close and evict cached connection
    await this.closeConnection(tenantSchema);

    // Drop the PostgreSQL schema and all its contents
    await mainDataSource.query(`DROP SCHEMA IF EXISTS "${tenantSchema}" CASCADE`);

    this.logger.log(`Schema "${tenantSchema}" dropped`);
  }

  /**
   * Runs TypeORM migrations on ALL tenant schemas.
   * Used for cross-tenant schema evolution (e.g., adding a new column).
   */
  async runMigrationsForAllTenants(tenantSchemas: string[]): Promise<void> {
    this.logger.log(`Running migrations across ${tenantSchemas.length} tenant schema(s)`);

    for (const schema of tenantSchemas) {
      try {
        const connection = await this.getConnection(schema);
        await connection.runMigrations();
        this.logger.log(`✓ Migrations complete: ${schema}`);
      } catch (error) {
        this.logger.error(`✗ Migration failed: ${schema}`, error);
        throw error;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async createConnection(tenantSchema: string): Promise<DataSource> {
    this.logger.log(`Initializing connection for schema: ${tenantSchema}`);

    const options: DataSourceOptions = {
      type: 'postgres',
      host: this.configService.get<string>('DB_HOST', 'localhost'),
      port: this.configService.get<number>('DB_PORT', 5432),
      username: this.configService.get<string>('DB_USERNAME', 'postgres'),
      password: this.configService.get<string>('DB_PASSWORD', 'postgres'),
      database: this.configService.get<string>('DB_NAME', 'saas_db'),
      schema: tenantSchema, // ← KEY: This sets search_path = tenantSchema on every connection
      entities: [User, Invoice],
      synchronize: false,
      logging: this.configService.get<string>('NODE_ENV') === 'development',
      ssl: this.configService.get<string>('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      extra: {
        max: 5,               // Limit pool size per tenant
        min: 1,
        idleTimeoutMillis: 30000,
      },
    };

    const dataSource = new DataSource(options);
    await dataSource.initialize();
    return dataSource;
  }

  private async closeConnection(schema: string): Promise<void> {
    if (this.connections.has(schema)) {
      const conn = this.connections.get(schema)!;
      if (conn.isInitialized) {
        await conn.destroy();
      }
      this.connections.delete(schema);
    }
  }

  /**
   * Validates schema name against an allowlist pattern to prevent SQL injection.
   * Schema names must start with a letter and contain only lowercase letters, digits, underscores.
   */
  private validateSchemaName(name: string): void {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) {
      throw new Error(
        `Invalid schema name "${name}". Must match /^[a-z][a-z0-9_]*$/`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing all tenant database connections...');
    const closePromises = Array.from(this.connections.keys()).map((schema) =>
      this.closeConnection(schema),
    );
    await Promise.all(closePromises);
  }
}
