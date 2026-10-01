import { AccountEntity } from './account.entity';
import { AccountRoleEntity } from './account-role.entity';
import { BusinessEntity } from './business.entity';
import { BusinessMemberEntity } from './business-member.entity';
import { BusinessPermissionEntity } from './business-permission.entity';
import { ClientEntity } from './client.entity';
export type { ClientType } from './client.entity';
export type { AccountType } from './account.entity';
import { PermissionEntity } from './permission.entity';
import { RoleEntity } from './role.entity';
import { RolePermissionEntity } from './role-permission.entity';
import { TeamEntity } from './team.entity';
import { TeamMemberEntity } from './team-member.entity';
import { UserEntity } from './user.entity';

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
  TeamEntity,
  TeamMemberEntity,
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
  TeamEntity,
  TeamMemberEntity,
  UserEntity,
};
