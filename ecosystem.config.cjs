const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';

function replicaCount(name, fallback) {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const usercenterReplicas = replicaCount('USERCENTER_REPLICAS', 1);
const docsReplicas = replicaCount('DOCS_REPLICAS', 3);
const agentsReplicas = replicaCount('AGENTS_REPLICAS', 3);
const agentsHttpPort = Number(process.env.AGENTS_HTTP_PORT ?? 3006);
const appVersion = process.env.APP_VERSION ?? '0.0.1';
const expectedAppVersion = process.env.EXPECTED_APP_VERSION ?? appVersion;
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const docsDatabaseUrl =
  process.env.DOCS_DATABASE_URL ??
  databaseUrl.replace(/\/[^/?]+(\?|$)/, '/docs$1');
const wechatDatabaseUrl =
  process.env.WECHAT_DATABASE_URL ??
  databaseUrl.replace(/\/[^/?]+(\?|$)/, '/wechat$1');
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

function replicate(service, count, extraEnv) {
  return Array.from({ length: count }, (_, index) => {
    const id = index + 1;
    return {
      name: `${service}-${id}`,
      script: `dist/apps/${service}/main.js`,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        REDIS_URL: redisUrl,
        INSTANCE_ID: `${service}-${id}`,
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
        ...extraEnv(id),
      },
    };
  });
}

const usercenterApps = replicate('usercenter', usercenterReplicas, () => ({
  DATABASE_URL: databaseUrl,
}));

const docsApps = replicate('docs', docsReplicas, () => ({
  DATABASE_URL: databaseUrl,
  DOCS_DATABASE_URL: docsDatabaseUrl,
  DOCS_SERVICE_KEY: process.env.DOCS_SERVICE_KEY ?? 'dev-docs-key',
}));

const agentsApps = replicate('agents', agentsReplicas, (id) => ({
  AGENTS_HTTP_PORT: String(
    Number.isFinite(agentsHttpPort) ? agentsHttpPort + id - 1 : 3006 + id - 1,
  ),
  AI_API_BASE: process.env.AI_API_BASE ?? 'https://api.openai.com/v1',
  AI_API_KEY: process.env.AI_API_KEY ?? '',
  AI_MODEL: process.env.AI_MODEL ?? 'gpt-4o-mini',
  AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS ?? '90000',
}));

module.exports = {
  apps: [
    {
      name: 'gateway',
      script: 'dist/apps/gateway/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        PORT: gatewayPort,
        UPLOAD_API_KEY: process.env.UPLOAD_API_KEY ?? 'dev-upload-key',
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
        CORS_ORIGIN:
          process.env.CORS_ORIGIN ??
          'http://localhost:3100,http://127.0.0.1:3100',
        AGENTS_MQTT_TIMEOUT_MS: process.env.AGENTS_MQTT_TIMEOUT_MS ?? '90000',
        AGENTS_HTTP_URL: process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006',
      },
    },
    ...usercenterApps,
    {
      name: 'order',
      script: 'dist/apps/order/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        INSTANCE_ID: 'order-1',
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
      },
    },
    ...docsApps,
    {
      name: 'upload',
      script: 'dist/apps/upload/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        REDIS_URL: redisUrl,
        INSTANCE_ID: 'upload-1',
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
        UPLOAD_API_KEY: process.env.UPLOAD_API_KEY ?? 'dev-upload-key',
        UPLOAD_DRIVER: process.env.UPLOAD_DRIVER ?? 'minio',
        MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? 'http://127.0.0.1:9000',
        MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
        MINIO_BUCKET: process.env.MINIO_BUCKET ?? 'uploads',
        OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID ?? '',
        OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET ?? '',
        OSS_BUCKET: process.env.OSS_BUCKET ?? '',
        OSS_REGION: process.env.OSS_REGION ?? 'oss-cn-hangzhou',
        COS_SECRET_ID: process.env.COS_SECRET_ID ?? '',
        COS_SECRET_KEY: process.env.COS_SECRET_KEY ?? '',
        COS_BUCKET: process.env.COS_BUCKET ?? '',
        COS_REGION: process.env.COS_REGION ?? 'ap-guangzhou',
        UPLOAD_PUBLIC_BASE: process.env.UPLOAD_PUBLIC_BASE ?? '',
      },
    },
    {
      name: 'wechat',
      script: 'dist/apps/wechat/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        DATABASE_URL: databaseUrl,
        WECHAT_DATABASE_URL: wechatDatabaseUrl,
        REDIS_URL: redisUrl,
        INSTANCE_ID: 'wechat-1',
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
        WECHAT_APP_ID: process.env.WECHAT_APP_ID ?? '',
        WECHAT_SECRET: process.env.WECHAT_SECRET ?? '',
        WECHAT_MP_CODE: process.env.WECHAT_MP_CODE ?? 'wechat',
      },
    },
    ...agentsApps,
  ],
};
