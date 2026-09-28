import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { matchRoute, ok, unwrapData } from '@app/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { ClientHub } from '../mqtt/client.hub';
import { buildProxyPayload, LOCAL_PATHS, requestPathname } from './proxy.routes';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
  private readonly logger = new Logger('GatewayProxy');

  constructor(
    private readonly auth: AuthService,
    private readonly clients: ClientHub,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const pathname = requestPathname(req);
    if (LOCAL_PATHS.has(pathname)) {
      next();
      return;
    }

    const route = matchRoute(req.method, pathname);
    if (!route || route.override) {
      next();
      return;
    }

    try {
      const query = (req.query ?? {}) as Record<string, unknown>;
      const isDocsList = pathname === '/docs/documents';
      const scope =
        typeof query.scope === 'string' ? query.scope.trim().toLowerCase() : '';
      const needsPrivilege = isDocsList && (scope === 'mine' || scope === 'all');
      // mine 必须用户 JWT；all 可用 docs-key。二者都先抬升鉴权，docs 服务再按 scope 细判。
      const auth = needsPrivilege
        ? [...new Set([...(route.auth ?? []), 'jwt' as const, 'docs-key' as const])]
        : route.auth;
      let user = await this.auth.enforce(auth, req, route.permissions);
      // 公开 docs 路由不强制登录；若带了 Bearer，解析进 _session（feed 混入私有 / 读本人私有详情）
      if (!user && this.auth.bearerToken(req)) {
        user = await this.auth.fromRequest(req);
        if (user) {
          (req as Request & { user?: unknown }).user = user;
        }
      }
      this.logger.log(`${req.method} ${pathname} -> ${route.pattern}`);
      const payload = buildProxyPayload(
        req,
        route.params,
        user
          ? {
              token: user.token,
              userId: user.id,
              appId: user.appId,
              wechatAppId: user.wechatAppId,
              username: user.username ?? null,
              nickname: user.name,
              role: user.role,
              roles: user.roles,
              permissions: user.permissions,
            }
          : null,
        this.auth.bearerToken(req) ?? user?.token,
      );
      payload._docsPrivileged = this.auth.hasValidDocsKey(req);
      const result = await this.clients.send(
        route.client,
        route.pattern,
        payload,
      );
      const code = req.method === 'POST' ? 201 : 200;
      res.status(code).json(ok(unwrapData(result), 'ok', code));
    } catch (err) {
      next(err);
    }
  }
}
