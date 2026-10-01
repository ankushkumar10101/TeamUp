// In-memory idempotency store with automatic TTL cleanup
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
    const cachedRecord = memoryStore.get(cacheKey);

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

        memoryStore.set(cacheKey, record);
        // Set timeout to clear memory store after 1 hour
        setTimeout(() => memoryStore.delete(cacheKey), 3600 * 1000);
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    console.warn(`[Idempotency] Error processing idempotency key: ${err.message}`);
    next();
  }
};

module.exports = { idempotency };
