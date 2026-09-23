import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PERMISSIONS } from '@app/common';
import { hash } from 'bcrypt';
import { Repository } from 'typeorm';
import {
  AppEntity,
  PermissionEntity,
  RoleEntity,
  RolePermissionEntity,
  UserAppEntity,
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
  { module: '用户', code: PERMISSIONS.USER_BIND_APP, name: '绑定应用', description: '把账号开通到其他 appId', sort: 40 },
  { module: '用户', code: PERMISSIONS.USER_ASSIGN_ROLE, name: '分配角色', description: '给用户勾选角色组', sort: 50 },
  { module: '应用', code: PERMISSIONS.APP_MANAGE, name: '管理应用', description: '维护 appId 与微信配置', sort: 60 },
  { module: '角色', code: PERMISSIONS.ROLE_MANAGE, name: '管理角色', description: '维护角色组并勾选功能点', sort: 70 },
  { module: '权限', code: PERMISSIONS.PERMISSION_MANAGE, name: '管理功能点', description: '维护功能点目录', sort: 80 },
  { module: '权限', code: PERMISSIONS.PERMISSION_IMPORT, name: '导入权限', description: 'Excel 导入功能点与角色勾选', sort: 90 },
  { module: '权限', code: PERMISSIONS.PERMISSION_EXPORT, name: '导出权限', description: 'Excel 导出功能点与角色勾选', sort: 100 },
];

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger('UsercenterSeed');

  constructor(
    @InjectRepository(AppEntity)
    private readonly apps: Repository<AppEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserAppEntity)
    private readonly userApps: Repository<UserAppEntity>,
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
    const defaultApp = await this.ensureApp(
      process.env.SEED_APP_ID ?? 'default',
      '默认应用',
      'web',
    );
    const wechatApp = await this.ensureApp('wechat', '微信小程序', 'miniprogram');
    await this.ensureRbac(defaultApp.appId);
    await this.ensureRbac(wechatApp.appId);
    await this.ensureAdmin(defaultApp);
    await this.ensureAdmin(wechatApp);
    this.logger.log(
      `已就绪 appId=${defaultApp.appId}，默认管理员 ${process.env.SEED_ADMIN_USERNAME ?? 'admin'}`,
    );
  }

  private async ensureApp(
    appId: string,
    name: string,
    type: AppEntity['type'],
  ) {
    let app = await this.apps.findOne({ where: { appId } });
    if (!app) {
      app = await this.apps.save(
        this.apps.create({
          appId,
          name,
          type,
          wechatAppId: type === 'miniprogram' ? process.env.WECHAT_APP_ID ?? null : null,
          wechatSecret:
            type === 'miniprogram' ? process.env.WECHAT_SECRET ?? null : null,
          status: 1,
        }),
      );
    }
    return app;
  }

  private async ensureRbac(appId: string) {
    const permissionRows: PermissionEntity[] = [];
    for (const item of DEFAULT_PERMISSIONS) {
      let row = await this.permissions.findOne({
        where: { appId, code: item.code },
      });
      if (!row) {
        row = await this.permissions.save(this.permissions.create({ appId, ...item }));
      }
      permissionRows.push(row);
    }

    const admin =
      (await this.roles.findOne({ where: { appId, code: 'admin' } })) ??
      (await this.roles.save(
        this.roles.create({
          appId,
          code: 'admin',
          name: '管理员',
          description: '拥有全部功能点',
          isSystem: true,
        }),
      ));
    const user =
      (await this.roles.findOne({ where: { appId, code: 'user' } })) ??
      (await this.roles.save(
        this.roles.create({
          appId,
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

  private async ensureAdmin(app: AppEntity) {
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
    const bound = await this.userApps.findOne({
      where: { userId: user.id, appPk: app.id },
    });
    if (!bound) {
      await this.userApps.save(
        this.userApps.create({ userId: user.id, appPk: app.id }),
      );
    }
    const adminRole = await this.roles.findOne({
      where: { appId: app.appId, code: 'admin' },
    });
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
