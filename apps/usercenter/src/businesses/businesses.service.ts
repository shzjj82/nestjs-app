import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BIZ_REGISTRY_KEY,
  bizApiKeys,
  PLATFORM_BIZ_CODE,
  REDIS,
  TokenStore,
} from '@app/common';
import type {
  BusinessInfo,
  BusinessMemberInfo,
  BusinessRegistryEntry,
} from '@app/common';
import type Redis from 'ioredis';
import { In, Repository } from 'typeorm';
import {
  AccountEntity,
  AccountRoleEntity,
  BusinessEntity,
  BusinessMemberEntity,
  BusinessPermissionEntity,
  PermissionEntity,
  RoleEntity,
} from '../entities';
import { normalizeAppCode } from '../apps/wechat-app-code';
import { optionalString, requiredString, rpcFail } from '../rpc';

@Injectable()
export class BusinessesService implements OnApplicationBootstrap {
  private readonly logger = new Logger('UsercenterBusinesses');

  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
    @InjectRepository(BusinessMemberEntity)
    private readonly members: Repository<BusinessMemberEntity>,
    @InjectRepository(BusinessPermissionEntity)
    private readonly businessPermissions: Repository<BusinessPermissionEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    @InjectRepository(AccountRoleEntity)
    private readonly accountRoles: Repository<AccountRoleEntity>,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly tokens: TokenStore,
  ) {}

  async onApplicationBootstrap() {
    await this.publishRegistry();
  }

  /** 全量重写 Redis 业务注册表，网关据此拦截非法 / 停用业务 */
  async publishRegistry() {
    const rows = await this.businesses.find();
    const pipeline = this.redis.multi().del(BIZ_REGISTRY_KEY);
    for (const row of rows) {
      const entry: BusinessRegistryEntry = {
        code: row.code,
        status: row.status,
        apis: row.apis ?? [],
      };
      pipeline.hset(BIZ_REGISTRY_KEY, row.code, JSON.stringify(entry));
    }
    await pipeline.exec();
    this.logger.log(`业务注册表已发布：${rows.map((row) => row.code).join(', ')}`);
  }

  async findAll(): Promise<BusinessInfo[]> {
    const rows = await this.businesses.find({ order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((row) => this.toInfo(row)));
  }

  async findOne(payload: Record<string, unknown>): Promise<BusinessInfo> {
    return this.toInfo(await this.requireById(requiredString(payload.id, 'id')));
  }

  async requireById(id: string): Promise<BusinessEntity> {
    const row = await this.businesses.findOne({ where: { id } });
    if (!row) {
      rpcFail(404, `业务 ${id} 不存在`);
    }
    return row;
  }

  /** 登录用：业务必须存在且启用 */
  async requireActiveByCode(code: string | undefined): Promise<BusinessEntity> {
    if (!code) {
      rpcFail(400, '缺少业务标识：请求头 X-Biz-Code');
    }
    const row = await this.businesses.findOne({ where: { code } });
    if (!row || row.status !== 1) {
      rpcFail(403, `业务 ${code} 不存在或已停用`);
    }
    return row;
  }

  async create(payload: Record<string, unknown>): Promise<BusinessInfo> {
    const code = normalizeAppCode(requiredString(payload.code, 'code'));
    if (await this.businesses.findOne({ where: { code } })) {
      rpcFail(409, `业务 ${code} 已存在`);
    }
    const business = await this.businesses.save(
      this.businesses.create({
        code,
        name: requiredString(payload.name, 'name'),
        description: optionalString(payload.description) ?? null,
        status: 1,
        apis: this.parseApis(payload.apis),
        isSystem: false,
      }),
    );
    const role = await this.roles.save(
      this.roles.create({
        code: 'user',
        name: '普通用户',
        description: `${business.name} 默认角色`,
        isSystem: true,
        businessId: business.id,
      }),
    );
    business.defaultRoleId = role.id;
    await this.businesses.save(business);
    await this.publishRegistry();
    return this.toInfo(business);
  }

  async update(payload: Record<string, unknown>): Promise<BusinessInfo> {
    const business = await this.requireById(requiredString(payload.id, 'id'));
    if (payload.name) {
      business.name = requiredString(payload.name, 'name');
    }
    if (payload.description !== undefined) {
      business.description = optionalString(payload.description) ?? null;
    }
    if (payload.apis !== undefined) {
      business.apis = this.parseApis(payload.apis);
    }
    if (payload.status !== undefined) {
      const status = Number(payload.status) === 0 ? 0 : 1;
      if (business.isSystem && status === 0) {
        rpcFail(400, '系统业务不能停用');
      }
      business.status = status;
    }
    if (payload.defaultRoleId !== undefined) {
      const roleId = optionalString(payload.defaultRoleId) ?? null;
      if (roleId) {
        const role = await this.roles.findOne({ where: { id: roleId } });
        if (!role || role.businessId !== business.id) {
          rpcFail(400, '默认角色必须属于该业务');
        }
      }
      business.defaultRoleId = roleId;
    }
    business.updatedAt = new Date();
    const saved = await this.businesses.save(business);
    await this.publishRegistry();
    return this.toInfo(saved);
  }

  async setPermissions(payload: Record<string, unknown>): Promise<BusinessInfo> {
    const business = await this.requireById(requiredString(payload.id, 'id'));
    const ids = Array.isArray(payload.permissionIds) ? payload.permissionIds.map(String) : [];
    const permissions = ids.length ? await this.permissions.find({ where: { id: In(ids) } }) : [];
    await this.businessPermissions.delete({ businessId: business.id });
    if (permissions.length) {
      await this.businessPermissions.save(
        permissions.map((permission) =>
          this.businessPermissions.create({ businessId: business.id, permissionId: permission.id }),
        ),
      );
    }
    await this.revokeMembers(business.id);
    return this.toInfo(business);
  }

  async listMembers(payload: Record<string, unknown>): Promise<BusinessMemberInfo[]> {
    const business = await this.requireById(requiredString(payload.id, 'id'));
    const rows = await this.members.find({
      where: { businessId: business.id },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    if (!rows.length) {
      return [];
    }
    const userIds = rows.map((row) => row.userId);
    const accounts = await this.accounts.find({ where: { userId: In(userIds) } });
    const roleRows = accounts.length
      ? await this.accountRoles.find({
          where: { accountId: In(accounts.map((a) => a.id)) },
          relations: ['role'],
        })
      : [];
    return rows.map((row) => {
      const own = accounts.filter((a) => a.userId === row.userId);
      const ownIds = new Set(own.map((a) => a.id));
      const roles = new Map<string, RoleEntity>();
      for (const link of roleRows) {
        if (ownIds.has(link.accountId) && link.role?.businessId === business.id) {
          roles.set(link.role.id, link.role);
        }
      }
      return {
        id: row.id,
        businessId: row.businessId,
        userId: row.userId,
        nickname: row.user?.nickname ?? '',
        username: own.find((a) => a.type === 'password')?.identifier ?? null,
        phone: row.user?.phone ?? null,
        status: row.status,
        roleIds: [...roles.keys()],
        roleNames: [...roles.values()].map((role) => role.name),
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  async updateMember(payload: Record<string, unknown>) {
    const business = await this.requireById(requiredString(payload.id, 'id'));
    const member = await this.members.findOne({
      where: { id: requiredString(payload.memberId, 'memberId'), businessId: business.id },
    });
    if (!member) {
      rpcFail(404, '成员不存在');
    }
    if (payload.status !== undefined) {
      member.status = Number(payload.status) === 0 ? 0 : 1;
      await this.members.save(member);
    }
    if (Array.isArray(payload.roleIds)) {
      const roleIds = payload.roleIds.map(String);
      const roles = roleIds.length
        ? await this.roles.find({ where: { id: In(roleIds), businessId: business.id } })
        : [];
      await this.replaceBusinessRoles(member.userId, business.id, roles);
    }
    await this.tokens.revokeAll(member.userId);
    const [info] = (await this.listMembers({ id: business.id })).filter((m) => m.id === member.id);
    return info;
  }

  /**
   * 登录时确保用户是业务成员：首次登录自动加入并授予默认角色；
   * 被停用的成员拒绝登录。
   */
  async ensureMember(business: BusinessEntity, userId: string, accountId: string) {
    const existing = await this.members.findOne({ where: { businessId: business.id, userId } });
    if (existing) {
      if (existing.status !== 1) {
        rpcFail(403, `你在业务 ${business.code} 中已被停用`);
      }
      return existing;
    }
    const member = await this.members.save(
      this.members.create({ businessId: business.id, userId, status: 1 }),
    );
    if (business.defaultRoleId) {
      const exists = await this.accountRoles.findOne({
        where: { accountId, roleId: business.defaultRoleId },
      });
      if (!exists) {
        await this.accountRoles.save(
          this.accountRoles.create({ accountId, roleId: business.defaultRoleId }),
        );
      }
    }
    return member;
  }

  /** 该业务能力包内的功能点 code；平台业务默认拥有全部 */
  async permissionCodes(businessId: string): Promise<Set<string>> {
    const links = await this.businessPermissions.find({
      where: { businessId },
      relations: ['permission'],
    });
    return new Set(links.map((link) => link.permission.code));
  }

  /** 新建功能点时自动并入平台业务能力包 */
  async grantToPlatform(permissionId: string) {
    const platform = await this.businesses.findOne({ where: { code: PLATFORM_BIZ_CODE } });
    if (!platform) {
      return;
    }
    const exists = await this.businessPermissions.findOne({
      where: { businessId: platform.id, permissionId },
    });
    if (!exists) {
      await this.businessPermissions.save(
        this.businessPermissions.create({ businessId: platform.id, permissionId }),
      );
    }
  }

  private async replaceBusinessRoles(userId: string, businessId: string, next: RoleEntity[]) {
    const accounts = await this.accounts.find({ where: { userId } });
    if (!accounts.length) {
      return;
    }
    const accountIds = accounts.map((a) => a.id);
    const current = await this.accountRoles.find({
      where: { accountId: In(accountIds) },
      relations: ['role'],
    });
    const stale = current.filter((link) => link.role?.businessId === businessId);
    if (stale.length) {
      await this.accountRoles.remove(stale);
    }
    if (!next.length) {
      return;
    }
    // 业务角色按用户生效，挂在该用户最早的账户上即可
    const primary = [...accounts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    await this.accountRoles.save(
      next.map((role) => this.accountRoles.create({ accountId: primary.id, roleId: role.id })),
    );
  }

  private async revokeMembers(businessId: string) {
    const rows = await this.members.find({ where: { businessId } });
    for (const row of rows) {
      await this.tokens.revokeAll(row.userId);
    }
  }

  private parseApis(value: unknown): string[] {
    const list = Array.isArray(value) ? value.map(String) : [];
    return bizApiKeys().filter((key) => list.includes(key));
  }

  private async toInfo(row: BusinessEntity): Promise<BusinessInfo> {
    const [links, memberCount] = await Promise.all([
      this.businessPermissions.find({ where: { businessId: row.id } }),
      this.members.count({ where: { businessId: row.id } }),
    ]);
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      apis: row.apis ?? [],
      defaultRoleId: row.defaultRoleId,
      isSystem: row.isSystem,
      permissionIds: links.map((link) => link.permissionId),
      memberCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
