import { env } from '../config/env.js';

/**
 * RedisDeduplicator — Idempotency guard using Redis SET NX EX.
 *
 * Before processing a Kafka message, call `isDuplicate(key)`:
 *   - Returns `false` (not duplicate) if the key was freshly set → proceed with processing.
 *   - Returns `true`  (duplicate)     if the key already existed → skip processing.
 *
 * Graceful degradation: if Redis is unavailable or errors, returns `false`
 * so the message is processed normally (at-least-once semantics preserved).
 */
export class RedisDeduplicator {
  /**
   * @param {import('ioredis').Redis} redisClient — connected ioredis instance
   * @param {Object} [options]
   * @param {number} [options.ttlSeconds] — key expiry in seconds (default from env)
   * @param {string} [options.keyPrefix]  — prefix for all dedup keys (default from env)
   */
  constructor(redisClient, { ttlSeconds, keyPrefix } = {}) {
    this.redis = redisClient;
    this.ttl = ttlSeconds ?? env.dedupTtlSeconds;
    this.prefix = keyPrefix ?? env.dedupKeyPrefix;
  }

  /**
   * Check whether a message with the given key has already been seen.
   *
   * Uses `SET <key> NX EX <ttl>`:
   *   - If SET returns "OK" → key is new → NOT a duplicate → return false
   *   - If SET returns null  → key exists → IS a duplicate  → return true
   *
   * @param {string} key — unique dedup key (without prefix; prefix is added automatically)
   * @returns {Promise<boolean>} — `true` if duplicate (should skip), `false` if new (should process)
   */
  async isDuplicate(key) {
    if (!key) return false;

    const fullKey = `${this.prefix}${key}`;

    try {
      const result = await this.redis.set(fullKey, '1', 'EX', this.ttl, 'NX');
      // result === 'OK' means the key was newly set (not a duplicate)
      // result === null means the key already existed (duplicate)
      const duplicate = result !== 'OK';

      if (duplicate) {
        console.log(`[Dedup] Duplicate detected — key="${fullKey}" (TTL=${this.ttl}s)`);
      }

      return duplicate;
    } catch (err) {
      // Graceful degradation: Redis error → treat as NOT duplicate → process the message
      console.warn(`[Dedup] Redis error during dedup check for "${fullKey}":`, err.message);
      return false;
    }
  }

  /**
   * Disconnect the Redis client cleanly.
   * Call this during service shutdown.
   */
  async disconnect() {
    try {
      await this.redis.quit();
      console.log('[Dedup] Redis client disconnected');
    } catch (err) {
      console.warn('[Dedup] Error disconnecting Redis:', err.message);
    }
  }
}
