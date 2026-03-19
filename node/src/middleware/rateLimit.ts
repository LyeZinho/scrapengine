import { redisConnection } from '../queue/connection.js';

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
}

const WINDOW_SIZE_SECONDS = 60;

export async function checkRateLimit(
  clientId: string,
  limit: number
): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const key = `ratelimit:${clientId}`;
  const now = Date.now();
  const windowStart = now - (WINDOW_SIZE_SECONDS * 1000);

  try {
    // Remove old entries outside the window
    await redisConnection.zremrangebyscore(key, 0, windowStart);
    
    // Count current entries in the window
    const count = await redisConnection.zcard(key);
    
    if (count >= limit) {
      // Get oldest entry to calculate reset time
      const oldest = await redisConnection.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt = oldest.length >= 2 
        ? new Date(parseInt(oldest[1]) + (WINDOW_SIZE_SECONDS * 1000))
        : new Date(now + (WINDOW_SIZE_SECONDS * 1000));
      
      return {
        allowed: false,
        info: { limit, remaining: 0, resetAt }
      };
    }

    // Add new entry with current timestamp as score
    await redisConnection.zadd(key, now, `${now}-${Math.random()}`);
    await redisConnection.expire(key, WINDOW_SIZE_SECONDS);

    return {
      allowed: true,
      info: { limit, remaining: limit - count - 1, resetAt: new Date(now + (WINDOW_SIZE_SECONDS * 1000)) }
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // Fail open - allow request if Redis is down
    return {
      allowed: true,
      info: { limit, remaining: limit, resetAt: new Date(now + (WINDOW_SIZE_SECONDS * 1000)) }
    };
  }
}

export function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    'X-RateLimit-Limit': info.limit.toString(),
    'X-RateLimit-Remaining': info.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(info.resetAt.getTime() / 1000).toString()
  };
}
