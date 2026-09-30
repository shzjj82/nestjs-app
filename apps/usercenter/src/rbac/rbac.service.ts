import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PLATFORM_BIZ_CODE, TokenStore } from '@app/common';
import type { PermissionInfo, RoleInfo } from '@app/common';
import { In, IsNull, Repository } from 'typeorm';
import {
  AccountEntity,
  AccountRoleEntity,
  BusinessEntity,
  BusinessPermissionEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
} from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { mergeBusinessRbac, type RoleGrant } from './rbac-merge';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
    @InjectRepository(AccountRoleEntity)
    private readonly accountRoles: Repository<AccountRoleEntity>,
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
    @InjectRepository(BusinessPermissionEntity)
    private readonly businessPermissions: Repository<BusinessPermissionEntity>,
    private readonly tokens: TokenStore,
  ) {}

  /**
   * 会话权限 = 该账户的平台级角色 + 该用户在当前业务下的角色（与业务能力包取交集）。
   */
  async loadAccountRbac(accountId: string, businessId: string) {
    const account = await this.accounts.findOne({ where: { id: accountId } });
    if (!account) {
      return { roles: [] as string[], permissions: [] as string[] };
    }
    const userAccounts = await this.accounts.find({ where: { userId: account.userId } });
    const rows = await this.accountRoles.find({
      where: { accountId: In(userAccounts.map((a) => a.id)) },
      relations: ['role'],
    });
    const platformRoles = rows
      .filter((row) => row.accountId === accountId && row.role && row.role.businessId === null)
      .map((row) => row.role);
    const businessRoles = rows
      .filter((row) => row.role?.businessId === businessId)
      .map((row) => row.role);

    const roleIds = [...platformRoles, ...businessRoles].map((role) => role.id);
    const links = roleIds.length
      ? await this.rolePermissions.find({
          where: { roleId: In(roleIds) },
          relations: ['permission'],
        })
      : [];
    const grant = (role: RoleEntity): RoleGrant => ({
      code: role.code,
      permissions: links
        .filter((link) => link.roleId === role.id)
        .map((link) => link.permission.code),
    });
    const capabilityLinks = await this.businessPermissions.find({
      where: { businessId },
      relations: ['permission'],
    });
    return mergeBusinessRbac({
      platformRoles: platformRoles.map(grant),
      businessRoles: businessRoles.map(grant),
      capability: new Set(capabilityLinks.map((link) => link.permission.code)),
    });
  }

  /** 传 businessId 时返回该业务角色及平台级角色；否则返回全部 */
  async listRoles(payload: Record<string, unknown> = {}): Promise<RoleInfo[]> {
    const businessId = optionalString(payload.businessId);
    const roles = await this.roles.find({
      where: businessId ? [{ businessId }, { businessId: IsNull() }] : {},
      order: { createdAt: 'ASC' },
    });
    return Promise.all(roles.map((role) => this.toRoleInfo(role)));
  }

  async createRole(payload: Record<string, unknown>): Promise<RoleInfo> {
    const code = requiredString(payload.code, 'code');
    const name = requiredString(payload.name, 'name');
    const businessId = requiredString(payload.businessId, 'businessId');
    if (!(await this.businesses.findOne({ where: { id: businessId } }))) {
      rpcFail(404, `业务 ${businessId} 不存在`);
    }
    const exists = await this.roles.findOne({ where: { code, businessId } });
    if (exists) {
      rpcFail(409, `角色 ${code} 在该业务下已存在`);
    }
    const saved = await this.roles.save(
      this.roles.create({
        code,
        name,
        businessId,
        description: optionalString(payload.description) ?? null,
        isSystem: false,
      }),
    );
    return this.toRoleInfo(saved);
  }

  async updateRole(payload: Record<string, unknown>): Promise<RoleInfo> {
    const role = await this.requireRole(requiredString(payload.id, 'id'));
    if (payload.name) {
      role.name = requiredString(payload.name, 'name');
    }
    if (payload.description !== undefined) {
      role.description = optionalString(payload.description) ?? null;
    }
    return this.toRoleInfo(await this.roles.save(role));
  }

  async deleteRole(payload: Record<string, unknown>) {
    const role = await this.requireRole(requiredString(payload.id, 'id'));
    if (role.isSystem) {
      rpcFail(400, '系统角色不能删除');
    }
    const holders = await this.holderUserIds(role.id);
    await this.businesses.update({ defaultRoleId: role.id }, { defaultRoleId: null });
    await this.roles.remove(role);
    await this.revokeUsers(holders);
    return { ok: true };
  }

  async setRolePermissions(payload: Record<string, unknown>): Promise<RoleInfo> {
    const role = await this.requireRole(requiredString(payload.id, 'id'));
    const permissionIds = Array.isArray(payload.permissionIds)
      ? payload.permissionIds.map(String)
      : [];
    const permissions = permissionIds.length
      ? await this.permissions.find({ where: { id: In(permissionIds) } })
      : [];
    await this.replaceRolePermissions(role.id, permissions);
    await this.revokeUsers(await this.holderUserIds(role.id));
    return this.toRoleInfo(role);
  }

  /** 角色变更后吊销持有者的会话，让新权限立即生效 */
  async revokeUsers(userIds: string[]) {
    for (const userId of new Set(userIds)) {
      await this.tokens.revokeAll(userId);
    }
  }

  private async holderUserIds(roleId: string): Promise<string[]> {
    const links = await this.accountRoles.find({ where: { roleId }, relations: ['account'] });
    return links.map((link) => link.account?.userId).filter((id): id is string => !!id);
  }

  async listPermissions(_payload: Record<string, unknown> = {}): Promise<PermissionInfo[]> {
    const rows = await this.permissions.find({
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toPermissionInfo(row));
  }

  async createPermission(payload: Record<string, unknown>): Promise<PermissionInfo> {
    const code = requiredString(payload.code, 'code');
    const name = requiredString(payload.name, 'name');
    const exists = await this.permissions.findOne({ where: { code } });
    if (exists) {
      rpcFail(409, `功能点 ${code} 已存在`);
    }
    const saved = await this.permissions.save(
      this.permissions.create({
        code,
        name,
        module: optionalString(payload.module) ?? '默认',
        description: optionalString(payload.description) ?? null,
        sort: Number(payload.sort) || 0,
      }),
    );
    await this.grantToAdminRole(saved);
    return this.toPermissionInfo(saved);
  }

  async updatePermission(payload: Record<string, unknown>): Promise<PermissionInfo> {
    const item = await this.requirePermission(requiredString(payload.id, 'id'));
    if (payload.name) {
      item.name = requiredString(payload.name, 'name');
    }
    if (payload.module) {
      item.module = requiredString(payload.module, 'module');
    }
    if (payload.description !== undefined) {
      item.description = optionalString(payload.description) ?? null;
    }
    if (payload.sort !== undefined) {
      item.sort = Number(payload.sort) || 0;
    }
    return this.toPermissionInfo(await this.permissions.save(item));
  }

  async deletePermission(payload: Record<string, unknown>) {
    const item = await this.requirePermission(requiredString(payload.id, 'id'));
    await this.permissions.remove(item);
    return { ok: true };
  }

  /** Excel 导入导出只处理平台范围的角色（平台级 + 平台业务），避免跨业务同名角色冲突 */
  async listAllRoles(): Promise<RoleEntity[]> {
    const platform = await this.businesses.findOne({ where: { code: PLATFORM_BIZ_CODE } });
    return this.roles.find({
      where: platform ? [{ businessId: IsNull() }, { businessId: platform.id }] : { businessId: IsNull() },
      order: { createdAt: 'ASC' },
    });
  }

  async listAllPermissions(): Promise<PermissionEntity[]> {
    return this.permissions.find({
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
  }

  async listRolePermissionMatrix() {
    const roles = await this.listAllRoles();
    const permissions = await this.listAllPermissions();
    const links = roles.length
      ? await this.rolePermissions.find({
          where: { roleId: In(roles.map((role) => role.id)) },
        })
      : [];
    const checked = new Set(
      links.map((link) => `${link.roleId}:${link.permissionId}`),
    );
    return { roles, permissions, checked };
  }

  async upsertPermissions(
    rows: Array<{
      module: string;
      code: string;
      name: string;
      description: string | null;
      sort: number;
    }>,
  ) {
    const saved: PermissionEntity[] = [];
    for (const row of rows) {
      let item = await this.permissions.findOne({ where: { code: row.code } });
      if (!item) {
        item = this.permissions.create({ code: row.code });
      }
      item.module = row.module;
      item.name = row.name;
      item.description = row.description;
      item.sort = row.sort;
      saved.push(await this.permissions.save(item));
      await this.grantToAdminRole(item);
    }
    return saved;
  }

  async applyRoleChecks(
    checks: Array<{ permissionCode: string; roleCode: string; enabled: boolean }>,
  ) {
    const roles = await this.listAllRoles();
    const permissions = await this.listAllPermissions();
    const roleMap = new Map(
      roles.flatMap((role) => [
        [role.code, role] as const,
        [role.name, role] as const,
      ]),
    );
    const permMap = new Map(permissions.map((item) => [item.code, item]));
    for (const check of checks) {
      const role = roleMap.get(check.roleCode);
      const permission = permMap.get(check.permissionCode);
      if (!role || !permission || role.code === 'admin') {
        continue;
      }
      const exists = await this.rolePermissions.findOne({
        where: { roleId: role.id, permissionId: permission.id },
      });
      if (check.enabled && !exists) {
        await this.rolePermissions.save(
          this.rolePermissions.create({
            roleId: role.id,
            permissionId: permission.id,
          }),
        );
      }
      if (!check.enabled && exists) {
        await this.rolePermissions.remove(exists);
      }
    }
  }

  async replaceRolePermissions(roleId: string, permissions: PermissionEntity[]) {
    const current = await this.rolePermissions.find({ where: { roleId } });
    if (current.length) {
      await this.rolePermissions.remove(current);
    }
    if (!permissions.length) {
      return;
    }
    await this.rolePermissions.save(
      permissions.map((permission) =>
        this.rolePermissions.create({
          roleId,
          permissionId: permission.id,
        }),
      ),
    );
  }

  private async grantToAdminRole(permission: PermissionEntity) {
    const platform = await this.businesses.findOne({ where: { code: PLATFORM_BIZ_CODE } });
    if (platform) {
      const linked = await this.businessPermissions.findOne({
        where: { businessId: platform.id, permissionId: permission.id },
      });
      if (!linked) {
        await this.businessPermissions.save(
          this.businessPermissions.create({ businessId: platform.id, permissionId: permission.id }),
        );
      }
    }
    const admin = await this.roles.findOne({ where: { code: 'admin', businessId: IsNull() } });
    if (!admin) {
      return;
    }
    const exists = await this.rolePermissions.findOne({
      where: { roleId: admin.id, permissionId: permission.id },
    });
    if (exists) {
      return;
    }
    await this.rolePermissions.save(
      this.rolePermissions.create({
        roleId: admin.id,
        permissionId: permission.id,
      }),
    );
  }

  private async requireRole(id: string): Promise<RoleEntity> {
    const role = await this.roles.findOne({ where: { id } });
    if (!role) {
      rpcFail(404, `角色 ${id} 不存在`);
    }
    return role;
  }

  private async requirePermission(id: string): Promise<PermissionEntity> {
    const item = await this.permissions.findOne({ where: { id } });
    if (!item) {
      rpcFail(404, `功能点 ${id} 不存在`);
    }
    return item;
  }

  private async toRoleInfo(role: RoleEntity): Promise<RoleInfo> {
    const links = await this.rolePermissions.find({
      where: { roleId: role.id },
      relations: ['permission'],
    });
    return {
      id: role.id,
      businessId: role.businessId,
      code: role.code,
      name: role.name,
      description: role.description,
      permissionIds: links.map((link) => link.permissionId),
      permissionCodes: links.map((link) => link.permission.code),
    };
  }

  toPermissionInfo(item: PermissionEntity): PermissionInfo {
    return {
      id: item.id,
      module: item.module,
      code: item.code,
      name: item.name,
      description: item.description,
      sort: item.sort,
    };
  }
}
