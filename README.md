# multitenant-saas-boilerplate

Production-ready Multi-Tenant SaaS Boilerplate built with **NestJS** and **PostgreSQL** using a **Schema-per-Tenant** isolation strategy.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HTTP Request                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  ClsMiddleware (nestjs-cls)                                      │
│  Sets up AsyncLocalStorage context for this request              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  TenantMiddleware                                                │
│  1. Reads x-tenant-id header OR subdomain                        │
│  2. Validates tenant exists in public.tenants                    │
│  3. Stores schemaName in CLS: cls.set('tenantId', schema)        │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Guards / Interceptors                                           │
│  - ThrottlerGuard (rate limiting)                                │
│  - JwtAuthGuard (JWT validation)                                 │
│  - TenantInterceptor (validates CLS context + debug headers)     │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│  Controller → Service                                            │
│  Service calls: tenantConnectionService.getConnection(schema)    │
│  Returns a DataSource scoped to tenant_X schema                  │
│  All SQL targets that schema automatically                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐
│ public schema  │  │ tenant_acme    │  │ tenant_globex          │
│ - tenants      │  │ - users        │  │ - users                │
│                │  │ - invoices     │  │ - invoices             │
└────────────────┘  └────────────────┘  └────────────────────────┘
```

## Key Design Decisions

| Concern | Solution |
|---|---|
| **Multi-tenancy** | Schema-per-Tenant (PostgreSQL schemas) |
| **Tenant identification** | `x-tenant-id` header or subdomain |
| **Context propagation** | `nestjs-cls` (AsyncLocalStorage) |
| **DB connection routing** | Cached per-tenant `DataSource` with `schema` option |
| **Auth** | JWT via `passport-jwt` |
| **Rate limiting** | `@nestjs/throttler` (3-tier) |
| **API docs** | Swagger via `@nestjs/swagger` |
| **Migrations** | TypeORM migrations per tenant schema |

## Prerequisites

- Node.js >= 18
- PostgreSQL >= 14
- npm or yarn

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd multitenant-saas-boilerplate
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL credentials and a strong JWT_SECRET
```

### 3. Create the database

```sql
CREATE DATABASE saas_db;
```

### 4. Start in development mode

```bash
npm run start:dev
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/api/docs`

## API Flow

### Step 1 — Register a tenant

```bash
POST /api/v1/tenant
Content-Type: application/json

{ "name": "Acme Corp", "slug": "acme", "adminEmail": "admin@acme.com" }
```

This creates a `tenant_acme` schema in PostgreSQL and runs migrations on it.

### Step 2 — Register a user within that tenant

```bash
POST /api/v1/auth/register
x-tenant-id: acme

{ "name": "John Doe", "email": "john@acme.com", "password": "SecurePass123!" }
```

### Step 3 — Login

```bash
POST /api/v1/auth/login
x-tenant-id: acme

{ "email": "john@acme.com", "password": "SecurePass123!" }
```

Returns a JWT token scoped to the tenant.

### Step 4 — Use tenant-scoped resources

```bash
GET /api/v1/invoices
x-tenant-id: acme
Authorization: Bearer <token>
```

All queries execute against the `tenant_acme` schema.

## Project Structure

```
src/
├── main.ts                          # Bootstrap, Swagger setup
├── app.module.ts                    # Root module, middleware pipeline
│
├── common/
│   ├── middleware/
│   │   └── tenant.middleware.ts     # Tenant identification
│   ├── interceptors/
│   │   └── tenant.interceptor.ts    # Tenant context validation + headers
│   ├── decorators/
│   │   └── current-tenant.decorator.ts
│   └── filters/
│       └── http-exception.filter.ts
│
├── database/
│   ├── database.module.ts           # Global module
│   ├── tenant-connection.service.ts # Per-tenant DataSource pool (core isolation)
│   ├── data-source.ts               # TypeORM CLI config (public schema)
│   └── migrations/
│       ├── tenant/                  # Tenant-specific migrations
│       └── run-tenant-migrations.ts # Cross-tenant migration runner
│
├── tenant/                          # Tenant registry (public schema)
├── auth/                            # JWT auth (tenant-scoped)
├── users/                           # Users (tenant-scoped)
└── invoices/                        # Invoices (tenant-scoped)
```

## How Schema Isolation Works

```typescript
// In UsersService (or any tenant-scoped service):
private async getUserRepository() {
  const tenantSchema = this.cls.get<string>('tenantId'); // "tenant_acme"
  const dataSource = await this.tenantConnectionService.getConnection(tenantSchema);
  // DataSource configured with schema: "tenant_acme"
  // All queries on this DataSource target the tenant_acme schema
  return dataSource.getRepository(User);
}
```

The `schema` option on TypeORM's `DataSourceOptions` sets `search_path` to the
tenant's schema on every connection in that pool. No entity code needs modification —
isolation is entirely at the infrastructure layer.

## Running Migrations

```bash
# Run migrations on ALL tenant schemas:
npm run migration:run:all-tenants

# Run public schema migrations (tenant registry):
npm run migration:run
```

## Production Considerations

- **Connection pooling**: Each tenant gets up to 5 connections. For 100+ tenants, use PgBouncer.
- **Tenant caching**: Add Redis caching for `TenantMiddleware` to avoid a DB hit on every request.
- **Schema creation**: Set `DB_SYNC=false` in production and rely only on migrations.
- **Secret management**: Use a secrets manager (AWS Secrets Manager, Vault) for `JWT_SECRET`.
- **Rate limiting**: Extend `ThrottlerModule` with Redis storage for distributed environments.
