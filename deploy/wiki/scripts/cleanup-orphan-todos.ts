/**
 * 清理「页面已删、待办仍挂着」的 wiki 脏数据。
 *
 * 用法：
 *   set -a && . ./.env && set +a
 *   npx ts-node -T -r tsconfig-paths/register deploy/wiki/scripts/cleanup-orphan-todos.ts
 *   WIKI_TODO_CLEANUP_DRY_RUN=0 npx ts-node -T -r tsconfig-paths/register deploy/wiki/scripts/cleanup-orphan-todos.ts
 *
 * 默认 DRY_RUN=1；真正删除设 WIKI_TODO_CLEANUP_DRY_RUN=0
 */
import { Client } from 'pg';
import { notifyDatabaseUrl, wikiDatabaseUrl } from '@app/common';

type OrphanRow = {
  id: string;
  title: string;
  status: string;
  pageId: string | null;
};

const biz = process.env.WIKI_BIZ_CODE?.trim() || 'wiki';
const dryRun = process.env.WIKI_TODO_CLEANUP_DRY_RUN !== '0';

async function main() {
  const notify = new Client({ connectionString: notifyDatabaseUrl() });
  const docs = new Client({ connectionString: wikiDatabaseUrl() });
  await notify.connect();
  await docs.connect();

  try {
    const orphans = await listOrphans(notify, docs);
    console.log(`biz=${biz} dryRun=${dryRun ? 1 : 0}`);
    console.log(`孤儿 wiki 待办：${orphans.length}`);
    for (const row of orphans) {
      console.log(`- ${row.id} [${row.status}] page=${row.pageId ?? '-'} ${row.title}`);
    }
    if (!orphans.length) {
      return;
    }
    if (dryRun) {
      console.log('DRY-RUN：未删除。设 WIKI_TODO_CLEANUP_DRY_RUN=0 后执行真正删除。');
      return;
    }
    const ids = orphans.map((row) => row.id);
    const deleted = await notify.query(
      `DELETE FROM nt_todos WHERE id = ANY($1::uuid[]) RETURNING id`,
      [ids],
    );
    console.log(`已删除 ${deleted.rowCount ?? 0} 条`);
  } finally {
    await notify.end();
    await docs.end();
  }
}

async function listOrphans(notify: Client, docs: Client): Promise<OrphanRow[]> {
  const todos = await notify.query<{
    id: string;
    title: string;
    status: string;
    page_id: string | null;
  }>(
    `
      SELECT id,
             title,
             status,
             NULLIF(COALESCE(data->>'pageId', data->'page'->>'id'), '') AS page_id
      FROM nt_todos
      WHERE biz_code = $1
        AND source = 'wiki'
      ORDER BY created_at ASC
    `,
    [biz],
  );

  const withPage = todos.rows.filter((row) => !!row.page_id);
  if (!withPage.length) {
    return [];
  }

  const pageIds = [...new Set(withPage.map((row) => row.page_id as string))];
  const existing = await docs.query<{ id: string }>(
    `SELECT id::text AS id FROM doc_documents WHERE id = ANY($1::uuid[])`,
    [pageIds],
  );
  const alive = new Set(existing.rows.map((row) => row.id));
  return withPage
    .filter((row) => !alive.has(row.page_id as string))
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      pageId: row.page_id,
    }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
