import { PLATFORM_BIZ_CODE, WIKI_BIZ_CODE } from '@app/common';
import type { BusinessRegistryEntry } from '@app/common';
import { routeKey, type GatewayRoute } from '@app/gateway-contract';

export interface BizSessionView {
  bizCode?: string;
  isAdmin: boolean;
}

export type BizAccessResult =
  | { ok: true; bizCode: string | null }
  | { ok: false; status: 400 | 403; message: string };

export type BizRouteView = Pick<GatewayRoute, 'scope'> &
  Partial<Pick<GatewayRoute, 'method' | 'path'>>;

/** wiki 单体产品路径：固定业务码 wiki，跳过按接口开通校验 */
export function isWikiProductPath(path?: string): boolean {
  return typeof path === 'string' && (path === '/wiki' || path.startsWith('/wiki/'));
}

/**
 * 业务准入规则：
 * - platform 路由只接受 platform 业务会话；
 * - business 路由必须带已启用业务的 X-Biz-Code，会话需属于该业务（平台超管除外），
 *   且业务开通了该接口（platform 业务全部放行）。开通按业务功能点，不按用户勾选；
 * - /wiki/* 为 wiki 单体产品：忽略请求头，固定注入 wiki，且跳过 apis 白名单；
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
  const wikiProduct = isWikiProductPath(route.path);

  if (route.scope === 'platform') {
    if (session && session.bizCode !== PLATFORM_BIZ_CODE) {
      return { ok: false, status: 403, message: '平台管理接口仅限 platform 业务会话' };
    }
    return { ok: true, bizCode: PLATFORM_BIZ_CODE };
  }

  if (route.scope !== 'business') {
    return { ok: true, bizCode: headerCode && active ? headerCode : null };
  }

  const effectiveCode = wikiProduct ? WIKI_BIZ_CODE : headerCode;

  if (!effectiveCode) {
    return { ok: false, status: 400, message: '缺少业务标识：请求头 X-Biz-Code' };
  }
  if (!active) {
    return { ok: false, status: 403, message: `非法业务：${effectiveCode} 不存在或已停用` };
  }
  if (session && session.bizCode !== effectiveCode) {
    const crossByPlatformAdmin = session.bizCode === PLATFORM_BIZ_CODE && session.isAdmin;
    if (!crossByPlatformAdmin) {
      return { ok: false, status: 403, message: `当前登录会话不属于业务 ${effectiveCode}` };
    }
  }
  // wiki 单体产品整包放行；platform 业务亦全部放行
  if (
    !wikiProduct &&
    entry.code !== PLATFORM_BIZ_CODE &&
    route.method &&
    route.path
  ) {
    const key = routeKey({ method: route.method, path: route.path });
    if (!(entry.apis ?? []).includes(key)) {
      return { ok: false, status: 403, message: `业务 ${effectiveCode} 未开通接口：${key}` };
    }
  }
  return { ok: true, bizCode: effectiveCode };
}
