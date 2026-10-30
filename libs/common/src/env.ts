import { config as loadEnv } from 'dotenv';
import { resolve } from 'path';

loadEnv({ path: resolve(process.cwd(), '.env') });

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export function postgresConfig() {
  return {
    host: readEnv('POSTGRES_HOST', '127.0.0.1'),
    port: Number(readEnv('POSTGRES_PORT', '5432')),
    user: readEnv('POSTGRES_USER', 'nestjs'),
    password: readEnv('POSTGRES_PASSWORD', 'nestjs'),
    database: readEnv('POSTGRES_DB', 'nestjs'),
  };
}

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const { user, password, host, port, database } = postgresConfig();
  return `postgres://${user}:${password}@${host}:${port}/${database}`;
}

/** wechat 默认独立库 `wechat`；可用 WECHAT_DATABASE_URL 覆盖 */
export function wechatDatabaseUrl(): string {
  if (process.env.WECHAT_DATABASE_URL) {
    return process.env.WECHAT_DATABASE_URL;
  }
  const shared = databaseUrl();
  try {
    const parsed = new URL(shared);
    parsed.pathname = '/wechat';
    return parsed.toString();
  } catch {
    return shared.replace(/\/[^/?]+(\?|$)/, '/wechat$1');
  }
}

/** order 默认独立库 `order`；可用 ORDER_DATABASE_URL 覆盖 */
export function orderDatabaseUrl(): string {
  return namedDatabaseUrl('ORDER_DATABASE_URL', 'order');
}

/** agents 默认独立库 `agents`；可用 AGENTS_DATABASE_URL 覆盖 */
export function agentsDatabaseUrl(): string {
  return namedDatabaseUrl('AGENTS_DATABASE_URL', 'agents');
}

function namedDatabaseUrl(envName: string, database: string): string {
  if (process.env[envName]) {
    return process.env[envName] as string;
  }
  const shared = databaseUrl();
  try {
    const parsed = new URL(shared);
    parsed.pathname = `/${database}`;
    return parsed.toString();
  } catch {
    return shared.replace(/\/[^/?]+(\?|$)/, `/${database}$1`);
  }
}

/** docs 默认独立库 `docs`；可用 DOCS_DATABASE_URL 覆盖 */
export function docsDatabaseUrl(): string {
  if (process.env.DOCS_DATABASE_URL) {
    return process.env.DOCS_DATABASE_URL;
  }
  const shared = databaseUrl();
  try {
    const parsed = new URL(shared);
    parsed.pathname = '/docs';
    return parsed.toString();
  } catch {
    return shared.replace(/\/[^/?]+(\?|$)/, '/docs$1');
  }
}

/** recycle 默认独立库 `recycle`；可用 RECYCLE_DATABASE_URL 覆盖 */
export function recycleDatabaseUrl(): string {
  return namedDatabaseUrl('RECYCLE_DATABASE_URL', 'recycle');
}

/** medical 默认独立库 `medical`；可用 MEDICAL_DATABASE_URL 覆盖 */
export function medicalDatabaseUrl(): string {
  return namedDatabaseUrl('MEDICAL_DATABASE_URL', 'medical');
}

/** 回收服务内部事件密钥；跨上下文事件必须携带，防止伪造 */
export function recycleInternalKey(): string {
  return readEnv('RECYCLE_INTERNAL_KEY', 'dev-recycle-internal-key');
}


export function redisConfig() {
  return {
    host: readEnv('REDIS_HOST', '127.0.0.1'),
    port: Number(readEnv('REDIS_PORT', '6379')),
  };
}

export function docsServiceKey(): string {
  return readEnv('DOCS_SERVICE_KEY', 'dev-docs-key');
}

export function uploadServiceKey(): string {
  return readEnv('UPLOAD_API_KEY', 'dev-upload-key');
}

export function uploadMaxBytes(): number {
  const raw = Number(process.env.UPLOAD_MAX_BYTES ?? 15 * 1024 * 1024);
  return Number.isFinite(raw) && raw > 0 ? raw : 15 * 1024 * 1024;
}

export type UploadDriver = 'minio' | 'oss' | 'cos';

export function uploadDriver(): UploadDriver {
  const raw = readEnv('UPLOAD_DRIVER', 'minio').toLowerCase();
  if (raw === 'oss' || raw === 'cos' || raw === 'minio') {
    return raw;
  }
  return 'minio';
}

export interface UploadStorageConfig {
  driver: UploadDriver;
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  publicBase: string;
  forcePathStyle: boolean;
}

export function uploadStorageConfig(): UploadStorageConfig {
  const driver = uploadDriver();
  if (driver === 'oss') {
    const region = readEnv('OSS_REGION', readEnv('UPLOAD_REGION', 'oss-cn-hangzhou'));
    const endpoint = readEnv(
      'OSS_ENDPOINT',
      readEnv('UPLOAD_ENDPOINT', `https://${region}.aliyuncs.com`),
    );
    return {
      driver,
      endpoint,
      region,
      bucket: readEnv('OSS_BUCKET', readEnv('UPLOAD_BUCKET', '')),
      accessKey: readEnv('OSS_ACCESS_KEY_ID', readEnv('UPLOAD_ACCESS_KEY', '')),
      secretKey: readEnv('OSS_ACCESS_KEY_SECRET', readEnv('UPLOAD_SECRET_KEY', '')),
      publicBase: readEnv('OSS_PUBLIC_BASE', readEnv('UPLOAD_PUBLIC_BASE', '')),
      forcePathStyle: false,
    };
  }
  if (driver === 'cos') {
    const region = readEnv('COS_REGION', readEnv('UPLOAD_REGION', 'ap-guangzhou'));
    const endpoint = readEnv(
      'COS_ENDPOINT',
      readEnv('UPLOAD_ENDPOINT', `https://cos.${region}.myqcloud.com`),
    );
    return {
      driver,
      endpoint,
      region,
      bucket: readEnv('COS_BUCKET', readEnv('UPLOAD_BUCKET', '')),
      accessKey: readEnv('COS_SECRET_ID', readEnv('UPLOAD_ACCESS_KEY', '')),
      secretKey: readEnv('COS_SECRET_KEY', readEnv('UPLOAD_SECRET_KEY', '')),
      publicBase: readEnv('COS_PUBLIC_BASE', readEnv('UPLOAD_PUBLIC_BASE', '')),
      forcePathStyle: false,
    };
  }
  const endpoint = readEnv(
    'MINIO_ENDPOINT',
    readEnv('UPLOAD_ENDPOINT', 'http://127.0.0.1:9000'),
  );
  return {
    driver: 'minio',
    endpoint,
    region: readEnv('MINIO_REGION', readEnv('UPLOAD_REGION', 'us-east-1')),
    bucket: readEnv('MINIO_BUCKET', readEnv('UPLOAD_BUCKET', 'uploads')),
    accessKey: readEnv('MINIO_ACCESS_KEY', readEnv('UPLOAD_ACCESS_KEY', '')),
    secretKey: readEnv('MINIO_SECRET_KEY', readEnv('UPLOAD_SECRET_KEY', '')),
    publicBase: readEnv('MINIO_PUBLIC_BASE', readEnv('UPLOAD_PUBLIC_BASE', '')),
    forcePathStyle: true,
  };
}

export function uploadStorageReady(config = uploadStorageConfig()): boolean {
  return Boolean(config.bucket && config.accessKey && config.secretKey && config.endpoint);
}

export function redisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const { host, port } = redisConfig();
  return `redis://${host}:${port}`;
}

/**
 * 生成小程序码时是否校验 page 已在正式版发布。
 * 默认 false，方便联调未上线页面；生产可设 WECHAT_QRCODE_CHECK_PATH=true。
 */
export function wechatQrcodeCheckPath(): boolean {
  return process.env.WECHAT_QRCODE_CHECK_PATH === 'true';
}

export interface WechatPayMerchantConfig {
  mchId: string;
  serialNo: string;
  privateKeyPem: string;
  /** 微信支付公钥 ID（加密敏感字段 / 验签用，可选） */
  publicKeyId: string | null;
  publicKeyPem: string | null;
  /** APIv3 密钥（回调解密用，可选） */
  apiV3Key: string | null;
  transferSceneId: string;
  transferNotifyUrl: string | null;
  transferReportInfos: Array<{ info_type: string; info_content: string }>;
  userRecvPerception: string | null;
}

/**
 * 微信支付商户配置（商家转账）。
 * 私钥可用 PEM 原文，或 `file:/path/to/apiclient_key.pem`。
 */
export function wechatPayMerchantConfig(): WechatPayMerchantConfig | null {
  const mchId = process.env.WECHAT_PAY_MCH_ID?.trim();
  const serialNo = process.env.WECHAT_PAY_SERIAL_NO?.trim();
  const privateKeyPem = readPemEnv('WECHAT_PAY_PRIVATE_KEY');
  const transferSceneId = process.env.WECHAT_TRANSFER_SCENE_ID?.trim();
  if (!mchId || !serialNo || !privateKeyPem || !transferSceneId) {
    return null;
  }
  return {
    mchId,
    serialNo,
    privateKeyPem,
    publicKeyId: process.env.WECHAT_PAY_PUBLIC_KEY_ID?.trim() || null,
    publicKeyPem: readPemEnv('WECHAT_PAY_PUBLIC_KEY'),
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY?.trim() || null,
    transferSceneId,
    transferNotifyUrl: process.env.WECHAT_TRANSFER_NOTIFY_URL?.trim() || null,
    transferReportInfos: parseTransferReportInfos(
      process.env.WECHAT_TRANSFER_REPORT_INFOS,
    ),
    userRecvPerception:
      process.env.WECHAT_TRANSFER_USER_RECV_PERCEPTION?.trim() || null,
  };
}

function readPemEnv(name: string): string | null {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return null;
  }
  if (raw.startsWith('file:')) {
    try {
      // 延迟 require，避免浏览器/edge 打包扫到 fs
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      return fs.readFileSync(raw.slice('file:'.length), 'utf8');
    } catch {
      return null;
    }
  }
  return raw.includes('\\n') ? raw.replace(/\\n/g, '\n') : raw;
}

function parseTransferReportInfos(
  raw: string | undefined,
): Array<{ info_type: string; info_content: string }> {
  if (!raw?.trim()) {
    // 默认按「二手回收」常见报备字段；具体场景 ID 仍以 WECHAT_TRANSFER_SCENE_ID 为准
    return [
      { info_type: '回收商品', info_content: '空墨盒空硒鼓' },
      { info_type: '回收说明', info_content: '耗材回收款' },
    ];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((row) => {
        const item = row as Record<string, unknown>;
        const info_type = String(item.info_type ?? item.infoType ?? '').trim();
        const info_content = String(
          item.info_content ?? item.infoContent ?? '',
        ).trim();
        return { info_type, info_content };
      })
      .filter((row) => row.info_type && row.info_content);
  } catch {
    return [];
  }
}
