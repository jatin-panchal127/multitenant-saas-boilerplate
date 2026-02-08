/**
 * run-tenant-migrations.ts
 *
 * CLI script to run TypeORM migrations across ALL tenant schemas.
 * Run via: npm run migration:run:all-tenants
 *
 * This is the strategy for applying schema changes to every tenant simultaneously,
 * which is required for zero-downtime multi-tenant schema evolution.
 */
import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import { CreateUsersTable1700000000000 } from './tenant/1700000000000-CreateUsersTable';
import { CreateInvoicesTable1700000000001 } from './tenant/1700000000001-CreateInvoicesTable';

config();

const TENANT_MIGRATIONS = [
  CreateUsersTable1700000000000,
  CreateInvoicesTable1700000000001,
];

async function runTenantMigrations(): Promise<void> {
  console.log('🔌 Connecting to database...\n');

  const mainDataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'saas_db',
    schema: 'public',
    entities: [],
    synchronize: false,
  });

  await mainDataSource.initialize();
  console.log('✓ Connected\n');

  try {
    // Discover all tenant schemas (excludes system schemas)
    const result = await mainDataSource.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name NOT IN ('public', 'pg_catalog', 'information_schema')
        AND schema_name NOT LIKE 'pg_%'
      ORDER BY schema_name
    `);

    const tenantSchemas: string[] = result.map((r: { schema_name: string }) => r.schema_name);

    if (tenantSchemas.length === 0) {
      console.log('⚠ No tenant schemas found.\n');
      return;
    }

    console.log(`📋 Found ${tenantSchemas.length} tenant schema(s):\n`);
    tenantSchemas.forEach((s) => console.log(`   - ${s}`));
    console.log();

    let successCount = 0;
    let failCount = 0;

    for (const schema of tenantSchemas) {
      process.stdout.write(`⏳ Migrating "${schema}"... `);

      const tenantDataSource = new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_NAME || 'saas_db',
        schema,
        entities: [],
        migrations: TENANT_MIGRATIONS,
        synchronize: false,
      });

      try {
        await tenantDataSource.initialize();
        const migrations = await tenantDataSource.runMigrations();
        await tenantDataSource.destroy();

        if (migrations.length === 0) {
          console.log('✓ (already up to date)');
        } else {
          console.log(`✓ (applied ${migrations.length} migration(s))`);
        }
        successCount++;
      } catch (err) {
        console.log(`✗ FAILED`);
        console.error(`   Error: ${(err as Error).message}\n`);
        failCount++;
      }
    }

    console.log(`\n📊 Summary: ${successCount} succeeded, ${failCount} failed\n`);

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await mainDataSource.destroy();
    console.log('🔌 Disconnected\n');
  }
}

runTenantMigrations().catch((err) => {
  console.error('Fatal error during tenant migrations:', err);
  process.exit(1);
});
