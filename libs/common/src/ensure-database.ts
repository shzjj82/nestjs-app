import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { databaseUrl } from './env';

export function databaseNameFromUrl(url: string, fallback: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return fallback;
  }
}

/** 在共享 Postgres 上确保目标库存在；各微服务启动时共用 */
export async function ensureNamedDatabase(input: {
  targetUrl: string;
  fallbackName: string;
  loggerContext: string;
}): Promise<void> {
  const name = databaseNameFromUrl(input.targetUrl, input.fallbackName);
  if (!name || name === 'postgres') {
    return;
  }
  const logger = new Logger(input.loggerContext);
  const admin = new DataSource({
    type: 'postgres',
    url: databaseUrl(),
  });
  await admin.initialize();
  try {
    const found = await admin.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [name],
    );
    if (!found.length) {
      const safe = name.replace(/"/g, '');
      await admin.query(`CREATE DATABASE "${safe}"`);
      logger.log(`已创建数据库 ${safe}`);
    }
  } finally {
    await admin.destroy();
  }
}
