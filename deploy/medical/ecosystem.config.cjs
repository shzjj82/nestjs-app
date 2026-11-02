/**
 * medical 最小部署的 PM2 配置：每个服务一个进程。
 *
 *   gateway / usercenter / upload / medical
 *
 * 跑 gateway / usercenter / upload / medical / agents。不跑 order / docs / wechat / recycle。文件名里的 .config. 不能省。
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
const agentsDatabaseUrl =
  process.env.AGENTS_DATABASE_URL ||
  databaseUrl.replace(/\/[^/?]+(\?|$)/, '/agents$1');
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
      AGENTS_HTTP_URL: process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006',
      MEDICAL_HTTP_URL: process.env.MEDICAL_HTTP_URL ?? 'http://127.0.0.1:3011',
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
      AGENTS_HTTP_URL: process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006',
      TCM_SKILLS_DIR: process.env.TCM_SKILLS_DIR ?? '',
    }),
    app('agents', 'dist/apps/agents/main.js', {
      DATABASE_URL: databaseUrl,
      AGENTS_DATABASE_URL: agentsDatabaseUrl,
      AGENTS_HTTP_PORT: process.env.AGENTS_HTTP_PORT ?? '3006',
      AI_API_BASE:
        process.env.AI_API_BASE ??
        process.env.LLM_BASE_URL ??
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      AI_API_KEY: process.env.AI_API_KEY ?? process.env.LLM_API_KEY ?? '',
      AI_MODEL: process.env.AI_MODEL ?? process.env.LLM_MODEL ?? 'qwen-plus',
      AI_REASONER_MODEL: process.env.AI_REASONER_MODEL ?? process.env.LLM_REASONER_MODEL ?? '',
      AI_ASR_API_BASE: process.env.AI_ASR_API_BASE ?? process.env.LLM_BASE_URL ?? '',
      AI_ASR_API_KEY: process.env.AI_ASR_API_KEY ?? process.env.LLM_API_KEY ?? '',
      AI_ASR_MODEL: process.env.AI_ASR_MODEL ?? 'qwen3-asr-flash',
      AI_TIMEOUT_MS: process.env.AI_TIMEOUT_MS ?? '90000',
      TINGWU_APP_KEY: process.env.TINGWU_APP_KEY ?? '',
      TINGWU_REGION: process.env.TINGWU_REGION ?? 'cn-beijing',
      ALIBABA_CLOUD_ACCESS_KEY_ID:
        process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ?? process.env.ALIYUN_ACCESS_KEY_ID ?? '',
      ALIBABA_CLOUD_ACCESS_KEY_SECRET:
        process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ?? process.env.ALIYUN_ACCESS_KEY_SECRET ?? '',
    }),
  ],
};
