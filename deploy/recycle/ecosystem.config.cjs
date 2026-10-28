/**
 * recycle 最小部署的 PM2 配置：每个服务一个进程。
 *
 *   gateway / usercenter / upload / wechat / recycle
 *
 * 不跑 order / docs / agents。文件名里的 .config. 不能省，否则 PM2 会当普通脚本只起 1 个进程。
 */
const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';
const appVersion = process.env.APP_VERSION ?? '0.0.1';
const expectedAppVersion = process.env.EXPECTED_APP_VERSION ?? appVersion;
const databaseUrl =
  process.env.USERCENTER_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const wechatDatabaseUrl = process.env.WECHAT_DATABASE_URL || '';
const recycleDatabaseUrl = process.env.RECYCLE_DATABASE_URL || '';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

function app(name, script, env) {
  return {
    name,
    script,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: name === 'gateway' ? '400M' : '300M',
    env: {
      NODE_ENV: 'production',
      MQTT_URL: mqttUrl,
      REDIS_URL: redisUrl,
      INSTANCE_ID: name,
      APP_VERSION: appVersion,
      EXPECTED_APP_VERSION: expectedAppVersion,
      ...env,
    },
  };
}

module.exports = {
  apps: [
    app('gateway', 'dist/apps/gateway/main.js', {
      DATABASE_URL: databaseUrl,
      PORT: gatewayPort,
      UPLOAD_API_KEY: process.env.UPLOAD_API_KEY ?? 'dev-upload-key',
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3100,http://127.0.0.1:3100',
      AGENTS_MQTT_TIMEOUT_MS: process.env.AGENTS_MQTT_TIMEOUT_MS ?? '90000',
      AGENTS_HTTP_URL: process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006',
    }),
    app('usercenter', 'dist/apps/usercenter/main.js', {
      DATABASE_URL: databaseUrl,
    }),
    app('upload', 'dist/apps/upload/main.js', {
      UPLOAD_API_KEY: process.env.UPLOAD_API_KEY ?? 'dev-upload-key',
      UPLOAD_DRIVER: process.env.UPLOAD_DRIVER ?? 'oss',
      OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID ?? '',
      OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET ?? '',
      OSS_BUCKET: process.env.OSS_BUCKET ?? '',
      OSS_REGION: process.env.OSS_REGION ?? 'oss-cn-shanghai',
      UPLOAD_PUBLIC_BASE: process.env.UPLOAD_PUBLIC_BASE ?? '',
    }),
    app('wechat', 'dist/apps/wechat/main.js', {
      DATABASE_URL: databaseUrl,
      WECHAT_DATABASE_URL: wechatDatabaseUrl,
      WECHAT_APP_ID: process.env.WECHAT_APP_ID ?? '',
      WECHAT_SECRET: process.env.WECHAT_SECRET ?? '',
      WECHAT_MP_CODE: process.env.WECHAT_MP_CODE ?? 'recycle',
      WECHAT_MP_NAME: process.env.WECHAT_MP_NAME ?? '墨盒回收',
      WECHAT_QRCODE_CHECK_PATH: process.env.WECHAT_QRCODE_CHECK_PATH ?? 'false',
    }),
    app('recycle', 'dist/apps/recycle/main.js', {
      DATABASE_URL: databaseUrl,
      RECYCLE_DATABASE_URL: recycleDatabaseUrl,
      RECYCLE_INTERNAL_KEY: process.env.RECYCLE_INTERNAL_KEY ?? 'dev-recycle-internal-key',
    }),
  ],
};
