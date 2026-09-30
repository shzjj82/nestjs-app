import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PLATFORM_BIZ_CODE } from '@app/common';
import type { UserAccountInfo } from '@app/common';
import { hash } from 'bcrypt';
import { In, IsNull, Repository } from 'typeorm';
import {
  AccountEntity,
  AccountRoleEntity,
  RoleEntity,
  type AccountType,
} from '../entities';
import { requiredString, rpcFail } from '../rpc';

const PASSWORD_ROUNDS = 10;

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accounts: Repository<AccountEntity>,
    @InjectRepository(AccountRoleEntity)
    private readonly accountRoles: Repository<AccountRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roles: Repository<RoleEntity>,
  ) {}

  async findEntity(id: string): Promise<AccountEntity> {
    const account = await this.accounts.findOne({ where: { id } });
    if (!account) {
      rpcFail(404, `账户 ${id} 不存在`);
    }
    return account;
  }

  listByUser(userId: string): Promise<AccountEntity[]> {
    return this.accounts.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  findPassword(identifier: string): Promise<AccountEntity | null> {
    return this.accounts.findOne({
      where: { type: 'password', identifier: identifier.trim(), clientId: IsNull() },
    });
  }

  findPasswordByUser(userId: string): Promise<AccountEntity | null> {
    return this.accounts.findOne({ where: { userId, type: 'password' } });
  }

  findExternal(type: AccountType, clientId: string, identifier: string) {
    return this.accounts.findOne({ where: { type, clientId, identifier } });
  }

  findByUnionid(type: AccountType, unionid: string) {
    return this.accounts.findOne({ where: { type, unionid } });
  }

  async assertIdentifierFree(identifier: string) {
    if (await this.findPassword(identifier)) {
      rpcFail(409, `登录名 ${identifier} 已存在`);
    }
  }

  async createPassword(userId: string, identifier: string, password: string) {
    await this.assertIdentifierFree(identifier);
    return this.accounts.save(
      this.accounts.create({
        userId,
        type: 'password',
        identifier,
        passwordHash: await hash(password, PASSWORD_ROUNDS),
        clientId: null,
        unionid: null,
        status: 1,
      }),
    );
  }

  createExternal(input: {
    userId: string;
    type: AccountType;
    clientId: string;
    identifier: string;
    unionid?: string | null;
  }) {
    return this.accounts.save(
      this.accounts.create({
        userId: input.userId,
        type: input.type,
        clientId: input.clientId,
        identifier: input.identifier,
        unionid: input.unionid ?? null,
        passwordHash: null,
        status: 1,
      }),
    );
  }

  async setPassword(account: AccountEntity, password: string) {
    account.passwordHash = await hash(password, PASSWORD_ROUNDS);
    account.updatedAt = new Date();
    return this.accounts.save(account);
  }

  async touchLogin(account: AccountEntity) {
    await this.accounts.update(account.id, { lastLoginAt: new Date() });
  }

  async update(payload: Record<string, unknown>): Promise<AccountEntity> {
    const account = await this.findEntity(requiredString(payload.id, 'id'));
    if (payload.status !== undefined) {
      account.status = Number(payload.status) === 0 ? 0 : 1;
    }
    if (payload.password) {
      if (account.type !== 'password') {
        rpcFail(400, '仅账密账户可设置密码');
      }
      const password = String(payload.password);
      if (password.length < 6 || password.length > 64) {
        rpcFail(400, '密码长度需为 6-64');
      }
      account.passwordHash = await hash(password, PASSWORD_ROUNDS);
    }
    account.updatedAt = new Date();
    return this.accounts.save(account);
  }

  /** 按 code 分配平台范围的角色（平台级 + 平台业务），业务角色请用 id 分配 */
  async assignRoleCodes(accountId: string, codes: string[]) {
    const roles = codes.length
      ? await this.roles
          .createQueryBuilder('r')
          .leftJoin('r.business', 'b')
          .where('r.code IN (:...codes)', { codes })
          .andWhere('(r.business_id IS NULL OR b.code = :platform)', {
            platform: PLATFORM_BIZ_CODE,
          })
          .getMany()
      : [];
    await this.replaceRoles(accountId, roles);
  }

  async assignRoleIds(accountId: string, roleIds: string[]) {
    const roles = roleIds.length
      ? await this.roles.find({ where: { id: In(roleIds) } })
      : [];
    await this.replaceRoles(accountId, roles);
  }

  private async replaceRoles(accountId: string, next: RoleEntity[]) {
    const current = await this.accountRoles.find({ where: { accountId } });
    if (current.length) {
      await this.accountRoles.remove(current);
    }
    if (!next.length) {
      return;
    }
    await this.accountRoles.save(
      next.map((role) => this.accountRoles.create({ accountId, roleId: role.id })),
    );
  }

  async toInfoList(accounts: AccountEntity[]): Promise<UserAccountInfo[]> {
    if (!accounts.length) {
      return [];
    }
    const roleRows = await this.accountRoles.find({
      where: { accountId: In(accounts.map((a) => a.id)) },
      relations: ['role'],
    });
    return accounts.map((account) => {
      const rows = roleRows.filter((row) => row.accountId === account.id && row.role);
      return {
        id: account.id,
        type: account.type,
        identifier: account.identifier,
        status: account.status,
        roles: rows.map((row) => row.role.code),
        roleIds: rows.map((row) => row.roleId),
        roleNames: rows.map((row) => row.role.name),
        lastLoginAt: account.lastLoginAt?.toISOString() ?? null,
        createdAt: account.createdAt.toISOString(),
      };
    });
  }

  async toInfo(account: AccountEntity): Promise<UserAccountInfo> {
    const [info] = await this.toInfoList([account]);
    return info;
  }
}
