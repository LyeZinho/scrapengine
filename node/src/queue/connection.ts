import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;
const redisHost = process.env.REDIS_HOST;
const redisPort = process.env.REDIS_PORT;

console.log('Redis environment variables:');
console.log('REDIS_URL:', redisUrl);
console.log('REDIS_HOST:', redisHost);
console.log('REDIS_PORT:', redisPort);
console.log('NODE_ENV:', process.env.NODE_ENV);

let redisConnectionOptions: any;

if (redisUrl) {
  console.log('Using REDIS_URL:', redisUrl);
  redisConnectionOptions = redisUrl;
} else {
  const isProduction = process.env.NODE_ENV === 'production';
  // In Docker/production, default to 'redis' service name
  // In development, default to 'localhost'
  const defaultHost = isProduction ? 'redis' : 'localhost';
  
  const host = redisHost || defaultHost;
  const port = parseInt(redisPort || '6379');
  
  console.log(`Using host/port: ${host}:${port} (isProduction: ${isProduction})`);
  
  redisConnectionOptions = {
    host: host,
    port: port,
    maxRetriesPerRequest: null,
  };
}

console.log('Final Redis connection options:', redisConnectionOptions);

export const redisConnection = new IORedis(redisConnectionOptions);

// Export for backward compatibility
export { redisConnectionOptions };

export async function connectRedis(): Promise<void> {
  await redisConnection.connect();
}
