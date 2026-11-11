/**
 * wiki（编辑器）业务开通脚本：登记业务并按 catalog + 编辑器必需接口写白名单。
 *
 * 环境变量见 deploy/wiki/.env.example。
 * 用法：npm run wiki:bootstrap
 */
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { MQTT_PATTERNS, mqttClientOptions } from '@app/common';
import { DEFAULT_FEATURE_CATALOG, bizApiKeys } from '@app/gateway-contract';

type BusinessRow = {
  id: string;
  code: string;
  name: string;
  apis: string[];
  status: number;
  defaultRoleId: string | null;
};

/** 功能点目录里要整组开通的能力 */
const FEATURE_CODES = new Set([
  'wiki.read',
  'wiki.write',
  'wiki.category.manage',
  'team.query',
  'team.manage',
  'agents.chat',
  'agents.rag',
  'notify.inbox',
  'todo.inbox',
  'upload.file',
]);

/**
 * 编辑器必需、且不一定落在上面 FEATURE_CODES 里的接口。
 * logout 无 business scope，会被 bizApiKeys 滤掉，留着无害。
 */
const BASELINE_EXTRA_APIS = [
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/logout',
  'GET /auth/me',
  'POST /auth/change-password',
  'POST /upload',
  'GET /agents/chat/status',
  'POST /agents/chat',
  'POST /agents/rag/search',
  'GET /notifications',
  'GET /notifications/unread-count',
  'GET /notifications/socket',
  'GET /notifications/:id',
  'POST /notifications/:id/read',
  'POST /notifications/read-all',
  'GET /todos',
  'GET /todos/open-count',
  'POST /todos',
  'GET /todos/:id',
  'PATCH /todos/:id',
  'POST /todos/:id/done',
  'POST /todos/:id/cancel',
];

function env(key: string, fallback?: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw;
}

function requiredEnv(key: string): string {
  const value = env(key);
  if (!value) {
    throw new Error(`缺少必填环境变量 ${key}，请参考 deploy/wiki/.env.example 配置`);
  }
  return value;
}

function csvEnv(key: string, fallback: string[]): string[] {
  const raw = env(key);
  if (!raw) return fallback;
  const items = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length ? items : fallback;
}

function resolveDesiredApis(extra: string[]): string[] {
  const legal = new Set(bizApiKeys());
  const fromCatalog = DEFAULT_FEATURE_CATALOG.filter(
    (item) => item.scope === 'business' && FEATURE_CODES.has(item.code),
  ).flatMap((item) => item.apis);

  const merged = [...fromCatalog, ...BASELINE_EXTRA_APIS, ...extra];
  return Array.from(new Set(merged.filter((key) => legal.has(key)))).sort();
}

async function call<T>(
  client: ClientProxy,
  pattern: string,
  payload: unknown,
  timeoutMs: number,
): Promise<T> {
  return firstValueFrom(
    client.send<T>(pattern, payload).pipe(timeout({ first: timeoutMs })),
  );
}

async function main() {
  const mqttUrl = requiredEnv('MQTT_URL');
  const timeoutMs = Number(env('WIKI_BOOTSTRAP_TIMEOUT_MS', '15000'));
  const dryRun = env('WIKI_BOOTSTRAP_DRY_RUN') === '1';

  const bizCode = env('WIKI_BIZ_CODE', 'wiki')!;
  const bizName = env('WIKI_BIZ_NAME', 'Wiki 编辑器')!;
  const desiredApis = resolveDesiredApis(csvEnv('WIKI_EXTRA_APIS', []));

  console.log('=== wiki 业务开通 ===');
  console.log(`MQTT:        ${mqttUrl}`);
  console.log(`业务:        ${bizCode} (${bizName})`);
  console.log(`待开通接口:  ${desiredApis.length} 个`);
  desiredApis.forEach((key) => console.log(`    ${key}`));
  console.log(dryRun ? '模式:        DRY-RUN（不落库）' : '模式:        执行');

  if (dryRun) {
    console.log('\nDRY-RUN 结束，未做任何变更。');
    return;
  }

  const client = ClientProxyFactory.create(mqttClientOptions('wiki-bootstrap'));
  await client.connect();
  try {
    const businesses = await call<BusinessRow[]>(
      client,
      MQTT_PATTERNS.BUSINESS_FIND_ALL,
      {},
      timeoutMs,
    );
    const existing = businesses.find((row) => row.code === bizCode);

    if (existing) {
      const missing = desiredApis.filter((key) => !existing.apis.includes(key));
      if (missing.length || existing.status !== 1) {
        await call(
          client,
          MQTT_PATTERNS.BUSINESS_UPDATE,
          {
            id: existing.id,
            apis: desiredApis,
            status: 1,
            name: bizName,
          },
          timeoutMs,
        );
        console.log(`\n[业务] 已存在，补充 ${missing.length} 个新接口并置为启用`);
      } else {
        console.log('\n[业务] 已存在且接口白名单已是最新，无需变更');
      }
    } else {
      const created = await call<BusinessRow>(
        client,
        MQTT_PATTERNS.BUSINESS_CREATE,
        {
          code: bizCode,
          name: bizName,
          description: 'Wiki 编辑器（团队与文档）',
          apis: desiredApis,
        },
        timeoutMs,
      );
      console.log(
        `\n[业务] 已创建 ${created.code}（defaultRoleId=${created.defaultRoleId ?? '-'}）`,
      );
    }

    console.log('\n=== 开通完成 ===');
    console.log('登录仍走 /auth/* → usercenter；团队与文档走 /wiki/*（/teams 别名仍可用）。');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('\n开通失败：', error?.message ?? error);
  process.exit(1);
});
