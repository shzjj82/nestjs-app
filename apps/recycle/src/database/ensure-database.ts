import { Logger } from '@nestjs/common';
import { databaseUrl, recycleDatabaseUrl } from '@app/common';
import { DataSource } from 'typeorm';

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return 'recycle';
  }
}

/** 回收服务使用独立库 `recycle`，启动时确保库存在 */
export async function ensureRecycleDatabase() {
  const target = recycleDatabaseUrl();
  const name = databaseName(target);
  if (!name || name === 'postgres') {
    return;
  }
  const logger = new Logger('RecycleDatabase');
  const admin = new DataSource({ type: 'postgres', url: databaseUrl() });
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
