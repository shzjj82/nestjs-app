import { ensureNamedDatabase, notifyDatabaseUrl } from '@app/common';

/** 通知服务使用独立库 `notify`，启动时确保库存在 */
export async function ensureNotifyDatabase() {
  await ensureNamedDatabase({
    targetUrl: notifyDatabaseUrl(),
    fallbackName: 'notify',
    loggerContext: 'NotifyDatabase',
  });
}
