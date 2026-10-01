const rateLimit = require('express-rate-limit');

const parseEnvInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

// Window durations in minutes (configurable via env, defaults to 15 min)
const authWindowMin = parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MIN, 15);
const apiWindowMin = parseEnvInt(process.env.RATE_LIMIT_API_WINDOW_MIN, 15);

// Max requests per window
// If specified in env, use that value.
// Otherwise, defaults to strict values in production (20 auth, 1000 api)
// and relaxed values in development (1000 auth, 5000 api).
const isProduction = process.env.NODE_ENV === 'production';
const authMaxDefault = isProduction ? 20 : 1000;
const apiMaxDefault = isProduction ? 1000 : 5000;

const authMax = parseEnvInt(process.env.RATE_LIMIT_AUTH_MAX, authMaxDefault);
const apiMax = parseEnvInt(process.env.RATE_LIMIT_API_MAX, apiMaxDefault);

// Strict rate limiter for authentication routes (login / register)
const authLimiter = rateLimit({
  windowMs: authWindowMin * 60 * 1000,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: `Too many login/registration attempts from this IP. Please try again after ${authWindowMin} minutes.`,
    });
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: apiWindowMin * 60 * 1000,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
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
