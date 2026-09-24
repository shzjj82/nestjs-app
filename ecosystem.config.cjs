const mqttUrl = process.env.MQTT_URL ?? 'mqtt://127.0.0.1:1883';
const gatewayPort = process.env.PORT ?? '3000';
const usercenterReplicas = Number(process.env.USERCENTER_REPLICAS ?? 3);
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://nestjs:nestjs@127.0.0.1:5432/nestjs';
const docsDatabaseUrl =
  process.env.DOCS_DATABASE_URL ??
  databaseUrl.replace(/\/[^/?]+(\?|$)/, '/docs$1');
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
      },
    },
    {
      name: 'docs',
      script: 'dist/apps/docs/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        MQTT_URL: mqttUrl,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
        INSTANCE_ID: 'docs-1',
        DATABASE_URL: databaseUrl,
        DOCS_DATABASE_URL: docsDatabaseUrl,
        DOCS_SERVICE_KEY: process.env.DOCS_SERVICE_KEY ?? 'dev-docs-key',
      },
    },
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
  ],
};
