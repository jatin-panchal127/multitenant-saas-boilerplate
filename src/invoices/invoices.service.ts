import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { User } from '../users/entities/user.entity';

/**
 * InvoicesService — Demonstrates the scoped repository pattern for a second resource.
 *
 * Identical isolation mechanism to UsersService: every database operation
 * targets the tenant's schema via the dynamically resolved DataSource.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly cls: ClsService,
  ) {}

  private async getInvoiceRepository() {
    const tenantSchema = this.cls.get<string>('tenantId');

    if (!tenantSchema) {
      throw new UnauthorizedException('No tenant context available');
    }

    const dataSource = await this.tenantConnectionService.getConnection(tenantSchema);
    return dataSource.getRepository(Invoice);
  }

  async create(dto: CreateInvoiceDto): Promise<Invoice> {
    const repo = await this.getInvoiceRepository();
    const dataSource = await this.tenantConnectionService.getConnection(
      this.cls.get<string>('tenantId'),
    );

    // Validate the referenced user exists within this tenant's schema
    const user = await dataSource.getRepository(User).findOne({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException(
        `User "${dto.userId}" not found in this tenant`,
      );
    }

    const existing = await repo.findOne({
      where: { invoiceNumber: dto.invoiceNumber },
    });
    if (existing) {
      throw new ConflictException(
        `Invoice number "${dto.invoiceNumber}" already exists in this tenant`,
      );
    }

    const invoice = repo.create(dto);
    return repo.save(invoice);
  }

  async findAll(): Promise<Invoice[]> {
    const repo = await this.getInvoiceRepository();
    return repo.find({ order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<Invoice> {
    const repo = await this.getInvoiceRepository();
    const invoice = await repo.findOne({ where: { id }, relations: ['user'] });

    if (!invoice) {
      throw new NotFoundException(`Invoice with id "${id}" not found`);
    }
    return invoice;
  }

  async updateStatus(id: string, status: InvoiceStatus): Promise<Invoice> {
    const repo = await this.getInvoiceRepository();
    const invoice = await this.findById(id);
    invoice.status = status;
    return repo.save(invoice);
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getInvoiceRepository();
    const invoice = await this.findById(id);
    await repo.remove(invoice);
  }
}
