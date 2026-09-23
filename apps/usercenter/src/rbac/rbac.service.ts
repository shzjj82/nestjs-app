import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PermissionInfo, RoleInfo } from '@app/common';
import { In, Repository } from 'typeorm';
import { AppsService } from '../apps/apps.service';
import {
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserRoleEntity,
} from '../entities';
import { optionalString, requiredString, rpcFail } from '../rpc';

@Injectable()
export class RbacService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
    private readonly apps: AppsService,
  ) {}

  async loadUserRbac(userId: string, appId: string) {
    const rows = await this.userRoles.find({
      where: { userId },
      relations: ['role'],
    });
    const appRoles = rows.filter((row) => row.role.appId === appId);
    const roles = appRoles.map((row) => row.role.code);
    const roleIds = appRoles.map((row) => row.roleId);
    if (!roleIds.length) {
      return { roles, permissions: [] as string[] };
    }
    const links = await this.rolePermissions.find({
      where: { roleId: In(roleIds) },
      relations: ['permission'],
    });
    const permissions = [
      ...new Set(links.map((link) => link.permission.code)),
    ];
    return { roles, permissions };
  }

  async listRoles(payload: Record<string, unknown>): Promise<RoleInfo[]> {
    const appId = requiredString(payload.appId, 'appId');
    await this.apps.requireByAppId(appId);
    const roles = await this.roles.find({
      where: { appId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(roles.map((role) => this.toRoleInfo(role)));
  }

  async createRole(payload: Record<string, unknown>): Promise<RoleInfo> {
    const appId = requiredString(payload.appId, 'appId');
    await this.apps.requireByAppId(appId);
    const code = requiredString(payload.code, 'code');
    const name = requiredString(payload.name, 'name');
    const exists = await this.roles.findOne({ where: { appId, code } });
    if (exists) {
      rpcFail(409, `角色 ${code} 已存在`);
    }
    const saved = await this.roles.save(
      this.roles.create({
        appId,
        code,
        name,
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
    await this.roles.remove(role);
    return { ok: true };
  }

  async setRolePermissions(payload: Record<string, unknown>): Promise<RoleInfo> {
    const role = await this.requireRole(requiredString(payload.id, 'id'));
    const permissionIds = Array.isArray(payload.permissionIds)
      ? payload.permissionIds.map(String)
      : [];
    const permissions = permissionIds.length
      ? await this.permissions.find({
          where: { id: In(permissionIds), appId: role.appId },
        })
      : [];
    await this.replaceRolePermissions(role.id, permissions);
    return this.toRoleInfo(role);
  }

  async listPermissions(payload: Record<string, unknown>): Promise<PermissionInfo[]> {
    const appId = requiredString(payload.appId, 'appId');
    await this.apps.requireByAppId(appId);
    const rows = await this.permissions.find({
      where: { appId },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toPermissionInfo(row));
  }

  async createPermission(payload: Record<string, unknown>): Promise<PermissionInfo> {
    const appId = requiredString(payload.appId, 'appId');
    await this.apps.requireByAppId(appId);
    const code = requiredString(payload.code, 'code');
    const name = requiredString(payload.name, 'name');
    const exists = await this.permissions.findOne({ where: { appId, code } });
    if (exists) {
      rpcFail(409, `功能点 ${code} 已存在`);
    }
    const saved = await this.permissions.save(
      this.permissions.create({
        appId,
        code,
        name,
        module: optionalString(payload.module) ?? '默认',
        description: optionalString(payload.description) ?? null,
        sort: Number(payload.sort) || 0,
      }),
    );
    await this.grantToAdminRole(appId, saved);
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

  async listRolesByApp(appId: string): Promise<RoleEntity[]> {
    return this.roles.find({ where: { appId }, order: { createdAt: 'ASC' } });
  }

  async listPermissionsByApp(appId: string): Promise<PermissionEntity[]> {
    return this.permissions.find({
      where: { appId },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
  }

  async listRolePermissionMatrix(appId: string) {
    const roles = await this.listRolesByApp(appId);
    const permissions = await this.listPermissionsByApp(appId);
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
    appId: string,
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
      let item = await this.permissions.findOne({
        where: { appId, code: row.code },
      });
      if (!item) {
        item = this.permissions.create({ appId, code: row.code });
      }
      item.module = row.module;
      item.name = row.name;
      item.description = row.description;
      item.sort = row.sort;
      saved.push(await this.permissions.save(item));
      await this.grantToAdminRole(appId, item);
    }
    return saved;
  }

  async applyRoleChecks(
    appId: string,
    checks: Array<{ permissionCode: string; roleCode: string; enabled: boolean }>,
  ) {
    const roles = await this.listRolesByApp(appId);
    const permissions = await this.listPermissionsByApp(appId);
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

  private async grantToAdminRole(appId: string, permission: PermissionEntity) {
    const admin = await this.roles.findOne({ where: { appId, code: 'admin' } });
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
      appId: role.appId,
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
      appId: item.appId,
      module: item.module,
      code: item.code,
      name: item.name,
      description: item.description,
      sort: item.sort,
    };
  }
}
