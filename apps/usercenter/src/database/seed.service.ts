import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PERMISSIONS } from '@app/common';
import { hash } from 'bcrypt';
import { Repository } from 'typeorm';
import type { ClientType } from '../entities';
import {
  ClientEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserEntity,
  UserRoleEntity,
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
  { module: '用户', code: PERMISSIONS.USER_ASSIGN_ROLE, name: '分配角色', description: '给用户勾选角色组', sort: 50 },
  { module: '接入端', code: PERMISSIONS.CLIENT_MANAGE, name: '管理接入端', description: '维护 Web / 微信 / 支付宝小程序', sort: 60 },
  { module: '角色', code: PERMISSIONS.ROLE_MANAGE, name: '管理角色', description: '维护全局角色组并勾选功能点', sort: 70 },
  { module: '权限', code: PERMISSIONS.PERMISSION_MANAGE, name: '管理功能点', description: '维护全局功能点目录', sort: 80 },
  { module: '权限', code: PERMISSIONS.PERMISSION_IMPORT, name: '导入权限', description: 'Excel 导入功能点与角色勾选', sort: 90 },
  { module: '权限', code: PERMISSIONS.PERMISSION_EXPORT, name: '导出权限', description: 'Excel 导出功能点与角色勾选', sort: 100 },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('UsercenterSeed');

  constructor(
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
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
  ) {}

  async onModuleInit() {
    await this.ensureClient(
      process.env.SEED_APP_CODE ?? process.env.SEED_APP_ID ?? 'web',
      'Web 账密',
      'web',
    );
    await this.ensureClient('wechat', '默认微信小程序', 'wechat_mp', {
      wechatAppId: process.env.WECHAT_APP_ID ?? (process.env.WECHAT_MOCK === '1' ? 'wechat' : null),
      wechatSecret: process.env.WECHAT_SECRET ?? (process.env.WECHAT_MOCK === '1' ? 'mock-secret' : null),
    });
    await this.ensureClient('alipay', '默认支付宝小程序', 'alipay_mp', {
      alipayAppId: process.env.ALIPAY_APP_ID ?? (process.env.ALIPAY_MOCK === '1' || process.env.WECHAT_MOCK === '1' ? 'alipay' : null),
      alipayPrivateKey:
        process.env.ALIPAY_PRIVATE_KEY ??
        (process.env.ALIPAY_MOCK === '1' || process.env.WECHAT_MOCK === '1' ? 'mock-secret' : null),
    });
    await this.ensureRbac();
    await this.ensureAdmin();
    this.logger.log(
      `已就绪，全局一套权限，默认管理员 ${process.env.SEED_ADMIN_USERNAME ?? 'admin'}`,
    );
  }

  private async ensureClient(
    appCode: string,
    name: string,
    type: ClientType,
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
          ...extras,
        }),
      );
    }
    return client;
  }

  private async ensureRbac() {
    const permissionRows: PermissionEntity[] = [];
    for (const item of DEFAULT_PERMISSIONS) {
      let row = await this.permissions.findOne({ where: { code: item.code } });
      if (!row) {
        row = await this.permissions.save(this.permissions.create(item));
      }
      permissionRows.push(row);
    }

    const admin =
      (await this.roles.findOne({ where: { code: 'admin' } })) ??
      (await this.roles.save(
        this.roles.create({
          code: 'admin',
          name: '管理员',
          description: '拥有全部功能点',
          isSystem: true,
        }),
      ));
    const user =
      (await this.roles.findOne({ where: { code: 'user' } })) ??
      (await this.roles.save(
        this.roles.create({
          code: 'user',
          name: '普通用户',
          description: '默认可查询自己相关数据',
          isSystem: true,
        }),
      ));

    for (const permission of permissionRows) {
      const exists = await this.rolePermissions.findOne({
        where: { roleId: admin.id, permissionId: permission.id },
      });
      if (!exists) {
        await this.rolePermissions.save(
          this.rolePermissions.create({
            roleId: admin.id,
            permissionId: permission.id,
          }),
        );
      }
    }

    const userView = permissionRows.find((item) => item.code === PERMISSIONS.USER_QUERY);
    if (userView) {
      const exists = await this.rolePermissions.findOne({
        where: { roleId: user.id, permissionId: userView.id },
      });
      if (!exists) {
        await this.rolePermissions.save(
          this.rolePermissions.create({
            roleId: user.id,
            permissionId: userView.id,
          }),
        );
      }
    }
  }

  private async ensureAdmin() {
    const username = process.env.SEED_ADMIN_USERNAME ?? 'admin';
    const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
    let user = await this.users.findOne({ where: { username } });
    if (!user) {
      user = await this.users.save(
        this.users.create({
          username,
          passwordHash: await hash(password, 10),
          nickname: '管理员',
          status: 1,
        }),
      );
    }
    const adminRole = await this.roles.findOne({ where: { code: 'admin' } });
    if (adminRole) {
      const assigned = await this.userRoles.findOne({
        where: { userId: user.id, roleId: adminRole.id },
      });
      if (!assigned) {
        await this.userRoles.save(
          this.userRoles.create({ userId: user.id, roleId: adminRole.id }),
        );
      }
    }
  }
}
