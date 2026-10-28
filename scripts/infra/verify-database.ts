/**
 * 基础设施冒烟验证：确认「recycle 最小部署」的前置条件都满足。
 *
 * 检查项：
 *   1. PostgreSQL 连通与版本
 *   2. 必需的数据库是否存在（nestjs / wechat / recycle）
 *   3. gen_random_uuid() 是否可用
 *      —— recycle 的初始迁移直接用了它，PG13 才内置；
 *         生产那台 PG12 就是因为缺这个导致 recycle 起来就崩（需装 pgcrypto）
 *   4. 当前账号是否有 CREATEDB 权限
 *      —— recycle 启动时会自己 CREATE DATABASE，没这个权限会 42501 报错
 *   5. 测试表：建表 → 写入 → 读取 → 清理（真正验证读写链路）
 *   6. pgvector 是否可用（只报告，最小部署不跑 agents 所以不是硬要求）
 *   7. Redis PING
 *   8. MQTT 连通
 *
 * 用法：
 *   npm run verify:db
 *   # 或
 *   npx ts-node -T scripts/infra/verify-database.ts
 *
 * 环境变量（默认取 docker-compose 的默认值）：
 *   DATABASE_URL / REDIS_URL / MQTT_URL
 */
import { Client } from 'pg';
import Redis from 'ioredis';
import * as mqtt from 'mqtt';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';

const TEST_TABLE = '_deploy_smoke_check';

type CheckResult = { name: string; ok: boolean; detail: string; optional?: boolean };

const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string, optional = false) {
  results.push({ name, ok, detail, optional });
  const tag = ok ? 'PASS' : optional ? 'WARN' : 'FAIL';
  console.log(`  [${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

function databaseName(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  } catch {
    return 'postgres';
  }
}

async function checkPostgres() {
  console.log('\n=== PostgreSQL ===');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
  } catch (error) {
    record('连通性', false, (error as Error).message);
    return null;
  }

  try {
    const version = await client.query('SELECT version() AS v');
    record('连通性', true, String(version.rows[0].v).split(',')[0]);

    // 2. 必需库
    const required = ['nestjs', 'wechat', 'recycle'];
    const dbRows = await client.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false',
    );
    const existing = new Set(dbRows.rows.map((row: { datname: string }) => row.datname));
    const missing = required.filter((name) => !existing.has(name));
    record(
      '必需数据库',
      missing.length === 0,
      missing.length
        ? `缺少 ${missing.join(', ')}（recycle 会在服务启动时自动建）`
        : required.join(', ') + ' 均存在',
    );

    // 3. gen_random_uuid —— 回收迁移的硬依赖
    try {
      await client.query('SELECT gen_random_uuid()');
      record('gen_random_uuid()', true, '可用');
    } catch {
      record('gen_random_uuid()', false, '不可用，需 CREATE EXTENSION pgcrypto');
    }

    // 4. CREATEDB 权限 —— recycle 自动建库的硬依赖
    const canCreate = await client.query(
      'SELECT rolcreatedb FROM pg_roles WHERE rolname = current_user',
    );
    const createdb = canCreate.rows[0]?.rolcreatedb === true;
    record(
      'CREATEDB 权限',
      createdb,
      createdb
        ? `账号 ${(await client.query('SELECT current_user AS u')).rows[0].u} 可建库`
        : '不能建库，recycle 启动会报 42501，请 ALTER ROLE <user> CREATEDB',
    );

    // 5. 测试表：完整走一遍建表 / 写入 / 读取 / 清理
    try {
      await client.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      await client.query(`
        CREATE TABLE ${TEST_TABLE} (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          label varchar(64) NOT NULL,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          amount integer NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      const inserted = await client.query(
        `INSERT INTO ${TEST_TABLE} (label, payload, amount)
         VALUES ($1, $2, $3) RETURNING id, label, amount, created_at`,
        ['smoke', JSON.stringify({ scene: 'PRICE_OFFERED', ok: true }), 1500],
      );
      const row = inserted.rows[0];
      const read = await client.query(
        `SELECT payload->>'scene' AS scene FROM ${TEST_TABLE} WHERE id = $1`,
        [row.id],
      );
      const roundTripOk =
        row.amount === 1500 && read.rows[0]?.scene === 'PRICE_OFFERED';
      record(
        '测试表 CRUD',
        roundTripOk,
        roundTripOk
          ? `建表/写入/读取均正常（id=${String(row.id).slice(0, 8)}…, jsonb 可取字段）`
          : '写入后读回的内容不一致',
      );
    } catch (error) {
      record('测试表 CRUD', false, (error as Error).message);
    } finally {
      await client.query(`DROP TABLE IF EXISTS ${TEST_TABLE}`);
      console.log('  (测试表已清理)');
    }

    // 6. pgvector —— 只在 agents 库里才有意义（init 脚本只给它装了 vector），
    //    主库本来就没有这个扩展，别在主库上测，否则会误报。
    const agentsUrl = databaseUrl.replace(/\/[^/?]+(\?|$)/, '/agents$1');
    const agentsClient = new Client({ connectionString: agentsUrl });
    try {
      await agentsClient.connect();
      const ext = await agentsClient.query(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'",
      );
      if (ext.rows.length) {
        await agentsClient.query("SELECT '[1,2,3]'::vector");
        record('pgvector(agents 库)', true, `v${ext.rows[0].extversion} 可用`, true);
      } else {
        record('pgvector(agents 库)', false, 'agents 库未启用 vector 扩展', true);
      }
    } catch (error) {
      record(
        'pgvector(agents 库)',
        false,
        `跳过：${(error as Error).message}（最小部署不跑 agents，不影响回收业务）`,
        true,
      );
    } finally {
      await agentsClient.end().catch(() => undefined);
    }

    return client;
  } finally {
    // 连接交给调用方决定是否关闭
  }
}

async function checkRedis() {
  console.log('\n=== Redis ===');
  const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    await redis.connect();
    const pong = await redis.ping();
    record('PING', pong === 'PONG', `回应 ${pong}`);
  } catch (error) {
    record('PING', false, (error as Error).message);
  } finally {
    redis.disconnect();
  }
}

async function checkMqtt() {
  console.log('\n=== MQTT ===');
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      record('连通性', false, '连接超时（5s）');
      resolve();
    }, 5000);
    const client = mqtt.connect(mqttUrl, { connectTimeout: 4000 });
    client.on('connect', () => {
      clearTimeout(timer);
      record('连通性', true, mqttUrl);
      client.end(true);
      resolve();
    });
    client.on('error', (error) => {
      clearTimeout(timer);
      record('连通性', false, error.message);
      client.end(true);
      resolve();
    });
  });
}

async function main() {
  console.log('recycle 最小部署 · 基础设施冒烟验证');
  console.log('DATABASE_URL:', databaseUrl.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@'));
  console.log('REDIS_URL:   ', redisUrl);
  console.log('MQTT_URL:    ', mqttUrl);

  const client = await checkPostgres();
  if (client) await client.end();
  await checkRedis();
  await checkMqtt();

  const hard = results.filter((item) => !item.optional);
  const failed = hard.filter((item) => !item.ok);
  const warned = results.filter((item) => item.optional && !item.ok);

  console.log('\n=== 汇总 ===');
  console.log(`  通过 ${hard.length - failed.length}/${hard.length}${warned.length ? `，告警 ${warned.length} 项` : ''}`);
  if (failed.length) {
    console.log('  未通过：');
    failed.forEach((item) => console.log(`    - ${item.name}: ${item.detail}`));
    process.exit(1);
  }
  console.log('  基础设施就绪，可以跑 npm run recycle:start');
}

main().catch((error) => {
  console.error('验证脚本自身出错：', error);
  process.exit(1);
});
