import { Logger } from '@nestjs/common';
import { databaseUrl, medicalDatabaseUrl } from '@app/common';
import { DataSource } from 'typeorm';

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return 'medical';
  }
}

/** 中医微服务使用独立库 `medical`，启动时确保库存在 */
export async function ensureMedicalDatabase() {
  const target = medicalDatabaseUrl();
  const name = databaseName(target);
  if (!name || name === 'postgres') {
    return;
  }
  const logger = new Logger('MedicalDatabase');
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
