import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AccountRoleEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
} from '../entities';
import { ExcelService } from './excel.service';
import { PermissionsController } from './permissions.controller';
import { RbacService } from './rbac.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoleEntity,
      PermissionEntity,
      RolePermissionEntity,
      AccountRoleEntity,
    ]),
  ],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService, ExcelService],
  exports: [RbacService],
})
export class RbacModule {}
