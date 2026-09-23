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

export function redisConfig() {
  return {
    host: readEnv('REDIS_HOST', '127.0.0.1'),
    port: Number(readEnv('REDIS_PORT', '6379')),
  };
}

export function redisUrl(): string {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const { host, port } = redisConfig();
  return `redis://${host}:${port}`;
}
