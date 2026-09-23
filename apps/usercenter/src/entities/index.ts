import { AppEntity } from './app.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { UserEntity } from './user.entity';
import { UserAppEntity } from './user-app.entity';
import { UserIdentityEntity } from './user-identity.entity';
import { UserRoleEntity } from './user-role.entity';

export const USERCENTER_ENTITIES = [
  AppEntity,
  UserEntity,
  UserAppEntity,
  UserIdentityEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserRoleEntity,
];

export {
  AppEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  UserAppEntity,
  UserIdentityEntity,
  UserRoleEntity,
};
