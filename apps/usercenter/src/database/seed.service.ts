import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PERMISSIONS, PLATFORM_BIZ_CODE } from '@app/common';
import { hash } from 'bcrypt';
import { IsNull, Not, Repository } from 'typeorm';
import type { ClientType } from '../entities';
import {
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
} from '../entities';

const DEFAULT_PERMISSIONS: Array<{
  module: string;
  code: string;
  name: string;
  description: string;
  sort: number;
}> = [
  { module: '用户', code: PERMISSIONS.USER_QUERY, name: '查询用户', description: '查看用户列表与详情', sort: 10 },
  { module: '用户', code: PERMISSIONS.USER_CREATE, name: '创建用户', description: '后台创建用户', sort: 20 },
  { module: '用户', code: PERMISSIONS.USER_UPDATE, name: '更新用户', description: '编辑用户资料', sort: 30 },
  { module: '用户', code: PERMISSIONS.USER_ASSIGN_ROLE, name: '分配角色', description: '给账户勾选角色组', sort: 50 },
  { module: '业务', code: PERMISSIONS.BUSINESS_MANAGE, name: '管理业务', description: '维护业务、成员与业务能力包', sort: 55 },
  { module: '接入端', code: PERMISSIONS.CLIENT_MANAGE, name: '管理接入端', description: '维护 Web / 微信 / 支付宝小程序', sort: 60 },
  { module: '角色', code: PERMISSIONS.ROLE_MANAGE, name: '管理角色', description: '维护平台与业务角色组并勾选功能点', sort: 70 },
  { module: '权限', code: PERMISSIONS.PERMISSION_MANAGE, name: '管理功能点', description: '维护全局功能点目录', sort: 80 },
  { module: '权限', code: PERMISSIONS.PERMISSION_IMPORT, name: '导入权限', description: 'Excel 导入功能点与角色勾选', sort: 90 },
  { module: '权限', code: PERMISSIONS.PERMISSION_EXPORT, name: '导出权限', description: 'Excel 导出功能点与角色勾选', sort: 100 },
  { module: '微信', code: PERMISSIONS.WECHAT_MANAGE, name: '管理小程序', description: '登记多套微信小程序 appId / secret', sort: 110 },
  { module: '微信', code: PERMISSIONS.WECHAT_QRCODE, name: '生成小程序码', description: '按小程序生成 QR 码', sort: 120 },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('UsercenterSeed');

  constructor(
    @InjectRepository(BusinessEntity)
    private readonly businesses: Repository<BusinessEntity>,
    @InjectRepository(BusinessMemberEntity)
    private readonly members: Repository<BusinessMemberEntity>,
    @InjectRepository(BusinessPermissionEntity)
    private readonly businessPermissions: Repository<BusinessPermissionEntity>,
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
    this.logger.log(
      `已就绪，平台业务 ${PLATFORM_BIZ_CODE}，默认管理员 ${process.env.SEED_ADMIN_USERNAME ?? 'admin'}`,
    );
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
    for (const item of DEFAULT_PERMISSIONS) {
      if (!(await this.permissions.findOne({ where: { code: item.code } }))) {
        await this.permissions.save(this.permissions.create(item));
      }
    }
    const allPermissions = await this.permissions.find();

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

    for (const permission of allPermissions) {
      await this.link(this.rolePermissions, { roleId: admin.id, permissionId: permission.id });
      await this.link(this.businessPermissions, {
        businessId: platform.id,
        permissionId: permission.id,
      });
    }

    const userView = allPermissions.find((item) => item.code === PERMISSIONS.USER_QUERY);
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
