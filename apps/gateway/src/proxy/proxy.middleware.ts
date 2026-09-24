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
      const needsDocsKey =
        pathname === '/docs/posts' &&
        (query.tree === '1' ||
          query.tree === 'true' ||
          query.includeDrafts === '1' ||
          query.includeDrafts === 'true');
      const auth = needsDocsKey
        ? [...new Set([...(route.auth ?? []), 'docs-key' as const])]
        : route.auth;
      const user = await this.auth.enforce(auth, req, route.permissions);
      this.logger.log(`${req.method} ${pathname} -> ${route.pattern}`);
      const payload = buildProxyPayload(
        req,
        route.params,
        user
          ? {
              token: user.token,
              userId: user.id,
              appId: user.appId,
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
