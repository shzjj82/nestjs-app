import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppsModule } from '../apps/apps.module';
import { SharedModule } from '../common/shared.module';
import {
  RoleEntity,
  UserAppEntity,
  UserEntity,
  UserRoleEntity,
} from '../entities';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      UserAppEntity,
      UserRoleEntity,
      RoleEntity,
    ]),
    AppsModule,
    SharedModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
