import Redis from 'ioredis';
import { env } from './env.js';

/**
 * Create and export a singleton Redis client for the AI service.
 *
 * Supports connection via REDIS_URL (e.g. rediss://... for Upstash TLS).
 * Reconnects automatically on connection loss (ioredis default behavior).
 * Logs connection events for observability.
 */

const baseOptions = {
  maxRetriesPerRequest: null,     // don't throw on individual command retries
  retryStrategy(times) {
    // Exponential backoff capped at 30 seconds
    const delay = Math.min(times * 500, 30_000);
    console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
  lazyConnect: true,              // don't connect until .connect() is called
};

// ioredis accepts a URL string directly (including rediss:// for TLS)
export const redisClient = env.redisUrl
  ? new Redis(env.redisUrl, baseOptions)
  : new Redis({ host: 'localhost', port: 6379, ...baseOptions });

// ---------------------------------------------------------------------------
// Connection event logging
// ---------------------------------------------------------------------------

redisClient.on('connect', () => {
  console.log(`[Redis] Connected to Redis`);
});

redisClient.on('ready', () => {
  console.log('[Redis] Ready to accept commands');
});

redisClient.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redisClient.on('close', () => {
  console.log('[Redis] Connection closed');
});

redisClient.on('reconnecting', (delay) => {
  console.log(`[Redis] Reconnecting (delay=${delay}ms)`);
});
