import { ensureNamedDatabase, recycleDatabaseUrl } from '@app/common';

/** 回收服务使用独立库 `recycle`，启动时确保库存在 */
export async function ensureRecycleDatabase() {
  await ensureNamedDatabase({
    targetUrl: recycleDatabaseUrl(),
    fallbackName: 'recycle',
    loggerContext: 'RecycleDatabase',
  });
}
