import { PLATFORM_BIZ_CODE, routeKey } from '@app/common';
import type { BusinessRegistryEntry, GatewayRoute } from '@app/common';

export interface BizSessionView {
  bizCode?: string;
  isAdmin: boolean;
}

export type BizAccessResult =
  | { ok: true; bizCode: string | null }
  | { ok: false; status: 400 | 403; message: string };

export type BizRouteView = Pick<GatewayRoute, 'scope'> &
  Partial<Pick<GatewayRoute, 'method' | 'path'>>;

/**
 * 业务准入规则：
 * - platform 路由只接受 platform 业务会话；
 * - business 路由必须带已启用业务的 X-Biz-Code，会话需属于该业务（平台超管除外），
 *   且业务开通了该接口（platform 业务全部放行）；
 * - 未标记 scope 的路由不拦截，业务合法时仍向下游透传。
 */
export function evaluateBizAccess(input: {
  route: BizRouteView;
  headerCode: string | null;
  entry: BusinessRegistryEntry | undefined;
  session: BizSessionView | null;
}): BizAccessResult {
  const { route, headerCode, entry, session } = input;
  const active = !!entry && entry.status === 1;

  if (route.scope === 'platform') {
    if (session && session.bizCode !== PLATFORM_BIZ_CODE) {
      return { ok: false, status: 403, message: '平台管理接口仅限 platform 业务会话' };
    }
    return { ok: true, bizCode: PLATFORM_BIZ_CODE };
  }

  if (route.scope !== 'business') {
    return { ok: true, bizCode: headerCode && active ? headerCode : null };
  }

  if (!headerCode) {
    return { ok: false, status: 400, message: '缺少业务标识：请求头 X-Biz-Code' };
  }
  if (!active) {
    return { ok: false, status: 403, message: `非法业务：${headerCode} 不存在或已停用` };
  }
  if (session && session.bizCode !== headerCode) {
    const crossByPlatformAdmin = session.bizCode === PLATFORM_BIZ_CODE && session.isAdmin;
    if (!crossByPlatformAdmin) {
      return { ok: false, status: 403, message: `当前登录会话不属于业务 ${headerCode}` };
    }
  }
  if (entry.code !== PLATFORM_BIZ_CODE && route.method && route.path) {
    const key = routeKey({ method: route.method, path: route.path });
    if (!(entry.apis ?? []).includes(key)) {
      return { ok: false, status: 403, message: `业务 ${headerCode} 未开通接口：${key}` };
    }
  }
  return { ok: true, bizCode: headerCode };
}
