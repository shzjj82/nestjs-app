import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcrypt';
import { TokenStore } from '@app/common';
import type { AuthResult, AuthSession, User } from '@app/common';
import { Repository } from 'typeorm';
import { ClientsService } from '../apps/clients.service';
import type { ClientEntity, IdentityProvider } from '../entities';
import { UserIdentityEntity } from '../entities';
import { RbacService } from '../rbac/rbac.service';
import { clientCodeOf, optionalString, requiredString, rpcFail } from '../rpc';
import { normalizePhone } from '../users/account-merge';
import { UsersService } from '../users/users.service';
import { AlipayClient } from './alipay.client';
import { WechatClient } from './wechat.client';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserIdentityEntity)
    private readonly identities: Repository<UserIdentityEntity>,
    private readonly users: UsersService,
    private readonly clients: ClientsService,
    private readonly rbac: RbacService,
    private readonly tokens: TokenStore,
    private readonly wechatClient: WechatClient,
    private readonly alipayClient: AlipayClient,
  ) {}

  async register(payload: Record<string, unknown>): Promise<AuthResult> {
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    if (username.length < 2 || username.length > 32) {
      rpcFail(400, '用户名长度需为 2-32');
    }
    if (password.length < 6 || password.length > 64) {
      rpcFail(400, '密码长度需为 6-64');
    }
    await this.users.assertUsernameFree(username);
    const rawPhone = optionalString(payload.phone);
    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;
    if (phone) {
      const taken = await this.users.findByPhone(phone);
      if (taken) {
        rpcFail(409, '手机号已被占用，请登录后绑定以合并账号');
      }
    }
    const user = await this.users.createUser({
      username,
      password,
      nickname: optionalString(payload.nickname) ?? username,
      phone,
      email: optionalString(payload.email),
    });
    await this.users.assignRoleCodes(user.id, ['user']);
    return this.issue(user.id, this.loginAppCode(payload));
  }

  async login(payload: Record<string, unknown>): Promise<AuthResult> {
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    const user = await this.users.findByUsernameOrPhone(username);
    if (!user || !user.passwordHash) {
      rpcFail(401, '用户名或密码错误');
    }
    const matched = await compare(password, user.passwordHash);
    if (!matched) {
      rpcFail(401, '用户名或密码错误');
    }
    if (user.status !== 1) {
      rpcFail(403, '账号已停用');
    }
    return this.issue(user.id, this.loginAppCode(payload));
  }

  async loginByWechat(payload: Record<string, unknown>): Promise<AuthResult> {
    const client = await this.requireClient(payload, 'wechat_mp');
    const code = requiredString(payload.code, 'code');
    if (!client.wechatAppId || !client.wechatSecret) {
      if (process.env.WECHAT_MOCK !== '1') {
        rpcFail(400, `接入端 ${client.appCode} 未配置微信 appId / appSecret`);
      }
    }
    const session = await this.wechatClient.code2session(
      client.wechatAppId || client.appCode,
      client.wechatSecret || 'mock-secret',
      code,
    );
    return this.loginByIdentity({
      client,
      provider: 'wechat_mp',
      identifier: session.openid,
      unionid: session.unionid,
      nickname: optionalString(payload.nickname) ?? '微信用户',
      avatar: optionalString(payload.avatar),
      phone: optionalString(payload.phone),
    });
  }

  async loginByAlipay(payload: Record<string, unknown>): Promise<AuthResult> {
    const client = await this.requireClient(payload, 'alipay_mp');
    const code = requiredString(payload.code, 'code');
    if (!client.alipayAppId || !client.alipayPrivateKey) {
      if (process.env.ALIPAY_MOCK !== '1' && process.env.WECHAT_MOCK !== '1') {
        rpcFail(400, `接入端 ${client.appCode} 未配置支付宝 appId / 私钥`);
      }
    }
    const session = await this.alipayClient.code2session(
      client.alipayAppId || client.appCode,
      client.alipayPrivateKey || 'mock-secret',
      code,
    );
    return this.loginByIdentity({
      client,
      provider: 'alipay_mp',
      identifier: session.userId,
      nickname: optionalString(payload.nickname) ?? '支付宝用户',
      avatar: optionalString(payload.avatar),
      phone: optionalString(payload.phone),
    });
  }

  async bindPhone(payload: Record<string, unknown>): Promise<AuthResult> {
    const session = payload._session as AuthSession | undefined;
    if (!session?.userId) {
      rpcFail(401, '未登录');
    }
    const phone = requiredString(payload.phone, 'phone');
    const bound = await this.users.bindPhone(session.userId, phone);
    if (bound.mergedFromUserId) {
      await this.tokens.revokeAll(bound.mergedFromUserId);
    }
    if (bound.user.status !== 1) {
      rpcFail(403, '账号已停用');
    }
    return this.issue(bound.user.id, session.appId);
  }

  async refresh(payload: Record<string, unknown>): Promise<AuthResult> {
    const refreshToken = requiredString(payload.refreshToken, 'refreshToken');
    const record = await this.tokens.getRefresh(refreshToken);
    if (!record) {
      rpcFail(401, 'refresh token 无效或已过期');
    }
    const user = await this.users.findEntity(record.userId);
    if (user.status !== 1) {
      await this.tokens.revokeByRefresh(refreshToken);
      rpcFail(403, '账号已停用');
    }
    await this.tokens.revokeByRefresh(refreshToken);
    return this.issue(user.id, record.appId);
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
    const session = payload._session as AuthSession | undefined;
    if (!session?.userId) {
      rpcFail(401, '未登录');
    }
    const user = await this.users.findEntity(session.userId);
    const publicUser = await this.users.toPublic(user);
    const rbac = await this.rbac.loadUserRbac(user.id);
    return { ...publicUser, ...rbac };
  }

  private async loginByIdentity(input: {
    client: ClientEntity;
    provider: IdentityProvider;
    identifier: string;
    unionid?: string;
    nickname: string;
    avatar?: string;
    phone?: string;
  }): Promise<AuthResult> {
    let identity = await this.identities.findOne({
      where: {
        clientId: input.client.id,
        provider: input.provider,
        identifier: input.identifier,
      },
    });

    if (!identity && input.unionid) {
      const byUnion = await this.identities.findOne({
        where: { provider: input.provider, unionid: input.unionid },
      });
      if (byUnion) {
        identity = await this.identities.save(
          this.identities.create({
            userId: byUnion.userId,
            clientId: input.client.id,
            provider: input.provider,
            identifier: input.identifier,
            unionid: input.unionid,
          }),
        );
      }
    }

    if (!identity) {
      const user = await this.users.createUser({
        username: null,
        nickname: input.nickname,
        avatar: input.avatar ?? null,
      });
      await this.users.assignRoleCodes(user.id, ['user']);
      identity = await this.identities.save(
        this.identities.create({
          userId: user.id,
          clientId: input.client.id,
          provider: input.provider,
          identifier: input.identifier,
          unionid: input.unionid ?? null,
        }),
      );
    }

    let userId = identity.userId;
    if (input.phone) {
      const bound = await this.users.bindPhone(userId, input.phone);
      if (bound.mergedFromUserId) {
        await this.tokens.revokeAll(bound.mergedFromUserId);
      }
      userId = bound.user.id;
    }

    const user = await this.users.findEntity(userId);
    if (user.status !== 1) {
      rpcFail(403, '账号已停用');
    }
    if (input.nickname || input.avatar) {
      await this.users.update({
        id: user.id,
        nickname: input.nickname,
        avatar: input.avatar,
      });
    }
    return this.issue(userId, input.client.appCode);
  }

  private async requireClient(
    payload: Record<string, unknown>,
    type: ClientEntity['type'],
  ) {
    const appCode = clientCodeOf(payload, true);
    const client = await this.clients.requireByAppCode(appCode);
    if (client.type !== type) {
      rpcFail(400, `接入端 ${client.appCode} 不是 ${type}`);
    }
    return client;
  }

  private loginAppCode(payload: Record<string, unknown>) {
    return clientCodeOf(payload) ?? 'web';
  }

  private async issue(userId: string, appId: string): Promise<AuthResult> {
    const user = await this.users.findEntity(userId);
    const rbac = await this.rbac.loadUserRbac(userId);
    const publicUser = await this.users.toPublic(user);
    const pair = await this.tokens.issue({
      userId,
      appId,
      username: user.username,
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
      user: { ...publicUser, ...rbac },
    };
  }
}
