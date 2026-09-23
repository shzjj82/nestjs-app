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
      this.auth.enforce(route.auth, req);
      this.logger.log(`${req.method} ${pathname} -> ${route.pattern}`);
      const result = await this.clients.send(
        route.client,
        route.pattern,
        buildProxyPayload(req, route.params),
      );
      const code = req.method === 'POST' ? 201 : 200;
      res.status(code).json(ok(unwrapData(result), 'ok', code));
    } catch (err) {
      next(err);
    }
  }
}
