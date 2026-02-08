import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { TenantConnectionService } from '../database/tenant-connection.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,

    @InjectDataSource()
    private readonly mainDataSource: DataSource,

    private readonly tenantConnectionService: TenantConnectionService,
  ) {}

  /**
   * Registers a new tenant:
   * 1. Validates uniqueness (slug + adminEmail)
   * 2. Persists tenant metadata to public schema
   * 3. Provisions the tenant's isolated PostgreSQL schema
   */
  async create(dto: CreateTenantDto): Promise<Tenant> {
    // Check uniqueness constraints
    const existing = await this.tenantRepository.findOne({
      where: [{ slug: dto.slug }, { adminEmail: dto.adminEmail }],
    });

    if (existing) {
      throw new ConflictException(
        'A tenant with this slug or admin email already exists.',
      );
    }

    // Derive schema name: "acme-corp" → "tenant_acme_corp"
    const schemaName = `tenant_${dto.slug.replace(/-/g, '_')}`;

    const tenant = this.tenantRepository.create({
      name: dto.name,
      slug: dto.slug,
      schemaName,
      adminEmail: dto.adminEmail,
      isActive: true,
      plan: 'free',
    });

    const savedTenant = await this.tenantRepository.save(tenant);

    // Provision the PostgreSQL schema for this tenant
    await this.tenantConnectionService.createTenantSchema(
      schemaName,
      this.mainDataSource,
    );

    this.logger.log(`Tenant "${dto.slug}" created with schema "${schemaName}"`);
    return savedTenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant with id "${id}" not found`);
    }
    return tenant;
  }

  /**
   * Finds a tenant by ID or slug — used by TenantMiddleware for identification.
   * Avoids passing a non-UUID value into the UUID `id` column to prevent
   * "invalid input syntax for type uuid" errors from PostgreSQL.
   */
  async findByIdOrSlug(idOrSlug: string): Promise<Tenant | null> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      idOrSlug,
    );

    return this.tenantRepository.findOne({
      where: isUuid ? [{ id: idOrSlug }, { slug: idOrSlug }] : [{ slug: idOrSlug }],
    });
  }

  async deactivate(id: string): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.isActive = false;
    return this.tenantRepository.save(tenant);
  }
}
