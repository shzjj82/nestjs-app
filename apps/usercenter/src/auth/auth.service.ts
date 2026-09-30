import { Injectable } from '@nestjs/common';
import { compare } from 'bcrypt';
import { TokenStore } from '@app/common';
import type { AuthResult, AuthSession, User } from '@app/common';
import { ClientsService } from '../apps/clients.service';
import { BusinessesService } from '../businesses/businesses.service';
import type { AccountEntity, AccountType, BusinessEntity, ClientEntity } from '../entities';
import { RbacService } from '../rbac/rbac.service';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { normalizePhone } from '../users/account-merge';
import { AccountsService } from '../users/accounts.service';
import { UsersService } from '../users/users.service';
import { AlipayClient } from './alipay.client';
import { WechatClient } from './wechat.client';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly accounts: AccountsService,
    private readonly clients: ClientsService,
    private readonly businesses: BusinessesService,
    private readonly rbac: RbacService,
    private readonly tokens: TokenStore,
    private readonly wechatClient: WechatClient,
    private readonly alipayClient: AlipayClient,
  ) {}

  async register(payload: Record<string, unknown>): Promise<AuthResult> {
    const business = await this.requestBusiness(payload);
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    if (username.length < 2 || username.length > 32) {
      rpcFail(400, '用户名长度需为 2-32');
    }
    if (password.length < 6 || password.length > 64) {
      rpcFail(400, '密码长度需为 6-64');
    }
    await this.accounts.assertIdentifierFree(username);
    const rawPhone = optionalString(payload.phone);
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
    if (phone && (await this.users.findByPhone(phone))) {
      rpcFail(409, '手机号已被占用，请登录后绑定以合并账号');
    }
    const user = await this.users.createUser({
      nickname: optionalString(payload.nickname) ?? username,
      phone,
      email: optionalString(payload.email),
    });
    const account = await this.accounts.createPassword(user.id, username, password);
    return this.issue(account, business, this.loginClientCode(payload, business));
  }

  async login(payload: Record<string, unknown>): Promise<AuthResult> {
    const business = await this.requestBusiness(payload);
    const login = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    const account = await this.users.findPasswordAccount(login);
    if (!account?.passwordHash || !(await compare(password, account.passwordHash))) {
      rpcFail(401, '用户名或密码错误');
    }
    return this.issue(account, business, this.loginClientCode(payload, business));
  }

  async loginByWechat(payload: Record<string, unknown>): Promise<AuthResult> {
    const business = await this.requestBusiness(payload);
    const client = await this.clients.requireForBusiness(
      business.id,
      'wechat_mp',
      optionalString(payload.clientCode),
    );
    const code = requiredString(payload.code, 'code');
    if (!client.wechatAppId) {
      rpcFail(400, `接入端 ${client.appCode} 未配置 wechatAppId（对应微信服务登记的 appId 或 code）`);
    }
    const session = await this.wechatClient.code2session(client.wechatAppId, code);
    return this.loginByExternal({
      business,
      client,
      type: 'wechat_mp',
      identifier: session.openid,
      unionid: session.unionid,
      nickname: optionalString(payload.nickname) ?? '微信用户',
      avatar: optionalString(payload.avatar),
      phone: optionalString(payload.phone),
      wechatAppId: session.appId || client.wechatAppId,
    });
  }

  async loginByAlipay(payload: Record<string, unknown>): Promise<AuthResult> {
    const business = await this.requestBusiness(payload);
    const client = await this.clients.requireForBusiness(
      business.id,
      'alipay_mp',
      optionalString(payload.clientCode),
    );
    const code = requiredString(payload.code, 'code');
    if (!client.alipayAppId || !client.alipayPrivateKey) {
      rpcFail(400, `接入端 ${client.appCode} 未配置支付宝 appId / 私钥`);
    }
    const session = await this.alipayClient.code2session(
      client.alipayAppId,
      client.alipayPrivateKey,
      code,
    );
    return this.loginByExternal({
      business,
      client,
      type: 'alipay_mp',
      identifier: session.userId,
      nickname: optionalString(payload.nickname) ?? '支付宝用户',
      avatar: optionalString(payload.avatar),
      phone: optionalString(payload.phone),
    });
  }

  async changePassword(payload: Record<string, unknown>) {
    const session = requireSession(payload);
    const oldPassword = requiredString(payload.oldPassword, 'oldPassword');
    const newPassword = requiredString(payload.newPassword, 'newPassword');
    if (newPassword.length < 6 || newPassword.length > 64) {
      rpcFail(400, '新密码长度需为 6-64');
    }
    if (oldPassword === newPassword) {
      rpcFail(400, '新密码不能与当前密码相同');
    }
    const current = session.accountId
      ? await this.accounts.findEntity(session.accountId)
      : null;
    const account =
      current?.type === 'password'
        ? current
        : await this.accounts.findPasswordByUser(session.userId);
    if (!account?.passwordHash) {
      rpcFail(400, '当前用户没有账密账户，无法在此修改');
    }
    if (!(await compare(oldPassword, account.passwordHash))) {
      rpcFail(401, '当前密码错误');
    }
    await this.accounts.setPassword(account, newPassword);
    return { ok: true };
  }

  async bindPhone(payload: Record<string, unknown>): Promise<AuthResult> {
    const session = requireSession(payload);
    const phone = requiredString(payload.phone, 'phone');
    const bound = await this.users.bindPhone(session.userId, phone);
    if (bound.mergedFromUserId) {
      await this.tokens.revokeAll(bound.mergedFromUserId);
    }
    return this.issue(
      await this.sessionAccount(session.userId, session.accountId),
      await this.businesses.requireActiveByCode(session.bizCode),
      session.appId,
      session.wechatAppId,
    );
  }

  async refresh(payload: Record<string, unknown>): Promise<AuthResult> {
    const refreshToken = requiredString(payload.refreshToken, 'refreshToken');
    const record = await this.tokens.getRefresh(refreshToken);
    if (!record?.bizCode) {
      rpcFail(401, 'refresh token 无效或已过期');
    }
    const requested = optionalString(payload._bizCode);
    if (requested && requested !== record.bizCode) {
      rpcFail(403, 'refresh token 不属于当前业务');
    }
    await this.tokens.revokeByRefresh(refreshToken);
    return this.issue(
      await this.sessionAccount(record.userId, record.accountId),
      await this.businesses.requireActiveByCode(record.bizCode),
      record.appId,
      record.wechatAppId,
    );
  }

  async logout(payload: Record<string, unknown>) {
    const accessToken = optionalString(payload._token);
    const refreshToken = optionalString(payload.refreshToken);
    if (accessToken) {
      await this.tokens.revoke(accessToken);
    } else if (refreshToken) {
      await this.tokens.revokeByRefresh(refreshToken);
    }
    return { ok: true };
  }

  async me(payload: Record<string, unknown>): Promise<User> {
    const session = requireSession(payload);
    const business = await this.businesses.requireActiveByCode(session.bizCode);
    const account = await this.sessionAccount(session.userId, session.accountId);
    const publicUser = await this.users.findOne(account.userId);
    const rbac = await this.rbac.loadAccountRbac(account.id, business.id);
    return {
      ...publicUser,
      ...rbac,
      accountId: account.id,
      wechatAppId: session.wechatAppId,
      bizCode: business.code,
    };
  }

  private async loginByExternal(input: {
    business: BusinessEntity;
    client: ClientEntity;
    type: AccountType;
    identifier: string;
    unionid?: string;
    nickname: string;
    avatar?: string;
    phone?: string;
    wechatAppId?: string;
  }): Promise<AuthResult> {
    let account = await this.accounts.findExternal(
      input.type,
      input.client.id,
      input.identifier,
    );

    if (!account) {
      const sibling = input.unionid
        ? await this.accounts.findByUnionid(input.type, input.unionid)
        : null;
      const userId =
        sibling?.userId ??
        (
          await this.users.createUser({
            nickname: input.nickname,
            avatar: input.avatar ?? null,
          })
        ).id;
      account = await this.accounts.createExternal({
        userId,
        type: input.type,
        clientId: input.client.id,
        identifier: input.identifier,
        unionid: input.unionid,
      });
    }

    if (input.phone) {
      const bound = await this.users.bindPhone(account.userId, input.phone);
      if (bound.mergedFromUserId) {
        await this.tokens.revokeAll(bound.mergedFromUserId);
      }
      account = await this.accounts.findEntity(account.id);
    }

    if (input.nickname || input.avatar) {
      await this.users.update({
        id: account.userId,
        nickname: input.nickname,
        avatar: input.avatar,
      });
    }
    return this.issue(account, input.business, input.client.appCode, input.wechatAppId);
  }

  /** 旧会话没有 accountId 时，回落到该用户最早的账户 */
  private async sessionAccount(userId: string, accountId?: string) {
    if (accountId) {
      return this.accounts.findEntity(accountId);
    }
    const [first] = await this.accounts.listByUser(userId);
    if (!first) {
      rpcFail(401, '用户没有可用账户，请重新登录');
    }
    return first;
  }

  /** 业务 code 只来自网关注入的 _bizCode（请求头 X-Biz-Code） */
  private requestBusiness(payload: Record<string, unknown>) {
    return this.businesses.requireActiveByCode(optionalString(payload._bizCode));
  }

  private loginClientCode(payload: Record<string, unknown>, business: BusinessEntity) {
    return optionalString(payload.clientCode) ?? business.code;
  }

  private async issue(
    account: AccountEntity,
    business: BusinessEntity,
    appId: string,
    wechatAppId?: string,
  ): Promise<AuthResult> {
    if (account.status !== 1) {
      rpcFail(403, '账户已停用');
    }
    const user = await this.users.findEntity(account.userId);
    if (user.status !== 1) {
      rpcFail(403, '用户已停用');
    }
    await this.businesses.ensureMember(business, user.id, account.id);
    await this.accounts.touchLogin(account);
    const rbac = await this.rbac.loadAccountRbac(account.id, business.id);
    const publicUser = await this.users.toPublic(user);
    const pair = await this.tokens.issue({
      userId: user.id,
      accountId: account.id,
      appId,
      bizCode: business.code,
      wechatAppId: wechatAppId || undefined,
      username: account.type === 'password' ? account.identifier : publicUser.username,
      nickname: user.nickname,
      role: rbac.roles.includes('admin') ? 'admin' : 'user',
      roles: rbac.roles,
      permissions: rbac.permissions,
    });
    return {
      token: pair.session.token,
      expiresIn: pair.expiresIn,
      refreshToken: pair.refreshToken,
      refreshExpiresIn: pair.refreshExpiresIn,
      user: {
        ...publicUser,
        ...rbac,
        accountId: account.id,
        bizCode: business.code,
        wechatAppId: wechatAppId || undefined,
      },
      wechatAppId: wechatAppId || undefined,
    };
  }
}

function requireSession(payload: Record<string, unknown>): AuthSession {
  const session = payload._session as AuthSession | undefined;
  if (!session?.userId) {
    rpcFail(401, '未登录');
  }
  return session;
}
