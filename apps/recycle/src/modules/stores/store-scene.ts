import { randomBytes } from 'crypto';

/**
 * 小程序码分两种（scene 互不混用）：
 * - bind（本文件）：门店绑定关系，落点 pages/store-bind/index，24 位 hex
 * - login：扫码登录，scene 以 `l` 开头，见 libs/common login-qr.ts，走 MQTT 推送
 */
export const STORE_BIND_PAGE = 'pages/store-bind/index';

/** 微信 getwxacodeunlimit 的 scene 最多 32 字符 */
export function newBindScene(): string {
  return randomBytes(12).toString('hex');
}
