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
