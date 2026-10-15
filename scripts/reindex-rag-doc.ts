/**
 * 从 docs 库读一篇文档，MQTT 通知 agents 重建 RAG 索引。
 * 用法：npx ts-node -r tsconfig-paths/register scripts/reindex-rag-doc.ts [appCode] [slug]
 */
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { Client } from 'pg';
import { MQTT_PATTERNS, docsDatabaseUrl } from '../libs/common/src';

async function main() {
  const appCode = process.argv[2] || 'wiki';
  const slug = process.argv[3] || '文章';
  const docs = new Client({ connectionString: docsDatabaseUrl() });
  await docs.connect();
  const found = await docs.query(
    `SELECT id, app_code, slug, title, summary, body, author_id, team_id, visibility
     FROM doc_documents WHERE app_code = $1 AND slug = $2`,
    [appCode, slug],
  );
  const row = found.rows[0] as
    | {
        id: string;
        app_code: string;
        slug: string;
        title: string;
        summary: string;
        body: unknown;
        author_id: string | null;
        team_id: string | null;
        visibility: string;
      }
    | undefined;
  await docs.end();
  if (!row) {
    throw new Error(`文档不存在: ${appCode}/${slug}`);
  }

  const client = ClientProxyFactory.create({
    transport: Transport.MQTT,
    options: {
      url: process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883',
    },
  });
  await client.connect();
  const payload = {
    appCode: row.app_code,
    docId: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary ?? '',
    body: row.body,
    authorId: row.author_id,
    teamId: row.team_id,
    visibility: row.visibility === 'public' ? 'public' : 'private',
  };
  const indexResult = await new Promise<unknown>((resolve, reject) => {
    client.send(MQTT_PATTERNS.AGENTS_RAG_INDEX, payload).subscribe({
      next: (value) => resolve(value),
      error: (err) => reject(err),
    });
  });
  await client.close();
  console.log(`索引完成: ${appCode}/${slug} (${row.id})`, indexResult);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
