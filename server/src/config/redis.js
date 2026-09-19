const Redis = require('ioredis');

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient = null;
let isRedisConnected = false;

try {
  redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        // Stop reconnecting after 3 failed attempts to avoid log flood
        return null;
      }
      return Math.min(times * 500, 2000);
    },
    enableOfflineQueue: false, // Don't queue commands when disconnected
    connectTimeout: 2000,
  });

  redisClient.on('connect', () => {
    isRedisConnected = true;
    console.log('[Redis] Connected successfully.');
  });

  redisClient.on('ready', () => {
    isRedisConnected = true;
  });

  redisClient.on('error', (err) => {
    isRedisConnected = false;
    // Log as a warning; application continues functioning without crashing
    console.warn(`[Redis] Connection warning (running in degraded fallback mode): ${err.message}`);
  });

  redisClient.on('close', () => {
    isRedisConnected = false;
  });
} catch (err) {
  console.warn(`[Redis] Initialization error: ${err.message}. Degraded fallback active.`);
}

/**
 * Safely execute a Redis operation with graceful fallback if Redis is down
 */
const safeRedis = {
  get: async (key) => {
    if (!isRedisConnected || !redisClient) return null;
    try {
      return await redisClient.get(key);
    } catch (err) {
      console.warn(`[Redis] safeGet failed for key ${key}: ${err.message}`);
      return null;
    }
  },

  set: async (key, value, mode, duration) => {
    if (!isRedisConnected || !redisClient) return null;
    try {
      if (mode && duration) {
        return await redisClient.set(key, value, mode, duration);
      }
      return await redisClient.set(key, value);
    } catch (err) {
      console.warn(`[Redis] safeSet failed for key ${key}: ${err.message}`);
      return null;
    }
  },

  del: async (key) => {
    if (!isRedisConnected || !redisClient) return 0;
    try {
      return await redisClient.del(key);
    } catch (err) {
      console.warn(`[Redis] safeDel failed for key ${key}: ${err.message}`);
      return 0;
    }
  },

  /**
   * Delete all keys matching a pattern (e.g. project:123:tasks:*)
   */
  delByPattern: async (pattern) => {
    if (!isRedisConnected || !redisClient) return;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== '0');
    } catch (err) {
      console.warn(`[Redis] safeDelByPattern failed for pattern ${pattern}: ${err.message}`);
    }
  },

  isAvailable: () => isRedisConnected,
  rawClient: redisClient,
};

module.exports = { safeRedis, redisClient };
