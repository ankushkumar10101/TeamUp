const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient, safeRedis } = require('../config/redis');

// Helper to create store that gracefully uses Redis if available, or memory store
const getStore = (prefix) => {
  if (safeRedis.isAvailable() && redisClient) {
    try {
      return new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix: `rl:${prefix}:`,
      });
    } catch (err) {
      console.warn(`[RateLimit] Failed to attach RedisStore: ${err.message}. Falling back to memory.`);
    }
  }
  return undefined; // express-rate-limit defaults to MemoryStore
};

// Strict rate limiter for authentication routes (login / register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter limit: 10 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('auth'),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many login/registration attempts from this IP. Please try again after 15 minutes.',
    });
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // 150 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  store: getStore('api'),
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Rate limit exceeded. Too many requests, please slow down.',
    });
  },
});

module.exports = {
  authLimiter,
  apiLimiter,
};
