import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

/**
 * AppDataSource — Public schema DataSource for TypeORM CLI usage.
 *
 * This targets only the PUBLIC schema and is used for:
 * - TypeORM CLI migration commands (typeorm migration:generate, migration:run)
 * - Managing the tenants registry table
 *
 * For tenant-specific migrations, use: npm run migration:run:all-tenants
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'saas_db',
  schema: 'public',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/database/migrations/public/*.ts'],
  synchronize: false,
});
