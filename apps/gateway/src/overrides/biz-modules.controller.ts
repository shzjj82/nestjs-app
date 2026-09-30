import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import {
  GATEWAY_ROUTES,
  PERMISSIONS,
  SERVICE_API_DOCS,
  routeKey,
  unwrapData,
} from '@app/common';
import type { BizServiceCatalogItem, ServiceApiDocs } from '@app/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import type { GatewayUser } from '../auth/auth.types';
import { BizGuard } from '../auth/biz.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClientHub } from '../mqtt/client.hub';

const DOCS_TIMEOUT_MS = 5000;

@Controller('biz-modules')
export class BizModulesController {
  constructor(
    private readonly auth: AuthService,
    private readonly biz: BizGuard,
    private readonly clients: ClientHub,
  ) {}

  /** 按微服务列出业务可开通的接口；名称与描述来自各服务处理函数上的 @ApiDoc */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Req() req: Request, @CurrentUser() user: GatewayUser): Promise<BizServiceCatalogItem[]> {
    await this.biz.check({ scope: 'platform' }, req, user);
    if (!this.auth.hasAnyPermission(user, [PERMISSIONS.BUSINESS_MANAGE])) {
      throw new ForbiddenException('缺少权限: business.manage');
    }

    const catalog = await Promise.all(
      SERVICE_API_DOCS.map(async ({ client, service, pattern }) => {
        const routes = GATEWAY_ROUTES.filter(
          (route) => route.scope === 'business' && route.client === client,
        );
        if (!routes.length) return null;
        const docs = await this.fetchDocs(client, pattern);
        const byPattern = new Map((docs?.apis ?? []).map((api) => [api.pattern, api]));
        return {
          service: docs?.service ?? service,
          label: docs?.label ?? service,
          online: !!docs,
          apis: routes.map((route) => {
            const doc = byPattern.get(route.pattern);
            return {
              key: routeKey(route),
              name: doc?.name ?? routeKey(route),
              description: doc?.description ?? null,
              method: route.method,
              path: route.path,
            };
          }),
        };
      }),
    );
    return catalog.filter((item): item is BizServiceCatalogItem => item !== null);
  }

  private async fetchDocs(client: string, pattern: string): Promise<ServiceApiDocs | null> {
    try {
      const raw = await Promise.race([
        this.clients.send(client, pattern, {}),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), DOCS_TIMEOUT_MS)),
      ]);
      return unwrapData<ServiceApiDocs>(raw) ?? null;
    } catch {
      return null;
    }
  }
}
