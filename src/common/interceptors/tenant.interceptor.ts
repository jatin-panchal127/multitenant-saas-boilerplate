import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  UnauthorizedException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ClsService } from 'nestjs-cls';

/**
 * TenantInterceptor — Complementary to TenantMiddleware.
 *
 * Responsibilities:
 * - Validates that a tenant context exists (middleware already set it)
 * - Adds tenant context headers to responses for client debugging
 * - Can be applied per-controller for fine-grained tenant enforcement
 *
 * Usage:
 *   @UseInterceptors(TenantInterceptor) on any controller that requires tenant isolation
 *
 * Note: For HTTP requests, TenantMiddleware is the PRIMARY resolver.
 * This interceptor acts as a validation gate and observability layer.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Validate tenant context was established by middleware
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      // Fallback: check request header directly
      const headerTenantId = request.headers['x-tenant-id'];
      if (!headerTenantId) {
        throw new UnauthorizedException(
          'No tenant context found. This endpoint requires a valid tenant.',
        );
      }
    }

    // Add tenant context to response headers for client-side debugging
    response.setHeader('X-Tenant-Schema', tenantId || 'unknown');
    response.setHeader('X-Tenant-Slug', this.cls.get<string>('tenantSlug') || 'unknown');

    return next.handle().pipe(
      tap(() => {
        // Post-execution hook — useful for tenant-scoped audit logging
      }),
    );
  }
}
