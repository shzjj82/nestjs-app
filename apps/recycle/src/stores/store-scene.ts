import { randomBytes } from 'crypto';

/** 扫码落点：小程序 pages/store-bind/index，scene 走 query */
export const STORE_BIND_PAGE = 'pages/store-bind/index';

/** 微信 getwxacodeunlimit 的 scene 最多 32 字符 */
export function newBindScene(): string {
  return randomBytes(12).toString('hex');
}
