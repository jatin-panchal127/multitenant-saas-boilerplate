import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { TenantService } from '../../tenant/tenant.service';

/**
 * Extends the Express Request interface to carry the resolved tenant schema name.
 */
export interface TenantRequest extends Request {
  tenantId?: string; // Resolved PostgreSQL schema name (e.g., "tenant_acme_corp")
  tenantSlug?: string; // Human-readable slug (e.g., "acme-corp")
}

/**
 * TenantMiddleware — Primary tenant identification mechanism.
 *
 * Identification Strategy (in order of precedence):
 * 1. x-tenant-id header: Direct tenant slug or ID (recommended for API clients)
 * 2. Subdomain: Extract from host (e.g., acme.yoursaas.com → "acme")
 *
 * Once identified, the tenant is validated against the public.tenants table
 * and its schema name is stored in both the request object and CLS context
 * for downstream use in repositories and services.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);

  // Routes that don't require tenant context (e.g., tenant registration, health)
  private readonly PUBLIC_PATHS = ['/api/v1/tenant', '/api/v1/health'];

  constructor(
    private readonly tenantService: TenantService,
    private readonly cls: ClsService,
  ) {}

  async use(req: TenantRequest, res: Response, next: NextFunction): Promise<void> {
    // Skip tenant resolution for public/system routes
    if (this.isPublicPath(req.path)) {
      this.logger.debug(`Skipping tenant resolution for public path: ${req.path}`);
      return next();
    }

    const tenantIdentifier = this.extractTenantIdentifier(req);

    if (!tenantIdentifier) {
      throw new UnauthorizedException(
        'Tenant identification required. Provide the "x-tenant-id" header or use a subdomain.',
      );
    }

    // Validate tenant exists and is active in the registry
    const tenant = await this.tenantService.findByIdOrSlug(tenantIdentifier);

    if (!tenant) {
      throw new UnauthorizedException(`Tenant "${tenantIdentifier}" not found.`);
    }

    if (!tenant.isActive) {
      throw new UnauthorizedException(`Tenant "${tenantIdentifier}" is inactive.`);
    }

    // Attach resolved tenant info to request object
    req.tenantId = tenant.schemaName;
    req.tenantSlug = tenant.slug;

    // Store in CLS (Continuation Local Storage) for async propagation.
    // This allows services deep in the call stack to access the tenant
    // without explicit parameter passing.
    this.cls.set('tenantId', tenant.schemaName);
    this.cls.set('tenantSlug', tenant.slug);

    this.logger.debug(`Tenant resolved: ${tenant.slug} → schema: ${tenant.schemaName}`);

    return next();
  }

  /**
   * Extracts the tenant identifier from the request.
   * Priority: x-tenant-id header > subdomain
   */
  private extractTenantIdentifier(req: Request): string | null {
    // Strategy 1: x-tenant-id header (explicit — best for programmatic API access)
    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId?.trim()) {
      return headerTenantId.trim().toLowerCase();
    }

    // Strategy 2: Subdomain extraction (e.g., "acme.yoursaas.com" → "acme")
    const host = req.hostname || '';
    const parts = host.split('.');
    if (parts.length >= 3) {
      const subdomain = parts[0].toLowerCase();
      // Exclude common non-tenant subdomains
      if (!['www', 'api', 'app', 'admin'].includes(subdomain)) {
        return subdomain;
      }
    }

    return null;
  }

  private isPublicPath(path: string): boolean {
    return this.PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
  }
}
