import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppsModule } from '../apps/apps.module';
import { SharedModule } from '../common/shared.module';
import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserRoleEntity,
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
      UserRoleEntity,
    ]),
    AppsModule,
    SharedModule,
  ],
  controllers: [RolesController, PermissionsController],
  providers: [RbacService, ExcelService],
  exports: [RbacService],
})
export class RbacModule {}
