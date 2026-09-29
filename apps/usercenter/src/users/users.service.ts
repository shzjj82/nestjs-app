import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { PageResult, User } from '@app/common';
import { DataSource, Repository } from 'typeorm';
import { AccountEntity, UserEntity } from '../entities';
import { optionalString, requiredString, rpcFail, toPage } from '../rpc';
import { normalizePhone, pickSurvivor, tryNormalizePhone } from './account-merge';
import { AccountsService } from './accounts.service';

const PLACEHOLDER_NICKNAMES = new Set(['', '微信用户', '支付宝用户']);

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly accounts: AccountsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(payload: Record<string, unknown>): Promise<PageResult<User>> {
    const { page, pageSize, skip } = toPage(payload.page, payload.pageSize);
    const keyword = optionalString(payload.keyword);
    const roleCodes = stringList(payload.role);
    const statuses = stringList(payload.status)
      .map((s) => Number(s))
      .filter((n) => n === 0 || n === 1);

    const qb = this.users
      .createQueryBuilder('u')
      .orderBy('u.createdAt', 'DESC');

    if (statuses.length > 0) {
      qb.andWhere('u.status IN (:...statuses)', { statuses });
    }
    if (keyword) {
      qb.andWhere(
        `(u.nickname ILIKE :kw OR u.phone ILIKE :kw OR u.email ILIKE :kw OR EXISTS (
          SELECT 1 FROM uc_accounts a WHERE a.user_id = u.id AND a.identifier ILIKE :kw
        ))`,
        { kw: `%${keyword}%` },
      );
    }
    if (roleCodes.length > 0) {
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM uc_accounts a
          JOIN uc_account_roles ar ON ar.account_id = a.id
          JOIN uc_roles r ON r.id = ar.role_id
          WHERE a.user_id = u.id AND r.code IN (:...roleCodes)
        )`,
        { roleCodes },
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

  /** 登录名或手机号 → 账密账户 */
  async findPasswordAccount(login: string): Promise<AccountEntity | null> {
    const byIdentifier = await this.accounts.findPassword(login);
    if (byIdentifier) {
      return byIdentifier;
    }
    const phone = tryNormalizePhone(login);
    if (!phone) {
      return null;
    }
    const user = await this.findByPhone(phone);
    return user ? this.accounts.findPasswordByUser(user.id) : null;
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

    const survivor = pickSurvivor(
      { user: current, hasPasswordAccount: !!(await this.accounts.findPasswordByUser(current.id)) },
      { user: owner, hasPasswordAccount: !!(await this.accounts.findPasswordByUser(owner.id)) },
    );
    const loser = survivor.id === current.id ? owner : current;
    await this.mergeUsers(survivor, loser, phone);
    return {
      user: await this.findEntity(survivor.id),
      mergedFromUserId: loser.id,
    };
  }

  private async mergeUsers(survivor: UserEntity, loser: UserEntity, phone: string) {
    await this.dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository(AccountEntity);
      const users = manager.getRepository(UserEntity);

      await accounts.update(
        { userId: loser.id },
        { userId: survivor.id, updatedAt: new Date() },
      );

      if (!survivor.email && loser.email) {
        survivor.email = loser.email;
      }
      if (
        PLACEHOLDER_NICKNAMES.has(survivor.nickname ?? '') &&
        loser.nickname &&
        !PLACEHOLDER_NICKNAMES.has(loser.nickname)
      ) {
        survivor.nickname = loser.nickname;
      }
      if (!survivor.avatar && loser.avatar) {
        survivor.avatar = loser.avatar;
      }

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
    await this.accounts.assertIdentifierFree(username);
    const rawPhone = optionalString(payload.phone);
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
    if (phone && (await this.findByPhone(phone))) {
      rpcFail(409, '手机号已被占用');
    }
    const user = await this.createUser({
      nickname: optionalString(payload.nickname) ?? username,
      phone,
      email: optionalString(payload.email),
    });
    const account = await this.accounts.createPassword(user.id, username, password);
    const roleCodes = Array.isArray(payload.roleCodes)
      ? payload.roleCodes.map(String)
      : ['user'];
    await this.accounts.assignRoleCodes(account.id, roleCodes);
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
        if (await this.findByPhone(normalized)) {
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
    user.updatedAt = new Date();
    return this.toPublic(await this.users.save(user));
  }

  async updateAccount(payload: Record<string, unknown>): Promise<User> {
    const account = await this.accounts.update(payload);
    return this.findOne(account.userId);
  }

  async assignAccountRoles(payload: Record<string, unknown>): Promise<User> {
    const account = await this.accounts.findEntity(requiredString(payload.id, 'id'));
    const roleIds = Array.isArray(payload.roleIds) ? payload.roleIds.map(String) : [];
    await this.accounts.assignRoleIds(account.id, roleIds);
    return this.findOne(account.userId);
  }

  async createUser(input: {
    nickname: string;
    phone?: string | null;
    email?: string | null;
    avatar?: string | null;
  }): Promise<UserEntity> {
    return this.users.save(
      this.users.create({
        nickname: input.nickname,
        phone: input.phone ? normalizePhone(input.phone) : null,
        email: input.email ?? null,
        avatar: input.avatar ?? null,
        status: 1,
      }),
    );
  }

  async toPublic(user: UserEntity): Promise<User> {
    const accounts = await this.accounts.toInfoList(
      await this.accounts.listByUser(user.id),
    );
    return {
      id: user.id,
      username: accounts.find((a) => a.type === 'password')?.identifier ?? null,
      nickname: user.nickname,
      phone: user.phone,
      email: user.email,
      avatar: user.avatar,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      accounts,
    };
  }
}

function stringList(value: unknown): string[] {
  if (value == null || value === '') return [];
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) return [];
  if (text.includes(',')) {
    return text.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [text];
}
