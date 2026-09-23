import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PageResult, User } from '@app/common';
import { hash } from 'bcrypt';
import { In, Repository } from 'typeorm';
import { AppsService } from '../apps/apps.service';
import {
  AppEntity,
  RoleEntity,
  UserAppEntity,
  UserEntity,
  UserRoleEntity,
} from '../entities';
import { optionalString, requiredString, rpcFail, toPage } from '../rpc';

const PASSWORD_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserAppEntity)
    private readonly userApps: Repository<UserAppEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    private readonly apps: AppsService,
  ) {}

  async findAll(payload: Record<string, unknown>): Promise<PageResult<User>> {
    const { page, pageSize, skip } = toPage(payload.page, payload.pageSize);
    const keyword = optionalString(payload.keyword);
    const appId = optionalString(payload.appId);

    const qb = this.users
      .createQueryBuilder('u')
      .leftJoin(UserAppEntity, 'ua', 'ua.userId = u.id')
      .leftJoin(AppEntity, 'a', 'a.id = ua.appPk')
      .orderBy('u.createdAt', 'DESC')
      .distinct(true);

    if (appId) {
      qb.andWhere('a.appId = :appId', { appId });
    }
    if (keyword) {
      qb.andWhere(
        '(u.username ILIKE :kw OR u.nickname ILIKE :kw OR u.phone ILIKE :kw OR u.email ILIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const total = await qb.clone().getCount();
    const rows = await qb.skip(skip).take(pageSize).getMany();
    const items = await Promise.all(rows.map((row) => this.toPublic(row)));
    return { items, total, page, pageSize };
  }

  async findOne(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      rpcFail(404, `用户 ${id} 不存在`);
    }
    return this.toPublic(user);
  }

  async findEntity(id: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      rpcFail(404, `用户 ${id} 不存在`);
    }
    return user;
  }

  async findByUsernameOrPhone(account: string): Promise<UserEntity | null> {
    return this.users.findOne({
      where: [{ username: account }, { phone: account }],
    });
  }

  async createByAdmin(payload: Record<string, unknown>): Promise<User> {
    const app = await this.apps.requireByAppId(
      requiredString(payload.appId, 'appId'),
    );
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    await this.assertUsernameFree(username);
    const user = await this.createUser({
      username,
      password,
      nickname: optionalString(payload.nickname) ?? username,
      phone: optionalString(payload.phone),
      email: optionalString(payload.email),
    });
    await this.bindApp(user.id, app);
    const roleCodes = Array.isArray(payload.roleCodes)
      ? payload.roleCodes.map(String)
      : ['user'];
    await this.assignRoleCodes(user.id, app.appId, roleCodes);
    return this.toPublic(user);
  }

  async update(payload: Record<string, unknown>): Promise<User> {
    const user = await this.findEntity(requiredString(payload.id, 'id'));
    if (payload.nickname !== undefined) {
      user.nickname = optionalString(payload.nickname) ?? user.nickname;
    }
    if (payload.phone !== undefined) {
      const phone = optionalString(payload.phone) ?? null;
      if (phone && phone !== user.phone) {
        const taken = await this.users.findOne({ where: { phone } });
        if (taken) {
          rpcFail(409, '手机号已被占用');
        }
      }
      user.phone = phone;
    }
    if (payload.email !== undefined) {
      const email = optionalString(payload.email) ?? null;
      if (email && email !== user.email) {
        const taken = await this.users.findOne({ where: { email } });
        if (taken) {
          rpcFail(409, '邮箱已被占用');
        }
      }
      user.email = email;
    }
    if (payload.avatar !== undefined) {
      user.avatar = optionalString(payload.avatar) ?? null;
    }
    if (payload.status !== undefined) {
      user.status = Number(payload.status) === 0 ? 0 : 1;
    }
    if (payload.password) {
      user.passwordHash = await hash(String(payload.password), PASSWORD_ROUNDS);
    }
    user.updatedAt = new Date();
    return this.toPublic(await this.users.save(user));
  }

  async bindAppByPayload(payload: Record<string, unknown>): Promise<User> {
    const user = await this.findEntity(requiredString(payload.id, 'id'));
    const app = await this.apps.requireByAppId(
      requiredString(payload.appId, 'appId'),
    );
    await this.bindApp(user.id, app);
    const roleCodes = Array.isArray(payload.roleCodes)
      ? payload.roleCodes.map(String)
      : ['user'];
    await this.assignRoleCodes(user.id, app.appId, roleCodes);
    return this.toPublic(user);
  }

  async assignRolesByPayload(payload: Record<string, unknown>): Promise<User> {
    const user = await this.findEntity(requiredString(payload.id, 'id'));
    const appId = requiredString(payload.appId, 'appId');
    await this.apps.requireByAppId(appId);
    const roleIds = Array.isArray(payload.roleIds)
      ? payload.roleIds.map(String)
      : [];
    await this.assignRoleIds(user.id, appId, roleIds);
    return this.toPublic(user);
  }

  async createUser(input: {
    username?: string | null;
    password?: string;
    nickname: string;
    phone?: string | null;
    email?: string | null;
    avatar?: string | null;
  }): Promise<UserEntity> {
    const passwordHash = input.password
      ? await hash(input.password, PASSWORD_ROUNDS)
      : null;
    return this.users.save(
      this.users.create({
        username: input.username ?? null,
        passwordHash,
        nickname: input.nickname,
        phone: input.phone ?? null,
        email: input.email ?? null,
        avatar: input.avatar ?? null,
        status: 1,
      }),
    );
  }

  async assertUsernameFree(username: string) {
    const exists = await this.users.findOne({ where: { username } });
    if (exists) {
      rpcFail(409, `用户名 ${username} 已存在`);
    }
  }

  async bindApp(userId: string, app: AppEntity) {
    const exists = await this.userApps.findOne({
      where: { userId, appPk: app.id },
    });
    if (exists) {
      return exists;
    }
    return this.userApps.save(
      this.userApps.create({ userId, appPk: app.id }),
    );
  }

  async isBound(userId: string, appPk: string): Promise<boolean> {
    const row = await this.userApps.findOne({ where: { userId, appPk } });
    return !!row;
  }

  async listAppIds(userId: string): Promise<string[]> {
    const rows = await this.userApps.find({
      where: { userId },
      relations: ['app'],
    });
    return rows.map((row) => row.app.appId);
  }

  async assignRoleCodes(userId: string, appId: string, codes: string[]) {
    const roles = await this.roles.find({
      where: { appId, code: In(codes.length ? codes : ['__none__']) },
    });
    await this.replaceAppRoles(userId, appId, roles);
  }

  async assignRoleIds(userId: string, appId: string, roleIds: string[]) {
    const roles = roleIds.length
      ? await this.roles.find({ where: { id: In(roleIds), appId } })
      : [];
    await this.replaceAppRoles(userId, appId, roles);
  }

  async replaceAppRoles(userId: string, appId: string, next: RoleEntity[]) {
    const current = await this.userRoles.find({
      where: { userId },
      relations: ['role'],
    });
    const stale = current.filter((row) => row.role.appId === appId);
    if (stale.length) {
      await this.userRoles.remove(stale);
    }
    if (!next.length) {
      return;
    }
    await this.userRoles.save(
      next.map((role) => this.userRoles.create({ userId, roleId: role.id })),
    );
  }

  async toPublic(user: UserEntity, appId?: string): Promise<User> {
    const appIds = await this.listAppIds(user.id);
    const result: User = {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      appIds,
    };
    if (appId) {
      const { roles, permissions } = await this.loadRbac(user.id, appId);
      result.roles = roles;
      result.permissions = permissions;
    }
    return result;
  }

  async loadRbac(userId: string, appId: string) {
    const rows = await this.userRoles.find({
      where: { userId },
      relations: ['role'],
    });
    const roles = rows
      .filter((row) => row.role.appId === appId)
      .map((row) => row.role.code);
    return { roles, permissions: [] as string[] };
  }
}
