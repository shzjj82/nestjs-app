#!/usr/bin/env node
'use strict';

/**
 * 回收最小部署 · 数据库小工具（建库 / 重置 / 看状态）
 *
 * 为什么要它：
 *   当前库里已经有跑通过的业务数据（订单、审批、目录种子…），再验证一遍时
 *   新数据混在旧数据里看不出效果。所以需要一套「另一张 database」从零跑。
 *   本工具负责把那套库建出来 / 清掉重建 / 打印状态，不碰业务代码。
 *
 * 用法：
 *   node deploy/recycle/db/tool.cjs ensure --admin <url> --dbs a,b,c
 *   node deploy/recycle/db/tool.cjs reset  --admin <url> --dbs a,b,c
 *   node deploy/recycle/db/tool.cjs report --urls "main=<url>,recycle=<url>,wechat=<url>"
 *
 * --admin 是「管理连接」，用来执行 CREATE/DROP DATABASE；填任意一个能连上的库
 * （脚本自己会换成 postgres 库），账号需要有 CREATEDB 权限。
 */

const { Client } = require('pg');

/** 读 env 文件里的若干键，输出 JSON（不做 shell 解析，值原样返回） */
function readEnvKeys(file, keys) {
  const fs = require('fs');
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const matched = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!matched) continue;
    const [, key, raw] = matched;
    if (keys.includes(key)) {
      out[key] = raw.trim().replace(/^["']|["']$/g, '');
    }
  }
  return out;
}

/** 就地改写 env 文件：已存在的键替换，不存在的追加到末尾。保留注释与其它内容 */
function writeEnvKeys(file, pairs) {
  const fs = require('fs');
  const lines = fs.existsSync(file)
    ? fs.readFileSync(file, 'utf8').split('\n')
    : [];
  const remaining = new Map(Object.entries(pairs));
  const out = [];
  for (const line of lines) {
    const matched = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (matched && remaining.has(matched[1])) {
      out.push(`${matched[1]}=${remaining.get(matched[1])}`);
      remaining.delete(matched[1]);
    } else {
      out.push(line);
    }
  }
  for (const [key, value] of remaining) {
    out.push(`${key}=${value}`);
  }
  fs.writeFileSync(file, out.join('\n'));
}

function parseArgs() {
  const out = { _: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = 'true';
      }
    } else {
      out._.push(token);
    }
  }
  return out;
}

/** 把任意业务库 URL 换成 postgres 库，用于 CREATE/DROP DATABASE */
function adminUrlOf(url) {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  parsed.search = '';
  return parsed.toString();
}

function dbNameOf(url) {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

function safeIdent(name) {
  return name.replace(/"/g, '');
}

async function existingDatabases(adminUrl) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    const res = await client.query(
      'SELECT datname FROM pg_database WHERE datistemplate = false',
    );
    return new Set(res.rows.map((row) => row.datname));
  } finally {
    await client.end();
  }
}

async function createDatabase(adminUrl, name) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${safeIdent(name)}"`);
  } finally {
    await client.end();
  }
}

async function dropDatabase(adminUrl, name) {
  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // 先掐掉残留连接，否则 DROP 会报 "database is being accessed by other users"
    await client.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [name],
    );
    await client.query(`DROP DATABASE IF EXISTS "${safeIdent(name)}"`);
  } finally {
    await client.end();
  }
}

async function sqlScalar(url, text, params) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query(text, params);
    return res.rows[0] ? Object.values(res.rows[0])[0] : null;
  } finally {
    await client.end();
  }
}

const KEY_TABLES = {
  main: ['uc_businesses', 'uc_users', 'uc_roles', 'uc_permissions', 'uc_teams'],
  recycle: [
    'recycle_cartridge_types',
    'recycle_brands',
    'recycle_models',
    'recycle_stores',
    'recycle_orders',
    'recycle_order_items',
    'recycle_order_events',
    'recycle_approval_tasks',
  ],
  wechat: ['wx_miniprograms', 'wx_users'],
  medical: ['users', 'patients', 'visits', 'case_records'],
};

async function reportOne(label, url) {
  const name = dbNameOf(url);
  const admin = adminUrlOf(url);
  const exists = (await existingDatabases(admin)).has(name);
  if (!exists) {
    console.log(`  [${label}] ${name}  —— 库不存在（服务启动时会自建）`);
    return;
  }
  let tables = 0;
  let size = '—';
  let migrations = '—';
  const counts = [];
  try {
    tables = Number(await sqlScalar(url, "SELECT count(*) FROM pg_tables WHERE schemaname='public'"));
    size = await sqlScalar(url, 'SELECT pg_size_pretty(pg_database_size($1))', [name]);
  } catch (err) {
    console.log(`  [${label}] ${name}  —— 连接失败: ${err.message}`);
    return;
  }
  try {
    // usercenter 用的是 synchronize 而非迁移，没有 migrations 表是正常的
    migrations = Number(await sqlScalar(url, 'SELECT count(*) FROM migrations'));
  } catch {
    migrations = '—';
  }
  for (const table of KEY_TABLES[label] || []) {
    try {
      const n = Number(await sqlScalar(url, `SELECT count(*) FROM "${table}"`));
      counts.push([table, n]);
    } catch {
      // 表还没建出来（迁移没跑），跳过
    }
  }
  const headline = `  [${label}] ${name}  · ${tables} 张表 · 迁移 ${migrations} 条 · ${size}`;
  console.log(headline);
  for (const [table, n] of counts) {
    console.log(`        ${String(n).padStart(6)}  ${table}`);
  }
}

async function main() {
  const args = parseArgs();
  const command = args._[0];

  if (command === 'ensure' || command === 'reset') {
    if (!args.admin || !args.dbs) {
      console.error('缺少参数：--admin <url> --dbs <name,name,...>');
      process.exit(1);
    }
    const adminUrl = adminUrlOf(args.admin);
    const names = args.dbs.split(',').map((x) => x.trim()).filter(Boolean);
    const existing = await existingDatabases(adminUrl);

    if (command === 'reset') {
      console.log(`即将删除并重建：${names.join(', ')}`);
      console.log('（3 秒后开始，Ctrl-C 可取消）');
      await new Promise((r) => setTimeout(r, 3000));
      for (const name of names) {
        if (existing.has(name)) {
          await dropDatabase(adminUrl, name);
          console.log(`  已删除 ${name}`);
        }
      }
    }

    for (const name of names) {
      // reset 时刚才已经删掉了，一定重建；ensure 时只补不存在的
      if (command === 'reset' || !existing.has(name)) {
        await createDatabase(adminUrl, name);
        console.log(`  已创建 ${name}`);
      } else {
        console.log(`  已存在 ${name}（保留原有数据）`);
      }
    }
    return;
  }

  if (command === 'readenv') {
    const values = readEnvKeys(args.file, args.keys.split(',').map((k) => k.trim()));
    console.log(JSON.stringify(values));
    return;
  }

  if (command === 'writeenv') {
    const pairs = {};
    for (const pair of args.set.split(',')) {
      const idx = pair.indexOf('=');
      if (idx > 0) pairs[pair.slice(0, idx).trim()] = pair.slice(idx + 1);
    }
    writeEnvKeys(args.file, pairs);
    for (const [key, value] of Object.entries(pairs)) {
      console.log(`  ${key}=${value.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
    }
    return;
  }

  if (command === 'reportenv') {
    // 从 env 文件读连接串，缺失的按 env.ts 的规则推导，然后出报表
    const file = args.file || 'deploy/recycle/.env';
    const values = readEnvKeys(file, [
      'USERCENTER_DATABASE_URL',
      'DATABASE_URL',
      'RECYCLE_DATABASE_URL',
      'WECHAT_DATABASE_URL',
    ]);
    const main = values.USERCENTER_DATABASE_URL || values.DATABASE_URL;
    if (!main) {
      console.error(`${file} 里没有 USERCENTER_DATABASE_URL`);
      process.exit(1);
    }
    if (!values.RECYCLE_DATABASE_URL || !values.WECHAT_DATABASE_URL) {
      console.error(`${file} 里需要同时写 RECYCLE_DATABASE_URL 和 WECHAT_DATABASE_URL`);
      process.exit(1);
    }
    console.log('=== 数据库状态 ===');
    await reportOne('main', main);
    await reportOne('recycle', values.RECYCLE_DATABASE_URL);
    await reportOne('wechat', values.WECHAT_DATABASE_URL);
    return;
  }

  if (command === 'report') {
    if (!args.urls) {
      console.error('缺少参数：--urls "main=<url>,recycle=<url>,wechat=<url>"');
      process.exit(1);
    }
    console.log('=== 数据库状态 ===');
    for (const pair of args.urls.split(',')) {
      const [label, ...rest] = pair.split('=');
      await reportOne(label.trim(), rest.join('=').trim());
    }
    return;
  }

  console.error('未知命令，可用：ensure | reset | report');
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
