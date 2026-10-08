import 'dotenv/config';

export const databaseConfig = {
  type: 'postgres' as const,

  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),

  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  synchronize: false,

  extra: {
    max: Number(process.env.DB_POOL_MAX ?? 20),
    min: Number(process.env.DB_POOL_MIN ?? 5),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE_TIMEOUT ?? 30_000),
    connectionTimeoutMillis: Number(
      process.env.DB_POOL_CONNECTION_TIMEOUT ?? 5_000,
    ),
  },
};
