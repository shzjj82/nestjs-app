import { Logger } from '@nestjs/common';
import { databaseUrl, docsDatabaseUrl } from '@app/common';
import { DataSource } from 'typeorm';

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return 'docs';
  }
}

export async function ensureDocsDatabase() {
  const target = docsDatabaseUrl();
  const name = databaseName(target);
  if (!name || name === 'postgres') {
    return;
  }
  const logger = new Logger('DocsDatabase');
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

export function isSharedSameAsDocs(): boolean {
  return databaseName(databaseUrl()) === databaseName(docsDatabaseUrl());
}

export async function dropLegacySharedDocTables(logger: Logger) {
  if (isSharedSameAsDocs()) {
    return;
  }
  const src = await openSharedDatabase();
  if (!src) {
    return;
  }
  try {
    const exists = await src.query(
      `SELECT to_regclass('public.doc_documents') AS name`,
    );
    if (!exists[0]?.name) {
      return;
    }
    await src.query('DROP TABLE IF EXISTS doc_documents CASCADE');
    await src.query('DROP TABLE IF EXISTS doc_categories CASCADE');
    await src.query('DROP TABLE IF EXISTS doc_site');
    await src.query('DROP TABLE IF EXISTS doc_posts');
    logger.log('已清理共享库中的旧 doc_* 表');
  } finally {
    await src.destroy();
  }
}

export async function openSharedDatabase(): Promise<DataSource | null> {
  const shared = new DataSource({
    type: 'postgres',
    url: databaseUrl(),
  });
  try {
    await shared.initialize();
    return shared;
  } catch {
    return null;
  }
}
