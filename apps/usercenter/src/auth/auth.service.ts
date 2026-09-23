import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { compare } from 'bcrypt';
import { TokenStore } from '@app/common';
import type { AuthResult, AuthSession, User } from '@app/common';
import { Repository } from 'typeorm';
import { AppsService } from '../apps/apps.service';
import { UserIdentityEntity } from '../entities';
import { RbacService } from '../rbac/rbac.service';
import { optionalString, requiredString, rpcFail } from '../rpc';
import { UsersService } from '../users/users.service';
import { WechatClient } from './wechat.client';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserIdentityEntity)
    private readonly identities: Repository<UserIdentityEntity>,
    private readonly users: UsersService,
    private readonly apps: AppsService,
    private readonly rbac: RbacService,
    private readonly tokens: TokenStore,
    private readonly wechatClient: WechatClient,
  ) {}

  async register(payload: Record<string, unknown>): Promise<AuthResult> {
    const app = await this.apps.requireByAppId(
      requiredString(payload.appId, 'appId'),
    );
    const username = requiredString(payload.username, 'username');
    const password = requiredString(payload.password, 'password');
    if (username.length < 2 || username.length > 32) {
      rpcFail(400, '用户名长度需为 2-32');
    }
    if (password.length < 6 || password.length > 64) {
      rpcFail(400, '密码长度需为 6-64');
    }
    await this.users.assertUsernameFree(username);
    const phone = optionalString(payload.phone);
    if (phone) {
      const taken = await this.users.findByUsernameOrPhone(phone);
      if (taken) {
        rpcFail(409, '手机号已被占用');
      }
    }
    const user = await this.users.createUser({
      username,
      password,
      nickname: optionalString(payload.nickname) ?? username,
      phone,
      email: optionalString(payload.email),
    });
    await this.users.bindApp(user.id, app);
    await this.users.assignRoleCodes(user.id, app.appId, ['user']);
    return this.issue(user.id, app.appId);
  }

  async login(payload: Record<string, unknown>): Promise<AuthResult> {
    const app = await this.apps.requireByAppId(
      requiredString(payload.appId, 'appId'),
    );
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
    if (!(await this.users.isBound(user.id, app.id))) {
      rpcFail(403, '该账号未开通此应用');
    }
    return this.issue(user.id, app.appId);
  }

  async loginByWechat(payload: Record<string, unknown>): Promise<AuthResult> {
    const app = await this.apps.requireByAppId(
      requiredString(payload.appId, 'appId'),
    );
    const code = requiredString(payload.code, 'code');
    if (!app.wechatAppId || !app.wechatSecret) {
      if (process.env.WECHAT_MOCK !== '1') {
        rpcFail(400, `应用 ${app.appId} 未配置微信小程序`);
      }
    }
    const session = await this.wechatClient.code2session(
      app.wechatAppId ?? 'mock-app',
      app.wechatSecret ?? 'mock-secret',
      code,
    );

    let identity = await this.identities.findOne({
      where: { appPk: app.id, provider: 'wechat_mp', openid: session.openid },
    });
    if (!identity && session.unionid) {
      const byUnion = await this.identities.findOne({
        where: { provider: 'wechat_mp', unionid: session.unionid },
      });
      if (byUnion) {
        await this.users.bindApp(byUnion.userId, app);
        identity = await this.identities.save(
          this.identities.create({
            userId: byUnion.userId,
            appPk: app.id,
            provider: 'wechat_mp',
            openid: session.openid,
            unionid: session.unionid,
          }),
        );
      }
    }

    if (!identity) {
      const user = await this.users.createUser({
        username: null,
        nickname: optionalString(payload.nickname) ?? '微信用户',
        avatar: optionalString(payload.avatar) ?? null,
      });
      await this.users.bindApp(user.id, app);
      await this.users.assignRoleCodes(user.id, app.appId, ['user']);
      identity = await this.identities.save(
        this.identities.create({
          userId: user.id,
          appPk: app.id,
          provider: 'wechat_mp',
          openid: session.openid,
          unionid: session.unionid ?? null,
        }),
      );
    } else {
      await this.users.bindApp(identity.userId, app);
    }

    const user = await this.users.findEntity(identity.userId);
    if (user.status !== 1) {
      rpcFail(403, '账号已停用');
    }
    if (optionalString(payload.nickname) || optionalString(payload.avatar)) {
      await this.users.update({
        id: user.id,
        nickname: optionalString(payload.nickname),
        avatar: optionalString(payload.avatar),
      });
    }
    return this.issue(identity.userId, app.appId);
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
    const app = await this.apps.requireByAppId(record.appId);
    if (!(await this.users.isBound(user.id, app.id))) {
      await this.tokens.revokeByRefresh(refreshToken);
      rpcFail(403, '该账号未开通此应用');
    }
    await this.tokens.revokeByRefresh(refreshToken);
    return this.issue(user.id, app.appId);
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
    const publicUser = await this.users.toPublic(user, session.appId);
    const rbac = await this.rbac.loadUserRbac(user.id, session.appId);
    return { ...publicUser, ...rbac };
  }

  private async issue(userId: string, appId: string): Promise<AuthResult> {
    const user = await this.users.findEntity(userId);
    const rbac = await this.rbac.loadUserRbac(userId, appId);
    const publicUser = await this.users.toPublic(user, appId);
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
