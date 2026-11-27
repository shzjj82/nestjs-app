import { BusinessMemberEntity } from '../modules/businesses/entity/business-member.entity';
import { BusinessPermissionEntity } from '../modules/businesses/entity/business-permission.entity';
import { BusinessEntity } from '../modules/businesses/entity/business.entity';
import { ClientEntity } from '../modules/clients/entity/client.entity';
import { AccountRoleEntity } from '../modules/rbac/entity/account-role.entity';
import { PermissionEntity } from '../modules/rbac/entity/permission.entity';
import { RolePermissionEntity } from '../modules/rbac/entity/role-permission.entity';
import { RoleEntity } from '../modules/rbac/entity/role.entity';
import { AccountEntity } from '../modules/users/entity/account.entity';
import { UserEntity } from '../modules/users/entity/user.entity';

export type { ClientType } from '../modules/clients/entity/client.entity';
export type { AccountType } from '../modules/users/entity/account.entity';

export const USERCENTER_ENTITIES = [
  BusinessEntity,
  ClientEntity,
  UserEntity,
  AccountEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  AccountRoleEntity,
  BusinessMemberEntity,
  BusinessPermissionEntity,
];

export {
  AccountEntity,
  AccountRoleEntity,
  BusinessEntity,
  BusinessMemberEntity,
  BusinessPermissionEntity,
  ClientEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
};
