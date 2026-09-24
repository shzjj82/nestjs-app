import { ClientEntity } from './client.entity';
export type { ClientType } from './client.entity';
export type { IdentityProvider } from './user-identity.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { UserEntity } from './user.entity';
import { UserIdentityEntity } from './user-identity.entity';
import { UserRoleEntity } from './user-role.entity';

export const USERCENTER_ENTITIES = [
  ClientEntity,
  UserEntity,
  UserIdentityEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserRoleEntity,
];

export {
  ClientEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  UserIdentityEntity,
  UserRoleEntity,
};
