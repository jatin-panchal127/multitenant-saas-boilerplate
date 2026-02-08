import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

/**
 * UsersModule — Note: No TypeOrmModule.forFeature() here.
 *
 * Unlike standard NestJS/TypeORM setups, we do NOT register User with the
 * default connection via forFeature(). Instead, UsersService obtains the
 * Repository<User> dynamically from TenantConnectionService, which routes
 * to the correct tenant-specific DataSource.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
