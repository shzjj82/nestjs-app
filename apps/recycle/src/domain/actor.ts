import {
  asRecord,
  optionalString,
  recycleInternalKey,
  rpcFail,
} from '@app/common';
import { recycleIdentities } from './roles';

/**
 * 调用者身份。
 *
 * 数据一律来自网关注入的 `_session`，绝不采信请求体里客户端传的 userId / openid：
 * 网关 `buildProxyPayload` 只丢弃 `_session/_token/_bizCode/...` 这几个保留字段，
 * 业务字段是原样透传的，客户端可以伪造。
 */
export interface Actor {
  userId: string;
  accountId: string | null;
  bizCode: string;
  roles: string[];
  permissions: string[];
  nickname: string | null;
  /** 片区；用于验收员/业务员的行级数据范围，来自会话扩展属性 */
  regionCode: string | null;
  /**
   * 微信 openid；仅小程序登录会话有。
   * 由 usercenter 签发时写入会话，是发订阅消息 / 商家转账的唯一可信收款标识。
   */
  openid: string | null;
  /**
   * 会话所属小程序的 appId（微信登录会话才有）。
   * 发订阅消息时靠它定位用哪套小程序的模板配置。
   */
  wechatAppId: string | null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** 从会话还原调用者；没有会话返回 null（内部调用与匿名接口） */
export function actorOf(payload: Record<string, unknown>): Actor | null {
  const session = asRecord(payload._session);
  const userId = optionalString(session.userId);
  if (!userId) {
    return null;
  }
  const extras = asRecord(session.extras);
  return {
    userId,
    accountId: optionalString(session.accountId) ?? null,
    bizCode: optionalString(session.bizCode) ?? '',
    roles: readStringArray(session.roles),
    permissions: readStringArray(session.permissions),
    nickname: optionalString(session.nickname) ?? null,
    regionCode:
      optionalString(session.regionCode) ??
      optionalString(extras.regionCode) ??
      null,
    openid: optionalString(session.openid) ?? null,
    wechatAppId: optionalString(session.wechatAppId) ?? null,
  };
}

export function requireActor(payload: Record<string, unknown>): Actor {
  const actor = actorOf(payload);
  if (!actor) {
    rpcFail(401, '需要登录会话');
  }
  return actor;
}

/**
 * 业务隔离键。
 *
 * 必须用网关校验后的 `_bizCode`（来自 X-Biz-Code），不能用 actor.bizCode：
 * 平台超管的会话 bizCode 是 platform，但他访问的是 recycle 业务。
 */
export function bizCodeOf(
  payload: Record<string, unknown>,
  actor: Actor,
): string {
  return optionalString(payload._bizCode) ?? actor.bizCode;
}

export function hasAnyRole(actor: Actor, roles: string[]): boolean {
  const identities = recycleIdentities(actor.roles);
  return roles.some((role) => identities.includes(role));
}

export function isAdmin(actor: Actor): boolean {
  return actor.roles.includes('admin');
}

/** 把调用者还原成会话结构，供内部事件在上下文之间传递身份 */
export function actorToSession(actor: Actor): Record<string, unknown> {
  return {
    userId: actor.userId,
    accountId: actor.accountId,
    bizCode: actor.bizCode,
    roles: actor.roles,
    permissions: actor.permissions,
    nickname: actor.nickname,
    regionCode: actor.regionCode,
    openid: actor.openid,
    wechatAppId: actor.wechatAppId,
  };
}

/** 服务内部事件必须携带内部密钥，避免 MQTT 直连伪造 */
export function requireInternal(payload: Record<string, unknown>): void {
  const key = optionalString(payload._internal);
  if (!key || key !== recycleInternalKey()) {
    rpcFail(403, '内部事件密钥无效');
  }
}

/** 构造内部事件载荷：跨上下文事件统一带 _internal */
export function internalPayload<T extends Record<string, unknown>>(
  payload: T,
): T & { _internal: string } {
  return { ...payload, _internal: recycleInternalKey() };
}
