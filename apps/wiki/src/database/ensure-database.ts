import { Logger } from '@nestjs/common';
import {
  databaseNameFromUrl,
  databaseUrl,
  wikiDatabaseUrl,
  ensureNamedDatabase,
} from '@app/common';
import { DataSource } from 'typeorm';

/** 确保文档共用库存在（默认即 docs） */
export async function ensureWikiDatabase() {
  await ensureNamedDatabase({
    targetUrl: wikiDatabaseUrl(),
    fallbackName: 'docs',
    loggerContext: 'WikiDatabase',
  });
}

export function isSharedSameAsWiki(): boolean {
  return (
    databaseNameFromUrl(databaseUrl(), 'nestjs') ===
    databaseNameFromUrl(wikiDatabaseUrl(), 'docs')
  );
}

export async function dropLegacySharedDocTables(logger: Logger) {
  if (isSharedSameAsWiki()) {
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
    logger.log('已清理共享库中已迁走的 doc_documents / doc_categories');
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
