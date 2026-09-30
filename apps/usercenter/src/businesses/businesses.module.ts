import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AccountEntity,
  AccountRoleEntity,
  BusinessEntity,
  BusinessMemberEntity,
  BusinessPermissionEntity,
  PermissionEntity,
  RoleEntity,
} from '../entities';
import { BusinessesController } from './businesses.controller';
import { BusinessesService } from './businesses.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BusinessEntity,
      BusinessMemberEntity,
      BusinessPermissionEntity,
      PermissionEntity,
      RoleEntity,
      AccountEntity,
      AccountRoleEntity,
    ]),
  ],
  controllers: [BusinessesController],
  providers: [BusinessesService],
  exports: [BusinessesService],
})
export class BusinessesModule {}
