/**
 * medical 最小部署的 PM2 配置：每个服务一个进程。
 *
 *   gateway / usercenter / upload / medical
 *
 * 不跑 order / docs / wechat / agents / recycle。文件名里的 .config. 不能省。
 */
const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';
const appVersion = process.env.APP_VERSION ?? '0.0.1';
const expectedAppVersion = process.env.EXPECTED_APP_VERSION ?? appVersion;
const databaseUrl =
  process.env.USERCENTER_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const medicalDatabaseUrl = process.env.MEDICAL_DATABASE_URL || '';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

function app(name, script, env) {
  return {
    name,
    script,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: name === 'gateway' || name === 'medical' ? '400M' : '300M',
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
      MQTT_TIMEOUT_MS: process.env.MQTT_TIMEOUT_MS ?? '90000',
      UPLOAD_API_KEY: process.env.UPLOAD_API_KEY ?? 'dev-upload-key',
      CORS_ORIGIN:
        process.env.CORS_ORIGIN ??
        'http://localhost:5173,http://127.0.0.1:5173,http://localhost:3100,http://127.0.0.1:3100',
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
    app('medical', 'dist/apps/medical/main.js', {
      DATABASE_URL: databaseUrl,
      MEDICAL_DATABASE_URL: medicalDatabaseUrl,
      TYPEORM_SYNC: process.env.TYPEORM_SYNC ?? 'true',
      AUTH_BOOTSTRAP_PASSWORD: process.env.AUTH_BOOTSTRAP_PASSWORD ?? 'tcm123456',
      AUTH_SECRET: process.env.AUTH_SECRET ?? 'tcm-dev-auth-secret-change-me',
      ID_CARD_KEY: process.env.ID_CARD_KEY ?? '',
      LLM_API_KEY: process.env.LLM_API_KEY ?? '',
      LLM_BASE_URL:
        process.env.LLM_BASE_URL ??
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      LLM_MODEL: process.env.LLM_MODEL ?? 'qwen-plus',
      LLM_REASONER_MODEL: process.env.LLM_REASONER_MODEL ?? '',
      TCM_SKILLS_DIR: process.env.TCM_SKILLS_DIR ?? '',
    }),
  ],
};
