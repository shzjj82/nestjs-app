import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DEFAULT_FEATURE_CATALOG, PERMISSIONS, PLATFORM_BIZ_CODE } from '@app/common';
import { hash } from 'bcrypt';
import { In, IsNull, Not, Repository } from 'typeorm';
import type { ClientType } from '../entities';
import {
  AccountEntity,
  AccountRoleEntity,
  BusinessEntity,
  BusinessMemberEntity,
  ClientEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
} from '../entities';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('UsercenterSeed');

  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
    @InjectRepository(BusinessMemberEntity)
    private readonly members: Repository<BusinessMemberEntity>,
    @InjectRepository(ClientEntity)
    private readonly clients: Repository<ClientEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissions: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissions: Repository<RolePermissionEntity>,
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    @InjectRepository(AccountRoleEntity)
    private readonly accountRoles: Repository<AccountRoleEntity>,
  ) {}

  async onModuleInit() {
    const platform = await this.ensurePlatform();
    await this.ensureClient(
      process.env.SEED_APP_CODE ?? process.env.SEED_APP_ID ?? 'web',
      'Web 账密',
      'web',
      platform.id,
    );
    await this.ensureClient('wechat', '默认微信小程序', 'wechat_mp', platform.id, {
      wechatAppId: process.env.WECHAT_APP_ID ?? null,
    });
    await this.ensureClient('alipay', '默认支付宝小程序', 'alipay_mp', platform.id, {
      alipayAppId: process.env.ALIPAY_APP_ID ?? null,
      alipayPrivateKey: process.env.ALIPAY_PRIVATE_KEY ?? null,
    });
    await this.ensureRbac(platform);
    await this.ensureAdmin(platform);
    await this.ensureRecycleCustomerDefault();
    this.logger.log(
      `已就绪，平台业务 ${PLATFORM_BIZ_CODE}，默认管理员 ${process.env.SEED_ADMIN_USERNAME ?? 'admin'}`,
    );
  }

  /**
   * 回收业务：C 端默认身份是 customer（客户），与「普通用户」重复。
   * 启动时把 defaultRole 切到客户，并把旧 user 角色持有者迁过去后删除。
   */
  private async ensureRecycleCustomerDefault() {
    const recycle = await this.businesses.findOne({ where: { code: 'recycle' } });
    if (!recycle) return;

    let customer = await this.roles.findOne({
      where: { businessId: recycle.id, code: 'customer' },
    });
    if (!customer) {
      customer = await this.roles.save(
        this.roles.create({
          code: 'customer',
          name: '客户',
          description: '回收 C 端默认身份（下单、报价、收款）',
          isSystem: true,
          businessId: recycle.id,
        }),
      );
    } else {
      let dirty = false;
      if (customer.name !== '客户') {
        customer.name = '客户';
        dirty = true;
      }
      if (!customer.description) {
        customer.description = '回收 C 端默认身份（下单、报价、收款）';
        dirty = true;
      }
      if (!customer.isSystem) {
        customer.isSystem = true;
        dirty = true;
      }
      if (dirty) await this.roles.save(customer);
    }

    if (recycle.defaultRoleId !== customer.id) {
      recycle.defaultRoleId = customer.id;
      await this.businesses.save(recycle);
    }

    const legacyUser = await this.roles.findOne({
      where: { businessId: recycle.id, code: 'user' },
    });
    if (!legacyUser) return;

    const links = await this.accountRoles.find({ where: { roleId: legacyUser.id } });
    for (const link of links) {
      const hasCustomer = await this.accountRoles.findOne({
        where: { accountId: link.accountId, roleId: customer.id },
      });
      if (!hasCustomer) {
        await this.accountRoles.save(
          this.accountRoles.create({ accountId: link.accountId, roleId: customer.id }),
        );
      }
      await this.accountRoles.remove(link);
    }
    await this.roles.remove(legacyUser);
    this.logger.log('recycle：默认身份已合并为「客户」，已移除重复的「普通用户」');
  }

  private async ensurePlatform(): Promise<BusinessEntity> {
    const existing = await this.businesses.findOne({ where: { code: PLATFORM_BIZ_CODE } });
    if (existing) {
      if (!existing.isSystem || existing.status !== 1) {
        existing.isSystem = true;
        existing.status = 1;
        return this.businesses.save(existing);
      }
      return existing;
    }
    return this.businesses.save(
      this.businesses.create({
        code: PLATFORM_BIZ_CODE,
        name: '平台',
        description: 'admin 控制台；平台管理接口只接受该业务会话',
        status: 1,
        defaultRoleId: null,
        isSystem: true,
      }),
    );
  }

  private async ensureClient(
    appCode: string,
    name: string,
    type: ClientType,
    businessId: string,
    extras: Partial<ClientEntity> = {},
  ) {
    let client = await this.clients.findOne({ where: { appCode } });
    if (!client) {
      client = await this.clients.save(
        this.clients.create({
          appCode,
          name,
          type,
          status: 1,
          businessId,
          ...extras,
        }),
      );
    } else if (!client.businessId) {
      client.businessId = businessId;
      client = await this.clients.save(client);
    }
    return client;
  }

  private async ensureRbac(platform: BusinessEntity) {
    for (const item of DEFAULT_FEATURE_CATALOG) {
      const existing = await this.permissions.findOne({ where: { code: item.code } });
      if (!existing) {
        await this.permissions.save(
          this.permissions.create({
            scope: item.scope,
            module: item.module,
            code: item.code,
            name: item.name,
            description: item.description,
            sort: item.sort,
            apis: item.apis,
            adminOnly: item.adminOnly === true,
          }),
        );
        continue;
      }
      // 同步分类 / 文案 / 接口绑定，保证后台与 Excel 目录一致
      const nextApis = JSON.stringify([...(item.apis ?? [])].sort());
      const prevApis = JSON.stringify([...(existing.apis ?? [])].sort());
      const adminOnly = item.adminOnly === true;
      if (
        existing.scope !== item.scope ||
        existing.module !== item.module ||
        existing.name !== item.name ||
        existing.description !== item.description ||
        existing.sort !== item.sort ||
        existing.adminOnly !== adminOnly ||
        nextApis !== prevApis
      ) {
        existing.scope = item.scope;
        existing.module = item.module;
        existing.name = item.name;
        existing.description = item.description;
        existing.sort = item.sort;
        existing.apis = item.apis;
        existing.adminOnly = adminOnly;
        await this.permissions.save(existing);
      }
    }
    const allPermissions = await this.permissions.find();
    const platformPermissions = allPermissions.filter((item) => item.scope !== 'business');
    const assignablePermissions = platformPermissions.filter((item) => !item.adminOnly);

    const admin =
      (await this.roles.findOne({ where: { code: 'admin', businessId: IsNull() } })) ??
      (await this.roles.save(
        this.roles.create({
          code: 'admin',
          name: '超级管理员',
          description: '平台级角色，在所有业务中拥有全部功能点',
          isSystem: true,
          businessId: null,
        }),
      ));

    // 除超级管理员外，旧的全局角色都归到平台业务下
    const legacy = await this.roles.find({
      where: { businessId: IsNull(), id: Not(admin.id) },
    });
    for (const role of legacy) {
      role.businessId = platform.id;
      await this.roles.save(role);
    }

    const user =
      (await this.roles.findOne({ where: { code: 'user', businessId: platform.id } })) ??
      (await this.roles.save(
        this.roles.create({
          code: 'user',
          name: '普通用户',
          description: '平台普通用户',
          isSystem: true,
          businessId: platform.id,
        }),
      ));

    // 超管拥有全部平台功能点（含仅超管）
    for (const permission of platformPermissions) {
      await this.link(this.rolePermissions, { roleId: admin.id, permissionId: permission.id });
    }

    // 仅超管功能点不得挂在其他角色上
    const adminOnlyIds = platformPermissions
      .filter((item) => item.adminOnly)
      .map((item) => item.id);
    if (adminOnlyIds.length) {
      const leaked = await this.rolePermissions.find({
        where: { permissionId: In(adminOnlyIds) },
      });
      const stale = leaked.filter((link) => link.roleId !== admin.id);
      if (stale.length) {
        await this.rolePermissions.remove(stale);
      }
    }

    const userView = assignablePermissions.find((item) => item.code === PERMISSIONS.USER_QUERY);
    if (userView) {
      await this.link(this.rolePermissions, { roleId: user.id, permissionId: userView.id });
    }
  }

  private async ensureAdmin(platform: BusinessEntity) {
    const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
    let account = await this.accounts.findOne({
      where: { type: 'password', identifier: username, clientId: IsNull() },
    });
    if (!account) {
      const user = await this.users.save(
        this.users.create({ nickname: '管理员', status: 1 }),
      );
      account = await this.accounts.save(
        this.accounts.create({
          userId: user.id,
          type: 'password',
          identifier: username,
          passwordHash: await hash(password, 10),
          clientId: null,
          status: 1,
        }),
      );
    }
    const adminRole = await this.roles.findOne({ where: { code: 'admin', businessId: IsNull() } });
    if (adminRole) {
      await this.link(this.accountRoles, { accountId: account.id, roleId: adminRole.id });
    }
    await this.link(this.members, { businessId: platform.id, userId: account.userId });
  }

  private async link<T extends object>(repo: Repository<T>, where: Partial<T>) {
    const exists = await repo.findOne({ where: where as never });
    if (!exists) {
      await repo.save(repo.create(where as never));
    }
  }
}
