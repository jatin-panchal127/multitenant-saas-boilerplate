import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { Tenant } from './entities/tenant.entity';

/**
 * TenantController — Manages tenant lifecycle (registration, listing, deactivation).
 *
 * Note: These endpoints are intentionally public (no JWT required) to allow
 * tenant onboarding. In production, you may want to restrict tenant creation
 * to a super-admin role or a separate internal service.
 */
@ApiTags('Tenants')
@Controller('tenant')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ short: { limit: 2, ttl: 60000 } }) // Extra restriction: 2 tenants/min
  @ApiOperation({
    summary: 'Register a new tenant',
    description:
      'Creates a new tenant and provisions an isolated PostgreSQL schema for their data.',
  })
  @ApiResponse({ status: 201, description: 'Tenant registered', type: Tenant })
  @ApiResponse({ status: 409, description: 'Tenant with this slug or email already exists' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  create(@Body() createTenantDto: CreateTenantDto): Promise<Tenant> {
    return this.tenantService.create(createTenantDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all tenants' })
  @ApiResponse({ status: 200, description: 'List of all tenants', type: [Tenant] })
  findAll(): Promise<Tenant[]> {
    return this.tenantService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant found', type: Tenant })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  findOne(@Param('id') id: string): Promise<Tenant> {
    return this.tenantService.findById(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate a tenant' })
  @ApiParam({ name: 'id', description: 'Tenant UUID' })
  @ApiResponse({ status: 200, description: 'Tenant deactivated', type: Tenant })
  deactivate(@Param('id') id: string): Promise<Tenant> {
    return this.tenantService.deactivate(id);
  }
}
