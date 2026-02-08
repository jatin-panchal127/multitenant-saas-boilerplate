import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { TenantConnectionService } from '../database/tenant-connection.service';

/**
 * UsersService — Demonstrates scoped repository pattern.
 *
 * Every method obtains a Repository<User> from the TENANT-SPECIFIC DataSource
 * via `getUserRepository()`. This ensures all queries target the current
 * tenant's PostgreSQL schema, providing strict data isolation.
 *
 * The tenant schema name is retrieved from CLS (set by TenantMiddleware),
 * making the isolation automatic and transparent to callers.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly tenantConnectionService: TenantConnectionService,
    private readonly cls: ClsService,
  ) {}

  /**
   * Returns a TypeORM Repository scoped to the current tenant's schema.
   * This is the key to the schema-per-tenant isolation pattern.
   */
  private async getUserRepository() {
    const tenantSchema = this.cls.get<string>('tenantId');

    if (!tenantSchema) {
      throw new UnauthorizedException('No tenant context available');
    }

    const dataSource = await this.tenantConnectionService.getConnection(tenantSchema);
    return dataSource.getRepository(User);
  }

  async create(dto: CreateUserDto): Promise<User> {
    const repo = await this.getUserRepository();

    const existing = await repo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = repo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: dto.role,
    });

    return repo.save(user);
  }

  async findAll(): Promise<User[]> {
    const repo = await this.getUserRepository();
    return repo.find({
      select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<User | null> {
    const repo = await this.getUserRepository();
    return repo.findOne({
      where: { id },
      select: ['id', 'email', 'name', 'role', 'isActive', 'createdAt', 'updatedAt'],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    const repo = await this.getUserRepository();
    // Include passwordHash for authentication (explicitly selected)
    return repo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async remove(id: string): Promise<void> {
    const repo = await this.getUserRepository();
    const user = await repo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    await repo.remove(user);
  }
}
