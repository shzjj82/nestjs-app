import { ensureNamedDatabase, orderDatabaseUrl } from '@app/common';

export async function ensureOrderDatabase() {
  await ensureNamedDatabase({
    targetUrl: orderDatabaseUrl(),
    fallbackName: 'order',
    loggerContext: 'OrderDatabase',
  });
}
