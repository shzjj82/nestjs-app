import { randomBytes } from 'crypto';

/** 登录小程序码落点；scene 为 ticket */
export const LOGIN_QR_PAGE = 'pages/login-qr/index';

/** Redis / 票据默认存活秒数 */
export const LOGIN_QR_TTL_SECONDS = 120;

/** 登录 scene：`l` + 24 hex，总计 25 字符（微信上限 32） */
export function newLoginQrScene(): string {
  return `l${randomBytes(12).toString('hex')}`;
}

export function isLoginQrScene(scene: string): boolean {
  return /^l[0-9a-f]{24}$/.test(scene);
}

export function loginQrRedisKey(ticket: string): string {
  return `auth:login-qr:${ticket}`;
}

/** MQTT 推送 topic；网关 SSE / 客户端 mqtt.js 都订这个 */
export function loginQrMqttTopic(ticket: string): string {
  return `auth/login/qr/${ticket}`;
}

export function loginQrEventsPath(ticket: string): string {
  return `/auth/login/qrcode/${ticket}/events`;
}
