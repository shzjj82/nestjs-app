/**
 * medical 最小部署「一条命令开通」脚本。
 *
 *   1. 登记 medical 业务，并开通它的接口白名单（apis）
 *      —— business.create 会顺带建好 customer 身份角色、回填 defaultRoleId、
 *         并把 biz:registry 写进 Redis，网关才能放行 X-Biz-Code: medical；
 *   2. 登记 web 接入端（uc_clients）；
 *   3. 补齐医生 / 医助等业务身份角色（customer 由第 1 步自动产生）。
 *
 * 诊所登录本身走 medical 自己的 token，不依赖 usercenter JWT；
 * 但仍要开通业务白名单，否则网关会拒绝 /medical/* 。
 */
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import {
  MQTT_PATTERNS,
  mqttClientOptions,
  DEFAULT_FEATURE_CATALOG,
  bizApiKeys,
} from '@app/common';

type RoleRow = { id: string; code: string; name: string };
type BusinessRow = {
  id: string;
  code: string;
  name: string;
  apis: string[];
  status: number;
  defaultRoleId: string | null;
};
type ClientRow = {
  id: string;
  appCode: string;
  businessId: string;
  type: string;
  status: number;
};

const BASELINE_EXTRA_APIS = [
  'POST /auth/login',
  'POST /auth/refresh',
  'GET /auth/me',
  'POST /upload',
];

function env(key: string, fallback?: string): string | undefined {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  return raw;
}

function requiredEnv(key: string): string {
  const value = env(key);
  if (!value) {
    throw new Error(`缺少必填环境变量 ${key}，请参考 deploy/medical/.env.example 配置`);
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
    (item) => item.scope === 'business' && item.code.startsWith('medical.'),
  ).flatMap((item) => item.apis);

  const merged = [...fromCatalog, ...BASELINE_EXTRA_APIS, ...extra];
  const filtered = merged.filter((key) => legal.has(key));
  return Array.from(new Set(filtered)).sort();
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
  const timeoutMs = Number(env('MEDICAL_BOOTSTRAP_TIMEOUT_MS', '15000'));
  const dryRun = env('MEDICAL_BOOTSTRAP_DRY_RUN') === '1';

  const bizCode = env('MEDICAL_BIZ_CODE', 'medical')!;
  const bizName = env('MEDICAL_BIZ_NAME', '中医诊所')!;
  const desiredApis = resolveDesiredApis(csvEnv('MEDICAL_EXTRA_APIS', []));

  console.log('=== medical 最小部署开通 ===');
  console.log(`MQTT:        ${mqttUrl}`);
  console.log(`业务:        ${bizCode} (${bizName})`);
  console.log(`待开通接口:  ${desiredApis.length} 个`);
  desiredApis.forEach((key) => console.log(`    ${key}`));
  console.log(dryRun ? '模式:        DRY-RUN（不落库）' : '模式:        执行');

  if (dryRun) {
    console.log('\nDRY-RUN 结束，未做任何变更。');
    return;
  }

  const client = ClientProxyFactory.create(mqttClientOptions('medical-bootstrap'));
  await client.connect();
  try {
    const businesses = await call<BusinessRow[]>(
      client,
      MQTT_PATTERNS.BUSINESS_FIND_ALL,
      {},
      timeoutMs,
    );
    const existing = businesses.find((row) => row.code === bizCode);

    let businessId: string;
    if (existing) {
      const missing = desiredApis.filter((key) => !existing.apis.includes(key));
      if (missing.length || existing.status !== 1) {
        await call(client, MQTT_PATTERNS.BUSINESS_UPDATE, {
          id: existing.id,
          apis: desiredApis,
          status: 1,
          name: bizName,
        }, timeoutMs);
        console.log(`\n[业务] 已存在，补充 ${missing.length} 个新接口并置为启用`);
      } else {
        console.log('\n[业务] 已存在且接口白名单已是最新，无需变更');
      }
      businessId = existing.id;
    } else {
      const created = await call<BusinessRow>(client, MQTT_PATTERNS.BUSINESS_CREATE, {
        code: bizCode,
        name: bizName,
        description: '中医医案沉淀与智能诊疗',
        apis: desiredApis,
      }, timeoutMs);
      console.log(`\n[业务] 已创建 ${created.code}（defaultRoleId=${created.defaultRoleId ?? '-'}）`);
      businessId = created.id;
    }

    const clientCode = env('MEDICAL_CLIENT_CODE', bizCode)!;
    const clients = await call<ClientRow[]>(
      client,
      MQTT_PATTERNS.CLIENT_FIND_ALL,
      { businessId },
      timeoutMs,
    );
    const existingClient = clients.find((row) => row.appCode === clientCode);
    if (existingClient) {
      const payload: Record<string, unknown> = { id: existingClient.id };
      let changed = false;
      if (existingClient.type !== 'web') {
        payload.type = 'web';
        changed = true;
      }
      if (existingClient.status !== 1) {
        payload.status = 1;
        changed = true;
      }
      if (changed) {
        await call(client, MQTT_PATTERNS.CLIENT_UPDATE, payload, timeoutMs);
        console.log(`[接入端] ${clientCode} 已存在，校正为 web`);
      } else {
        console.log(`[接入端] ${clientCode} 已存在且配置正确，无需变更`);
      }
    } else {
      await call(client, MQTT_PATTERNS.CLIENT_CREATE, {
        clientCode,
        name: bizName,
        businessId,
        type: 'web',
      }, timeoutMs);
      console.log(`[接入端] 已创建 ${clientCode}（type=web）`);
    }

    const roles = await call<RoleRow[]>(
      client,
      MQTT_PATTERNS.ROLE_FIND_ALL,
      { businessId },
      timeoutMs,
    );
    const wanted = csvEnv('MEDICAL_ROLES', ['doctor', 'assistant']);
    const wantedNames: Record<string, string> = {
      doctor: '医生',
      assistant: '医助',
      admin: '超管',
    };
    for (const code of wanted) {
      if (roles.some((row) => row.code === code)) {
        console.log(`[角色] ${code} 已存在，跳过`);
        continue;
      }
      try {
        await call(client, MQTT_PATTERNS.ROLE_CREATE, {
          code,
          name: wantedNames[code] ?? code,
          businessId,
        }, timeoutMs);
        console.log(`[角色] 已创建 ${code}`);
      } catch (error) {
        const status = (error as { status?: number })?.status;
        if (status === 409) {
          console.log(`[角色] ${code} 已存在（409），跳过`);
        } else {
          throw error;
        }
      }
    }

    console.log('\n=== 开通完成 ===');
    console.log('诊所登录：POST /medical/auth/login ，Header X-Biz-Code: medical');
    console.log('默认账号 doctor / assistant，密码见 AUTH_BOOTSTRAP_PASSWORD');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('\n开通失败：', error?.message ?? error);
  process.exit(1);
});
