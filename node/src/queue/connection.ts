import IORedis from 'ioredis';

export const redisConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

export const redisConnection = new IORedis(redisConnectionOptions);

export async function connectRedis(): Promise<void> {
  await redisConnection.connect();
}
