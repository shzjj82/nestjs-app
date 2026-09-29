import { AccountEntity } from './account.entity';
import { AccountRoleEntity } from './account-role.entity';
import { ClientEntity } from './client.entity';
export type { ClientType } from './client.entity';
export type { AccountType } from './account.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { UserEntity } from './user.entity';

export const USERCENTER_ENTITIES = [
  ClientEntity,
  UserEntity,
  AccountEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  AccountRoleEntity,
];

export {
  AccountEntity,
  AccountRoleEntity,
  ClientEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
};
