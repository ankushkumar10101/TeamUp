const { safeRedis } = require('../config/redis');

// In-memory fallback if Redis is temporarily offline
const memoryStore = new Map();

/**
 * Idempotency middleware for write operations (e.g. creating tasks)
 * Validates Idempotency-Key header, returns cached response if key was processed
 */
const idempotency = async (req, res, next) => {
  const idempotencyKey = req.header('Idempotency-Key');

  // If client did not provide an Idempotency-Key, proceed normally
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user ? req.user._id.toString() : 'anonymous';
  const cacheKey = `idempotency:${userId}:${idempotencyKey}`;

  try {
    let cachedRecord = null;

    if (safeRedis.isAvailable()) {
      const data = await safeRedis.get(cacheKey);
      if (data) {
        cachedRecord = JSON.parse(data);
      }
    } else {
      cachedRecord = memoryStore.get(cacheKey);
    }

    if (cachedRecord) {
      console.log(`[Idempotency] Duplicate request detected for key: ${idempotencyKey}. Serving cached response.`);
      res.setHeader('X-Idempotent-Replay', 'true');
      return res.status(cachedRecord.statusCode).json(cachedRecord.body);
    }

    // Intercept res.json to capture response and cache it
    const originalJson = res.json.bind(res);

    res.json = (body) => {
      // Only cache successful or non-server-error responses
      if (res.statusCode < 500) {
        const record = {
          statusCode: res.statusCode,
          body,
        };

        if (safeRedis.isAvailable()) {
          // Cache with 1-hour expiration
          safeRedis.set(cacheKey, JSON.stringify(record), 'EX', 3600).catch((err) => {
            console.warn(`[Idempotency] Failed to cache record: ${err.message}`);
          });
        } else {
          memoryStore.set(cacheKey, record);
          // Set timeout to clear memory store
          setTimeout(() => memoryStore.delete(cacheKey), 3600 * 1000);
        }
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    console.warn(`[Idempotency] Error processing idempotency key: ${err.message}`);
    // Do not block client request if idempotency check encounters an unexpected error
    next();
  }
};

module.exports = { idempotency };
