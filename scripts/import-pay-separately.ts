/**
 * 把 pay_separately 正式库导入现有服务。
 * 分享快照映射成传统订单（没有的状态默认 completed），识别记录原样进视觉任务。
 * 浏览、分摊、聚焦等分享字段不写入订单。
 * 可重复执行。不在服务启动时调用。
 *
 * 必填环境变量：
 *   SOURCE_DATABASE_URL  源库，库名不能是 *_dev
 *   DATABASE_URL         用户中心库
 *   BIZ_CODE             目标业务 code
 *   CLIENT_CODE          已登记的微信小程序接入端 appCode
 * 可选：
 *   ORDER_DATABASE_URL   默认把 DATABASE_URL 的库名换成 order
 *   AGENTS_DATABASE_URL  默认把 DATABASE_URL 的库名换成 agents
 *
 *   npx ts-node -r tsconfig-paths/register scripts/import-pay-separately.ts
 */
import { Client } from 'pg';

type OpenidRow = { openid: string; created_at: Date | null; last_login_at: Date | null };

type ShareRow = {
  id: string;
  payload: unknown;
  title: string | null;
  created_at: Date;
};

async function main() {
  const sourceUrl = requiredEnv('SOURCE_DATABASE_URL');
  const userUrl = requiredEnv('DATABASE_URL');
  const bizCode = requiredEnv('BIZ_CODE');
  const clientCode = requiredEnv('CLIENT_CODE');
  assertProductionSource(sourceUrl);

  const source = new Client({ connectionString: sourceUrl });
  const users = new Client({ connectionString: userUrl });
  const orders = new Client({ connectionString: namedDatabaseUrl(userUrl, 'ORDER_DATABASE_URL', 'order') });
  const agents = new Client({ connectionString: namedDatabaseUrl(userUrl, 'AGENTS_DATABASE_URL', 'agents') });
  await Promise.all([source.connect(), users.connect(), orders.connect(), agents.connect()]);
  try {
    const clientId = await requireClient(users, bizCode, clientCode);
    const openids = await loadOpenids(source);
    const accountIds = await importAccounts(users, clientId, openids);
    const orderCount = await importOrders(source, orders, bizCode);
    const jobCount = await importVision(source, agents, bizCode, accountIds);
    console.log(
      `导入完成：账户 ${accountIds.size}，订单 ${orderCount}，识别 ${jobCount}（业务 ${bizCode} / 接入端 ${clientCode}）`,
    );
  } finally {
    await Promise.all([source.end(), users.end(), orders.end(), agents.end()]);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

function assertProductionSource(url: string) {
  let name = '';
  try {
    name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    throw new Error('SOURCE_DATABASE_URL 不是合法的数据库地址');
  }
  if (!name || name.endsWith('_dev')) {
    throw new Error(`拒绝导入开发库：${name || '(空库名)'}。请使用正式库 pay_separately`);
  }
}

function namedDatabaseUrl(base: string, envName: string, database: string): string {
  if (process.env[envName]?.trim()) return process.env[envName]!.trim();
  const parsed = new URL(base);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

async function requireClient(users: Client, bizCode: string, clientCode: string): Promise<string> {
  const found = await users.query<{ id: string }>(
    `SELECT c.id
     FROM uc_clients c
     JOIN uc_businesses b ON b.id = c.business_id
     WHERE b.code = $1 AND c.app_code = $2 AND c.type = 'wechat_mp' AND c.status = 1 AND b.status = 1`,
    [bizCode, clientCode],
  );
  const id = found.rows[0]?.id;
  if (!id) {
    throw new Error(`业务 ${bizCode} 下没有已启用的微信接入端 ${clientCode}，请先在用户中心登记`);
  }
  return id;
}

async function loadOpenids(source: Client): Promise<OpenidRow[]> {
  const result = await source.query<OpenidRow>(
    `SELECT openid, created_at, last_login_at FROM (
       SELECT openid, created_at, last_login_at FROM users
       UNION
       SELECT openid, NULL::timestamptz, NULL::timestamptz FROM share_views
       UNION
       SELECT openid, NULL::timestamptz, NULL::timestamptz FROM ocr_jobs WHERE openid IS NOT NULL
     ) t
     WHERE openid IS NOT NULL AND btrim(openid) <> ''`,
  );
  const byId = new Map<string, OpenidRow>();
  for (const row of result.rows) {
    const prev = byId.get(row.openid);
    if (!prev || (row.created_at && !prev.created_at)) byId.set(row.openid, row);
  }
  return [...byId.values()];
}

async function importAccounts(users: Client, clientId: string, rows: OpenidRow[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const row of rows) {
    const existing = await users.query<{ id: string }>(
      `SELECT id FROM uc_accounts
       WHERE type = 'wechat_mp' AND client_id = $1 AND identifier = $2`,
      [clientId, row.openid],
    );
    if (existing.rows[0]) {
      map.set(row.openid, existing.rows[0].id);
      continue;
    }
    await users.query('BEGIN');
    try {
      const created = await users.query<{ id: string }>(
        `INSERT INTO uc_users (nickname, status, created_at, updated_at)
         VALUES ('微信用户', 1, COALESCE($1, now()), now())
         RETURNING id`,
        [row.created_at],
      );
      const account = await users.query<{ id: string }>(
        `INSERT INTO uc_accounts (user_id, type, identifier, client_id, status, last_login_at, created_at, updated_at)
         VALUES ($1, 'wechat_mp', $2, $3, 1, $4, COALESCE($5, now()), now())
         RETURNING id`,
        [created.rows[0].id, row.openid, clientId, row.last_login_at, row.created_at],
      );
      await users.query('COMMIT');
      map.set(row.openid, account.rows[0].id);
    } catch (error) {
      await users.query('ROLLBACK');
      throw error;
    }
  }
  return map;
}

async function importOrders(source: Client, orders: Client, bizCode: string): Promise<number> {
  const result = await source.query<ShareRow>(
    `SELECT id, payload, title, created_at FROM shares`,
  );
  for (const row of result.rows) {
    const payload = asObject(row.payload);
    const lines = orderLines(payload);
    const amount = money(payload.orderPaidTotal ?? payload.paidTotal) || lines.reduce((sum, line) => sum + line.amount, 0);
    await orders.query(
      `INSERT INTO od_orders (id, biz_code, account_id, status, title, amount, created_at, updated_at)
       VALUES ($1, $2, NULL, 'completed', $3, $4, $5, $5)
       ON CONFLICT (id) DO UPDATE SET
         biz_code = EXCLUDED.biz_code,
         status = EXCLUDED.status,
         title = EXCLUDED.title,
         amount = EXCLUDED.amount,
         created_at = EXCLUDED.created_at,
         updated_at = EXCLUDED.updated_at`,
      [row.id, bizCode, row.title ? String(row.title).slice(0, 80) : null, amount, row.created_at],
    );
    await orders.query(`DELETE FROM od_order_items WHERE order_id = $1`, [row.id]);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      await orders.query(
        `INSERT INTO od_order_items (order_id, name, quantity, price, amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [row.id, line.name, line.quantity, line.price, line.amount, index],
      );
    }
  }
  return result.rows.length;
}

function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value));
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function money(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount) : 0;
}

function orderLines(payload: Record<string, unknown>): Array<{ name: string; quantity: number; price: number; amount: number }> {
  if (!Array.isArray(payload.items)) return [];
  return payload.items.flatMap((item) => {
    const row = asObject(item);
    const name = typeof row.name === 'string' ? row.name.trim() : '';
    if (!name) return [];
    const quantity = Math.max(1, Math.round(Number(row.quantity) || 1));
    const amount = money(row.finalAmount ?? row.amount ?? row.originalSubtotal);
    const price = money(row.finalUnitPrice ?? row.price ?? amount);
    return [{ name: name.slice(0, 200), quantity, price, amount }];
  });
}

async function importVision(
  source: Client,
  agents: Client,
  bizCode: string,
  accountIds: Map<string, string>,
): Promise<number> {
  const jobs = await source.query<{
    id: string;
    openid: string | null;
    status: string;
    model: string | null;
    result: unknown;
    error_message: string | null;
    created_at: Date;
    finished_at: Date | null;
  }>(`SELECT id, openid, status, model, result, error_message, created_at, finished_at FROM ocr_jobs`);
  for (const job of jobs.rows) {
    const accountId = job.openid ? (accountIds.get(job.openid) ?? null) : null;
    await agents.query(
      `INSERT INTO ag_vision_jobs (id, biz_code, account_id, status, model, prompt, result, error_message, created_at, finished_at)
       VALUES ($1, $2, $3, $4, $5, NULL, $6::jsonb, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         biz_code = EXCLUDED.biz_code,
         account_id = EXCLUDED.account_id,
         status = EXCLUDED.status,
         model = EXCLUDED.model,
         result = EXCLUDED.result,
         error_message = EXCLUDED.error_message,
         created_at = EXCLUDED.created_at,
         finished_at = EXCLUDED.finished_at`,
      [
        job.id,
        bizCode,
        accountId,
        job.status || 'done',
        job.model,
        job.result == null ? null : JSON.stringify(job.result),
        job.error_message,
        job.created_at,
        job.finished_at,
      ],
    );
    await agents.query(`DELETE FROM ag_vision_images WHERE job_id = $1`, [job.id]);
    const images = await source.query<{ oss_key: string; oss_url: string; sort_order: number }>(
      `SELECT oss_key, oss_url, sort_order FROM ocr_images WHERE job_id = $1 ORDER BY sort_order, id`,
      [job.id],
    );
    for (const image of images.rows) {
      await agents.query(
        `INSERT INTO ag_vision_images (job_id, url, key, sort_order) VALUES ($1, $2, $3, $4)`,
        [job.id, image.oss_url, image.oss_key, image.sort_order ?? 0],
      );
    }
  }
  return jobs.rows.length;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '导入失败';
  console.error(message);
  process.exitCode = 1;
});
