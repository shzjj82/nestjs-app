import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { BIZ_REGISTRY_KEY, matchRoute, REDIS } from '@app/common';
import type { BusinessRegistryEntry } from '@app/common';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { AuthService } from './auth.service';
import type { GatewayUser } from './auth.types';
import { evaluateBizAccess, type BizRouteView } from './biz-access';

const CACHE_MS = Number(process.env.BIZ_REGISTRY_CACHE_MS ?? 5000);

export const BIZ_HEADER = 'x-biz-code';

@Injectable()
export class BizGuard {
  private cache: { at: number; entries: Map<string, BusinessRegistryEntry> } | null = null;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly auth: AuthService,
  ) {}

  headerCode(req: Request): string | null {
    const raw = req.headers[BIZ_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  /** 校验业务准入，返回要注入下游的 _bizCode */
  async check(
    route: BizRouteView,
    req: Request,
    user: GatewayUser | null,
  ): Promise<string | null> {
    const headerCode = this.headerCode(req);
    const entries = await this.registry();
    const result = evaluateBizAccess({
      route,
      headerCode,
      entry: headerCode ? entries.get(headerCode) : undefined,
      session: user ? { bizCode: user.bizCode, isAdmin: this.auth.isAdmin(user) } : null,
    });
    if (!result.ok) {
      throw result.status === 400
        ? new BadRequestException(result.message)
        : new ForbiddenException(result.message);
    }
    return result.bizCode;
  }

  /** override 控制器用：按请求本身匹配路由表里的 scope 与接口 */
  async checkRequest(req: Request, user: GatewayUser | null): Promise<string | null> {
    const route = matchRoute(req.method, req.path ?? req.url.split('?')[0]);
    if (!route) {
      throw new ForbiddenException('未登记的路由');
    }
    return this.check(route, req, user);
  }

  private async registry(): Promise<Map<string, BusinessRegistryEntry>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.entries;
    }
    const raw = await this.redis.hgetall(BIZ_REGISTRY_KEY);
    const entries = new Map<string, BusinessRegistryEntry>();
    for (const [code, json] of Object.entries(raw)) {
      try {
        entries.set(code, JSON.parse(json) as BusinessRegistryEntry);
      } catch {
        // 注册表条目损坏时视为不存在
      }
    }
    this.cache = { at: Date.now(), entries };
    return entries;
  }
}
