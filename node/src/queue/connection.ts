import IORedis from 'ioredis';

console.log('Redis configuration:');
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);

// Parse Redis URL if provided, otherwise use host/port
export const redisConnectionOptions: any = process.env.REDIS_URL 
  ? process.env.REDIS_URL 
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    };

console.log('Redis connection options:', redisConnectionOptions);

export const redisConnection = new IORedis(redisConnectionOptions);

export async function connectRedis(): Promise<void> {
  await redisConnection.connect();
}
