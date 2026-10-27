/**
 * recycle 最小部署「一条命令开通」脚本。
 *
 * 目标：新的环境里不用登录 admin 后台手工点，只要基础设施（MQTT + Postgres + Redis）
 * 起来、五个最小服务跑起来，执行本脚本即可完成：
 *
 *   1. 登记 recycle 业务，并开通它的接口白名单（apis）
 *      —— business.create 会顺带建好 customer 身份角色、回填 defaultRoleId、
 *         并把 biz:registry 写进 Redis，网关才能放行 X-Biz-Code: recycle；
 *   2. 登记 wechat_mp 接入端（uc_clients）—— /auth/wechat 靠它定位小程序；
 *   3. 补齐业务员 / 超管等业务身份角色（customer 由第 1 步自动产生，不用管）；
 *   4. 登记微信小程序（appId / secret）并写入订阅消息模板（4 个回收场景）。
 *
 * 设计约束（很重要）：
 *   - **不改动任何业务代码**：本脚本只经 MQTT 调用已有的 @MessagePattern，
 *     业务逻辑全部复用服务里的实现，行为与后台点按钮完全一致；
 *   - **接口白名单按「当前代码」动态推导**，不是写死的列表
 *     —— 所以网关路由 / 功能点目录改了以后，重跑本脚本就会自动对齐；
 *   - **幂等**：已存在就走 update 分支，重复执行不会产生脏数据；
 *   - **只做最小集**：不含 teams / orders / docs / agents 相关接口，
 *     因为最小部署不跑 order / docs / agents 三个服务，开了也调不通。
 *
 * 环境变量（见 .env.recycle.example）：
 *   必填
 *     MQTT_URL                      MQTT 地址，如 mqtt://127.0.0.1:1883
 *     WECHAT_APP_ID                 小程序 appId（同时写进接入端的 wechatAppId）
 *     WECHAT_SECRET                 小程序 secret
 *   可选
 *     RECYCLE_BIZ_CODE              业务 code，默认 recycle
 *     RECYCLE_BIZ_NAME              业务名称，默认 回收
 *     WECHAT_MP_CODE                小程序登记 code，默认与业务 code 相同（两者 1:1）
 *     WECHAT_MP_NAME                小程序名称，默认 墨盒回收
 *     RECYCLE_ROLES                 要额外创建的身份角色，逗号分隔，默认 agent,admin
 *     RECYCLE_CLIENT_CODE           接入端 code，默认与业务 code 相同
 *     RECYCLE_SUBSCRIBE_TEMPLATES   订阅模板 JSON，见下方 SCENE_DEFAULT_FIELDS 说明
 *     RECYCLE_EXTRA_APIS            额外追加开通的接口，逗号分隔（`POST /xxx` 形式）
 *     RECYCLE_BOOTSTRAP_TIMEOUT_MS  单次 MQTT 调用超时，默认 15000
 *     RECYCLE_BOOTSTRAP_DRY_RUN     设为 1 只打印计划、不落库
 *
 * 用法：
 *   npx ts-node -r tsconfig-paths/register scripts/recycle-bootstrap.ts
 *
 * 幂等性说明：脚本靠 code 唯一 + 409 判定已存在，因此可以在任何时刻重跑；
 * 升级网关路由后重跑即可把新接口补进白名单。
 */
import { ClientProxy, ClientProxyFactory } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { MQTT_PATTERNS, mqttClientOptions } from '@app/common';
import { DEFAULT_FEATURE_CATALOG } from '../libs/common/src/feature-catalog';
import { bizApiKeys } from '../libs/common/src/gateway-routes';

type RoleRow = { id: string; code: string; name: string };
type BusinessRow = {
  id: string;
  code: string;
  name: string;
  apis: string[];
  status: number;
  defaultRoleId: string | null;
};
type MiniProgramRow = { id: string; code: string; appId: string; subscribeTemplates: unknown };
type ClientRow = {
  id: string;
  appCode: string;
  businessId: string;
  type: string;
  wechatAppId: string | null;
  status: number;
};

/** 4 个回收订阅场景的默认字段映射；键必须与 SUBSCRIBE_SEMANTICS 白名单一致 */
const SCENE_DEFAULT_FIELDS: Record<string, Record<string, string>> = {
  PRICE_OFFERED: {
    character_string1: 'orderCode',
    phrase2: 'statusLabel',
    amount3: 'amount',
  },
  NEGOTIATE_RESULT: {
    character_string1: 'orderCode',
    phrase2: 'statusLabel',
    amount3: 'amount',
  },
  PAID: { character_string1: 'orderCode', amount2: 'amount', phrase3: 'statusLabel' },
  RETURN: { character_string1: 'orderCode', phrase2: 'statusLabel', thing3: 'title' },
};

/**
 * 回收业务除了自己的功能点之外，还依赖的「平台级但要按业务开通」的接口。
 * 刻意排除：
 *   - /auth/register、/auth/change-password：回收端没有自助注册入口；
 *   - /auth/alipay：不用支付宝小程序；
 *   - /teams/*、/orders/*、/docs/*、/agents/*：最小部署不跑对应服务。
 */
const BASELINE_EXTRA_APIS = [
  'POST /auth/login',
  'POST /auth/wechat',
  'POST /auth/refresh',
  'GET /auth/me',
  'POST /auth/login/qrcode',
  'POST /auth/login/qrcode/scan',
  'POST /auth/login/qrcode/confirm',
  'GET /auth/login/qrcode/:ticket',
  'GET /auth/login/qrcode/:ticket/events',
  'POST /wechat/phone',
  'GET /wechat/subscribe-templates',
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
    throw new Error(`缺少必填环境变量 ${key}，请参考 .env.recycle.example 配置`);
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

/**
 * 按「当前代码」推导 recycle 应开通的接口白名单。
 *
 * 取两部分的并集再与 bizApiKeys() 求交集：
 *   1. 功能点目录里 recycle.* 的 apis —— 跟着 feature-catalog 走，永远是最新的；
 *   2. 上面 BASELINE_EXTRA_APIS —— 回收链路用到的 auth / wechat / upload 接口。
 *
 * 求交集是因为 businesses.service.parseApis 只认 bizApiKeys()，
 * 传进去别的值会被静默丢掉。
 */
function resolveDesiredApis(extra: string[]): string[] {
  const legal = new Set(bizApiKeys());
  const fromCatalog = DEFAULT_FEATURE_CATALOG.filter(
    (item) => item.scope === 'business' && item.code.startsWith('recycle.'),
  ).flatMap((item) => item.apis);

  const merged = [...fromCatalog, ...BASELINE_EXTRA_APIS, ...extra];
  const filtered = merged.filter((key) => legal.has(key));
  return Array.from(new Set(filtered)).sort();
}

/** 把 extens 场景里的 templateId 与 SCENE_DEFAULT_FIELDS 默认值合成整份配置 */
function resolveSubscribeTemplates(): Record<string, unknown> | undefined {
  const raw = env('RECYCLE_SUBSCRIBE_TEMPLATES');
  if (!raw) return undefined;
  let parsed: Record<string, { templateId?: string; fields?: Record<string, string> }>;
  try {
    parsed = JSON.parse(raw) as Record<
      string,
      { templateId?: string; fields?: Record<string, string> }
    >;
  } catch {
    throw new Error('RECYCLE_SUBSCRIBE_TEMPLATES 不是合法 JSON');
  }
  const result: Record<string, unknown> = {};
  for (const [scene, value] of Object.entries(parsed)) {
    if (!value?.templateId) continue; // 没申请到模板的场景直接跳过，避免写入空串
    result[scene] = {
      templateId: value.templateId,
      fields: value.fields ?? SCENE_DEFAULT_FIELDS[scene] ?? {},
    };
  }
  return Object.keys(result).length ? result : undefined;
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
  const timeoutMs = Number(env('RECYCLE_BOOTSTRAP_TIMEOUT_MS', '15000'));
  const dryRun = env('RECYCLE_BOOTSTRAP_DRY_RUN') === '1';

  const bizCode = env('RECYCLE_BIZ_CODE', 'recycle')!;
  const bizName = env('RECYCLE_BIZ_NAME', '回收')!;
  const mpCode = env('WECHAT_MP_CODE', bizCode)!;
  const desiredApis = resolveDesiredApis(csvEnv('RECYCLE_EXTRA_APIS', []));

  console.log('=== recycle 最小部署开通 ===');
  console.log(`MQTT:        ${mqttUrl}`);
  console.log(`业务:        ${bizCode} (${bizName})`);
  console.log(`待开通接口:  ${desiredApis.length} 个`);
  desiredApis.forEach((key) => console.log(`    ${key}`));
  console.log(dryRun ? '模式:        DRY-RUN（不落库）' : '模式:        执行');

  if (dryRun) {
    console.log('\nDRY-RUN 结束，未做任何变更。');
    return;
  }

  const client = ClientProxyFactory.create(mqttClientOptions('recycle-bootstrap'));
  await client.connect();
  try {
    // ---------- 1. 业务登记 ----------
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
        description: '空墨盒 / 空硒鼓回收',
        apis: desiredApis,
      }, timeoutMs);
      console.log(`\n[业务] 已创建 ${created.code}（defaultRoleId=${created.defaultRoleId ?? '-'}）`);
      businessId = created.id;
    }

    // ---------- 2. 接入端（wechat_mp） ----------
    // 业务登记**不会**顺带建接入端，而 /auth/wechat 是按「业务 + type=wechat_mp」
    // 找接入端的（clients.service.requireForBusiness），找不到就直接 404
    // 「当前业务未配置 wechat_mp 接入端」。所以这一步必须单独做，否则微信小程序
    // 登录永远进不来 —— 光登记 wx_miniprograms（第 4 步）是不够的，那是另一张表。
    const clientCode = env('RECYCLE_CLIENT_CODE', bizCode)!;
    const wechatAppId = env('WECHAT_APP_ID');
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
      if (existingClient.type !== 'wechat_mp') {
        payload.type = 'wechat_mp';
        changed = true;
      }
      if (existingClient.status !== 1) {
        payload.status = 1;
        changed = true;
      }
      if (wechatAppId && existingClient.wechatAppId !== wechatAppId) {
        payload.wechatAppId = wechatAppId;
        changed = true;
      }
      if (changed) {
        await call(client, MQTT_PATTERNS.CLIENT_UPDATE, payload, timeoutMs);
        console.log(`[接入端] ${clientCode} 已存在，校正为 wechat_mp 并写入 appId`);
      } else {
        console.log(`[接入端] ${clientCode} 已存在且配置正确，无需变更`);
      }
    } else {
      await call(client, MQTT_PATTERNS.CLIENT_CREATE, {
        clientCode,
        name: bizName,
        businessId,
        type: 'wechat_mp',
        wechatAppId: wechatAppId ?? null,
      }, timeoutMs);
      console.log(`[接入端] 已创建 ${clientCode}（type=wechat_mp, appId=${wechatAppId ?? '-'}）`);
    }
    if (!wechatAppId) {
      console.log('[接入端] 未提供 WECHAT_APP_ID，wechatAppId 为空 —— /auth/wechat 会报');
      console.log('         「接入端 xxx 未配置 wechatAppId」，补上 appId 后重跑本脚本即可');
    }

    // ---------- 3. 身份角色 ----------
    // customer 由 business.create 自动创建，这里只补业务侧角色
    const roles = await call<RoleRow[]>(
      client,
      MQTT_PATTERNS.ROLE_FIND_ALL,
      { businessId },
      timeoutMs,
    );
    const wanted = csvEnv('RECYCLE_ROLES', ['agent', 'admin']);
    const wantedNames: Record<string, string> = {
      agent: '业务员',
      inspector: '验收员',
      approver: '审批人',
      finance: '财务',
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
        // 409 表示并发下已被别人创建，不算失败
        const status = (error as { status?: number })?.status;
        if (status === 409) {
          console.log(`[角色] ${code} 已存在（409），跳过`);
        } else {
          throw error;
        }
      }
    }

    // ---------- 4. 微信小程序 ----------
    const appId = env('WECHAT_APP_ID');
    const secret = env('WECHAT_SECRET');
    if (!appId || !secret) {
      console.log('\n[小程序] 未提供 WECHAT_APP_ID / WECHAT_SECRET，跳过登记');
      console.log('         注：缺少它会拿不到 openid，/auth/wechat 无法登录');
    } else {
      const programs = await call<MiniProgramRow[]>(
        client,
        MQTT_PATTERNS.WECHAT_MP_FIND_ALL,
        {},
        timeoutMs,
      );
      const templates = resolveSubscribeTemplates();
      const mp = programs.find((row) => row.code === mpCode);
      const mpName = env('WECHAT_MP_NAME', '墨盒回收')!;

      if (mp) {
        const payload: Record<string, unknown> = { id: mp.id, appId, name: mpName };
        if (secret) payload.secret = secret;
        if (templates) payload.subscribeTemplates = templates;
        await call(client, MQTT_PATTERNS.WECHAT_MP_UPDATE, payload, timeoutMs);
        console.log(`\n[小程序] 已登记 ${mpCode}，本次更新 appId/secret/模板`);
      } else {
        await call(client, MQTT_PATTERNS.WECHAT_MP_CREATE, {
          code: mpCode,
          name: mpName,
          appId,
          secret,
          subscribeTemplates: templates ?? {},
        }, timeoutMs);
        console.log(`\n[小程序] 已创建 ${mpCode}（appId=${appId.slice(0, 6)}…）`);
      }
      if (!templates) {
        console.log('[小程序] 未配置 RECYCLE_SUBSCRIBE_TEMPLATES，订阅消息模板留空');
        console.log('         场景 ' + Object.keys(SCENE_DEFAULT_FIELDS).join(' / ') + ' 待后台申请后补写');
      }
    }

    console.log('\n=== 开通完成 ===');
    console.log('接下来：用管理员账号登录 admin，给业务员账号勾选 agent 角色即可接单。');
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error('\n开通失败：', error?.message ?? error);
  process.exit(1);
});
