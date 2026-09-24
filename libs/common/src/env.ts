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

export function redisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const { host, port } = redisConfig();
  return `redis://${host}:${port}`;
}
