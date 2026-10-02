const path = require('path');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

// Ensure environment variables are loaded regardless of execution context or cwd
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config();

const parseEnvInt = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseEnvBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off', 'disabled'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on', 'enabled'].includes(normalized)) return true;
  return fallback;
};

// Check if rate limiting is enabled globally
const isRateLimitEnabled = parseEnvBool(
  process.env.RATE_LIMIT_ENABLED ?? process.env.ENABLE_RATE_LIMIT,
  true
);

// Window durations (configurable via env, accepts milliseconds or minutes, defaults to 15 min)
const getApiWindowMs = () => {
  const directMs = parseEnvInt(process.env.RATE_LIMIT_API_WINDOW_MS || process.env.RATE_LIMIT_WINDOW_MS, null);
  if (directMs) return directMs;
  const minutes = parseEnvInt(process.env.RATE_LIMIT_API_WINDOW_MIN || process.env.RATE_LIMIT_WINDOW_MIN, 15);
  return minutes * 60 * 1000;
};

const getAuthWindowMs = () => {
  const directMs = parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, null);
  if (directMs) return directMs;
  const minutes = parseEnvInt(process.env.RATE_LIMIT_AUTH_WINDOW_MIN, 15);
  return minutes * 60 * 1000;
};

const apiWindowMs = getApiWindowMs();
const authWindowMs = getAuthWindowMs();

// Max requests per window
// If specified in env (RATE_LIMIT_AUTH_MAX / RATE_LIMIT_API_MAX / RATE_LIMIT_MAX), use that value.
// Otherwise, defaults to strict values in production (20 auth, 1000 api)
// and relaxed values in development (1000 auth, 5000 api).
const isProduction = process.env.NODE_ENV === 'production';
const authMaxDefault = isProduction ? 20 : 1000;
const apiMaxDefault = isProduction ? 1000 : 5000;

const authMax = parseEnvInt(process.env.RATE_LIMIT_AUTH_MAX, authMaxDefault);
const apiMax = parseEnvInt(process.env.RATE_LIMIT_API_MAX || process.env.RATE_LIMIT_MAX, apiMaxDefault);

// Strict rate limiter for authentication routes (login / register)
const authLimiter = rateLimit({
  windowMs: authWindowMs,
  max: authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isRateLimitEnabled,
  handler: (req, res) => {
    const authMinutes = Math.ceil(authWindowMs / (60 * 1000));
    res.status(429).json({
      success: false,
      message:
        process.env.RATE_LIMIT_AUTH_MESSAGE ||
        `Too many login/registration attempts from this IP. Please try again after ${authMinutes} minute${authMinutes === 1 ? '' : 's'}.`,
    });
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: apiWindowMs,
  max: apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !isRateLimitEnabled,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message:
        process.env.RATE_LIMIT_API_MESSAGE ||
        process.env.RATE_LIMIT_MESSAGE ||
        'Rate limit exceeded. Too many requests, please slow down.',
    });
  },
});

const rateLimitConfig = {
  enabled: isRateLimitEnabled,
  auth: {
    max: authMax,
    windowMs: authWindowMs,
    windowMin: Math.ceil(authWindowMs / (60 * 1000)),
  },
  api: {
    max: apiMax,
    windowMs: apiWindowMs,
    windowMin: Math.ceil(apiWindowMs / (60 * 1000)),
  },
};

module.exports = {
  authLimiter,
  apiLimiter,
  rateLimitConfig,
};
