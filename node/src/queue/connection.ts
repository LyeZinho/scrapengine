import IORedis from 'ioredis';

// Parse Redis URL if provided, otherwise use host/port
let redisConnectionOptions: any;
if (process.env.REDIS_URL) {
  redisConnectionOptions = process.env.REDIS_URL;
} else {
  redisConnectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
  };
}

export const redisConnection = new IORedis(redisConnectionOptions);

export async function connectRedis(): Promise<void> {
  await redisConnection.connect();
}
