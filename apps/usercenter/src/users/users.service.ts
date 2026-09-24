import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PageResult, User } from '@app/common';
import { hash } from 'bcrypt';
import { DataSource, In, Repository } from 'typeorm';
import {
  ClientEntity,
  RoleEntity,
  UserEntity,
  UserIdentityEntity,
  UserRoleEntity,
} from '../entities';
import { optionalString, requiredString, rpcFail, toPage } from '../rpc';
import { normalizePhone, pickSurvivor, tryNormalizePhone } from './account-merge';

const PASSWORD_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
    @InjectRepository(UserIdentityEntity)
    private readonly identities: Repository<UserIdentityEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(payload: Record<string, unknown>): Promise<PageResult<User>> {
    const { page, pageSize, skip } = toPage(payload.page, payload.pageSize);
    const keyword = optionalString(payload.keyword);
    const appCode = optionalString(payload.appCode) ?? optionalString(payload.appId);

    const qb = this.users
      .createQueryBuilder('u')
      .leftJoin(UserIdentityEntity, 'i', 'i.userId = u.id')
      .leftJoin(ClientEntity, 'c', 'c.id = i.clientId')
      .orderBy('u.createdAt', 'DESC')
      .distinct(true);

    if (appCode) {
      qb.andWhere('c.appCode = :appCode', { appCode });
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
    return this.toPublic(await this.findEntity(id));
  }

  async findEntity(id: string): Promise<UserEntity> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) {
      rpcFail(404, `用户 ${id} 不存在`);
    }
    return user;
  }

  async findByUsernameOrPhone(account: string): Promise<UserEntity | null> {
    const phone = tryNormalizePhone(account);
    return this.users.findOne({
      where: phone
        ? [{ username: account.trim() }, { phone }]
        : [{ username: account.trim() }],
    });
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { phone } });
  }

  async bindPhone(userId: string, rawPhone: string): Promise<{
    user: UserEntity;
    mergedFromUserId: string | null;
  }> {
    const phone = normalizePhone(rawPhone);
    const current = await this.findEntity(userId);
    if (current.phone === phone) {
      return { user: current, mergedFromUserId: null };
    }

    const owner = await this.findByPhone(phone);
    if (!owner) {
      current.phone = phone;
      current.updatedAt = new Date();
      return { user: await this.users.save(current), mergedFromUserId: null };
    }

    const survivor = pickSurvivor(current, owner);
    const loser = survivor.id === current.id ? owner : current;
    await this.mergeUsers(survivor, loser, phone);
    return {
      user: await this.findEntity(survivor.id),
      mergedFromUserId: loser.id,
    };
  }

  private async mergeUsers(
    survivor: UserEntity,
    loser: UserEntity,
    phone: string,
  ) {
    await this.dataSource.transaction(async (manager) => {
      const identities = manager.getRepository(UserIdentityEntity);
      const userRoles = manager.getRepository(UserRoleEntity);
      const users = manager.getRepository(UserEntity);

      const loserIdentities = await identities.find({
        where: { userId: loser.id },
      });
      for (const identity of loserIdentities) {
        const dup = await identities.findOne({
          where: {
            clientId: identity.clientId,
            provider: identity.provider,
            identifier: identity.identifier,
          },
        });
        if (dup) {
          await identities.remove(identity);
          continue;
        }
        identity.userId = survivor.id;
        await identities.save(identity);
      }

      const loserRoles = await userRoles.find({ where: { userId: loser.id } });
      for (const row of loserRoles) {
        const exists = await userRoles.findOne({
          where: { userId: survivor.id, roleId: row.roleId },
        });
        if (exists) {
          await userRoles.remove(row);
          continue;
        }
        row.userId = survivor.id;
        await userRoles.save(row);
      }

      if (!survivor.username && loser.username) {
        survivor.username = loser.username;
      }
      if (!survivor.passwordHash && loser.passwordHash) {
        survivor.passwordHash = loser.passwordHash;
      }
      if (!survivor.email && loser.email) {
        survivor.email = loser.email;
      }
      if (
        (!survivor.nickname ||
          survivor.nickname === '微信用户' ||
          survivor.nickname === '支付宝用户') &&
        loser.nickname &&
        loser.nickname !== '微信用户' &&
        loser.nickname !== '支付宝用户'
      ) {
        survivor.nickname = loser.nickname;
      }
      if (!survivor.avatar && loser.avatar) {
        survivor.avatar = loser.avatar;
      }

      loser.username = null;
      loser.phone = null;
      loser.email = null;
      await users.save(loser);
      await users.remove(loser);

      survivor.phone = phone;
      survivor.updatedAt = new Date();
      await users.save(survivor);
    });
  }

  async createByAdmin(payload: Record<string, unknown>): Promise<User> {
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    await this.assertUsernameFree(username);
    const rawPhone = optionalString(payload.phone);
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
    if (phone) {
      const taken = await this.findByPhone(phone);
      if (taken) {
        rpcFail(409, '手机号已被占用');
      }
    }
    const user = await this.createUser({
      username,
      password,
      nickname: optionalString(payload.nickname) ?? username,
      phone,
      email: optionalString(payload.email),
    });
    const roleCodes = Array.isArray(payload.roleCodes)
      ? payload.roleCodes.map(String)
      : ['user'];
    await this.assignRoleCodes(user.id, roleCodes);
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
        const normalized = normalizePhone(phone);
        const taken = await this.users.findOne({ where: { phone: normalized } });
        if (taken) {
          rpcFail(409, '手机号已被占用');
        }
        user.phone = normalized;
      } else {
        user.phone = phone;
      }
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

  async assignRolesByPayload(payload: Record<string, unknown>): Promise<User> {
    const user = await this.findEntity(requiredString(payload.id, 'id'));
    const roleIds = Array.isArray(payload.roleIds)
      ? payload.roleIds.map(String)
      : [];
    await this.assignRoleIds(user.id, roleIds);
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
        phone: input.phone ? normalizePhone(input.phone) : null,
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

  async assignRoleCodes(userId: string, codes: string[]) {
    const roles = codes.length
      ? await this.roles.find({ where: { code: In(codes) } })
      : [];
    await this.replaceRoles(userId, roles);
  }

  async assignRoleIds(userId: string, roleIds: string[]) {
    const roles = roleIds.length
      ? await this.roles.find({ where: { id: In(roleIds) } })
      : [];
    await this.replaceRoles(userId, roles);
  }

  async replaceRoles(userId: string, next: RoleEntity[]) {
    const current = await this.userRoles.find({ where: { userId } });
    if (current.length) {
      await this.userRoles.remove(current);
    }
    if (!next.length) {
      return;
    }
    await this.userRoles.save(
      next.map((role) => this.userRoles.create({ userId, roleId: role.id })),
    );
  }

  async toPublic(user: UserEntity): Promise<User> {
    const identityRows = await this.identities.find({
      where: { userId: user.id },
      relations: ['client'],
    });
    const providers = new Set<string>(identityRows.map((row) => row.provider));
    if (user.passwordHash) {
      providers.add('password');
    }
    const appCodes = [
      ...new Set(
        identityRows
          .map((row) => row.client?.appCode)
          .filter((code): code is string => !!code),
      ),
    ];
    return {
      id: user.id,
      username: user.username,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      appCodes,
      providers: [...providers],
    };
  }
}
