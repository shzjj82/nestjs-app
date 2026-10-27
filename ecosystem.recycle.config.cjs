/**
 * recycle 最小部署的 PM2 配置。
 *
 * 与 ecosystem.config.cjs 的区别：**只跑回收业务真正需要的 5 个服务**
 *
 *   gateway       HTTP 网关（唯一对外入口）
 *   usercenter    账号、认证、业务登记、角色权限
 *   wechat        微信登录、手机号、订阅消息、商家转账
 *   upload        实物照片上传
 *   recycle       回收业务本体（订单 / 目录 / 门店 / 审批）
 *
 * 刻意不跑的三个服务（及其原因）：
 *   order    —— 回收订单在 recycle 自己的库里（rc_orders），不走旧 order 服务
 *   docs     —— 文档知识库，回收业务用不到
 *   agents   —— AI 助手 / RAG，回收业务用不到；依赖 AI 接口，只会平白增加故障面
 *
 * ⚠️ 注意：本文件是「新增」，没有改动 ecosystem.config.cjs。
 *    两份配置共用同一套 dist 产物，切换方式：
 *      pm2 start ecosystem.recycle.config.cjs
 *
 * ⚠️ 文件名里的 .config. 不能省：pm2 只在文件名含 .config. 时才把文件当作
 *    配置解析，否则会把它当普通脚本执行 —— 那样只会起 1 个以文件名命名的
 *    进程，表面看是 online，实际 5 个服务一个都没跑。
 *
 * 环境变量与 ecosystem.config.cjs 完全一致，见 .env.recycle.example。
 * 副本数：USERCENTER_REPLICAS 默认 1，可用环境变量调。
 */
const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';

function replicaCount(name, fallback) {
  const raw = Number(process.env[name] ?? fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

const usercenterReplicas = replicaCount('USERCENTER_REPLICAS', 1);
const appVersion = process.env.APP_VERSION ?? '0.0.1';
const expectedAppVersion = process.env.EXPECTED_APP_VERSION ?? appVersion;
const databaseUrl = process.env.DATABASE_URL ?? 'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const wechatDatabaseUrl =
  process.env.WECHAT_DATABASE_URL ?? databaseUrl.replace(/\/[^/?]+(\?|$)/, '/wechat$1');
const recycleDatabaseUrl =
  process.env.RECYCLE_DATABASE_URL ?? databaseUrl.replace(/\/[^/?]+(\?|$)/, '/recycle$1');
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

const usercenterApps = Array.from({ length: usercenterReplicas }, (_, index) => {
  const id = index + 1;
  return {
    name: `usercenter-${id}`,
    script: 'dist/apps/usercenter/main.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      MQTT_URL: mqttUrl,
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      INSTANCE_ID: `usercenter-${id}`,
      APP_VERSION: appVersion,
      EXPECTED_APP_VERSION: expectedAppVersion,
    },
  };
});

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
        CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3100,http://127.0.0.1:3100',
        AGENTS_MQTT_TIMEOUT_MS: process.env.AGENTS_MQTT_TIMEOUT_MS ?? '90000',
        AGENTS_HTTP_URL: process.env.AGENTS_HTTP_URL ?? 'http://127.0.0.1:3006',
      },
    },
    ...usercenterApps,
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
        UPLOAD_DRIVER: process.env.UPLOAD_DRIVER ?? 'oss',
        OSS_ACCESS_KEY_ID: process.env.OSS_ACCESS_KEY_ID ?? '',
        OSS_ACCESS_KEY_SECRET: process.env.OSS_ACCESS_KEY_SECRET ?? '',
        OSS_BUCKET: process.env.OSS_BUCKET ?? '',
        OSS_REGION: process.env.OSS_REGION ?? 'oss-cn-shanghai',
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
        // 回收业务与小程序 1:1，这个 code 就是业务 code
        WECHAT_MP_CODE: process.env.WECHAT_MP_CODE ?? 'recycle',
        WECHAT_MP_NAME: process.env.WECHAT_MP_NAME ?? '墨盒回收',
        WECHAT_QRCODE_CHECK_PATH: process.env.WECHAT_QRCODE_CHECK_PATH ?? 'false',
      },
    },
    {
      name: 'recycle',
      script: 'dist/apps/recycle/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        DATABASE_URL: databaseUrl,
        RECYCLE_DATABASE_URL: recycleDatabaseUrl,
        RECYCLE_INTERNAL_KEY: process.env.RECYCLE_INTERNAL_KEY ?? 'dev-recycle-internal-key',
        REDIS_URL: redisUrl,
        INSTANCE_ID: 'recycle-1',
        APP_VERSION: appVersion,
        EXPECTED_APP_VERSION: expectedAppVersion,
      },
    },
  ],
};
