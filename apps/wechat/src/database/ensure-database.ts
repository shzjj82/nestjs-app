import { ensureNamedDatabase, wechatDatabaseUrl } from '@app/common';

export async function ensureWechatDatabase() {
  await ensureNamedDatabase({
    targetUrl: wechatDatabaseUrl(),
    fallbackName: 'wechat',
    loggerContext: 'WechatDatabase',
  });
}
