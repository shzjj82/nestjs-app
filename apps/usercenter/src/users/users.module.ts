import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AccountEntity,
  AccountRoleEntity,
  RoleEntity,
  UserEntity,
} from '../entities';
import { AccountsService } from './accounts.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AccountEntity,
      AccountRoleEntity,
      RoleEntity,
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, AccountsService],
  exports: [UsersService, AccountsService],
})
export class UsersModule {}
