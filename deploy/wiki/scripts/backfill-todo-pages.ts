/**
 * 治理 wiki 历史待办：给缺 page 关联的记录打标，或按 todoId=pageId 手工回填。
 *
 * 用法：
 *   set -a && . ./deploy/wiki/.env && set +a
 *   npx ts-node -T -r tsconfig-paths/register deploy/wiki/scripts/backfill-todo-pages.ts --mark-legacy
 *   npx ts-node -T -r tsconfig-paths/register deploy/wiki/scripts/backfill-todo-pages.ts \
 *     --bind <todoId>=<pageId> --bind <todoId>=<pageId>
 *
 * 默认 DRY_RUN=1；真正写入设 WIKI_TODO_BACKFILL_DRY_RUN=0
 */
import { Client } from 'pg';
import { notifyDatabaseUrl, wikiDatabaseUrl } from '@app/common';

type TodoRow = {
  id: string;
  title: string;
  status: string;
  data: Record<string, unknown> | null;
};

type DocRow = {
  id: string;
  title: string;
  slug: string;
  app_code: string;
  kind: string;
};

const biz = process.env.WIKI_BIZ_CODE?.trim() || 'wiki';
const dryRun = process.env.WIKI_TODO_BACKFILL_DRY_RUN !== '0';
const markLegacy = process.argv.includes('--mark-legacy');
const binds = process.argv
  .filter((arg) => arg.startsWith('--bind='))
  .map((arg) => arg.slice('--bind='.length))
  .concat(
    process.argv.flatMap((arg, i, arr) =>
      arg === '--bind' && arr[i + 1] ? [arr[i + 1]] : [],
    ),
  )
  .map((pair) => {
    const [todoId, pageId] = pair.split('=');
    return { todoId: todoId?.trim(), pageId: pageId?.trim() };
  })
  .filter((row): row is { todoId: string; pageId: string } => !!row.todoId && !!row.pageId);

async function main() {
  if (!markLegacy && binds.length === 0) {
    console.error('请指定 --mark-legacy 和/或 --bind <todoId>=<pageId>');
    process.exit(1);
  }

  const notify = new Client({ connectionString: notifyDatabaseUrl() });
  const docs = new Client({ connectionString: wikiDatabaseUrl() });
  await notify.connect();
  await docs.connect();

  try {
    const todos = await listMissing(notify);
    console.log(`biz=${biz} dryRun=${dryRun ? 1 : 0}`);
    console.log(`缺 page 的 wiki 待办：${todos.length}`);
    for (const row of todos) {
      console.log(`- ${row.id} [${row.status}] ${row.title}`);
    }

    if (markLegacy) {
      for (const row of todos) {
        const data = {
          ...(row.data ?? {}),
          legacyWithoutPage: true,
        };
        await writeData(notify, row.id, data);
        console.log(`${dryRun ? 'DRY ' : ''}mark-legacy ${row.id}`);
      }
    }

    for (const bind of binds) {
      const todo = await oneTodo(notify, bind.todoId);
      if (!todo) {
        console.error(`待办不存在: ${bind.todoId}`);
        continue;
      }
      const page = await oneDoc(docs, bind.pageId);
      if (!page) {
        console.error(`页面不存在: ${bind.pageId}`);
        continue;
      }
      const data = {
        ...(todo.data ?? {}),
        pageId: page.id,
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          appCode: page.app_code,
          kind: page.kind,
        },
      };
      delete (data as { legacyWithoutPage?: boolean }).legacyWithoutPage;
      await writeData(notify, todo.id, data);
      console.log(
        `${dryRun ? 'DRY ' : ''}bind ${todo.id} -> ${page.id} (${page.title})`,
      );
    }
  } finally {
    await notify.end();
    await docs.end();
  }
}

async function listMissing(client: Client): Promise<TodoRow[]> {
  const result = await client.query<TodoRow>(
    `SELECT id, title, status, data
     FROM nt_todos
     WHERE biz_code = $1
       AND (data IS NULL OR NOT (data ? 'pageId' OR data ? 'page'))
     ORDER BY created_at`,
    [biz],
  );
  return result.rows;
}

async function oneTodo(client: Client, id: string): Promise<TodoRow | null> {
  const result = await client.query<TodoRow>(
    `SELECT id, title, status, data FROM nt_todos WHERE id = $1 AND biz_code = $2`,
    [id, biz],
  );
  return result.rows[0] ?? null;
}

async function oneDoc(client: Client, id: string): Promise<DocRow | null> {
  const result = await client.query<DocRow>(
    `SELECT id, title, slug, app_code, kind FROM doc_documents WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function writeData(
  client: Client,
  id: string,
  data: Record<string, unknown>,
): Promise<void> {
  if (dryRun) {
    return;
  }
  await client.query(`UPDATE nt_todos SET data = $2::jsonb, updated_at = now() WHERE id = $1`, [
    id,
    JSON.stringify(data),
  ]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
