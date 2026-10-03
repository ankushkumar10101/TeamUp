const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Robust dotenv loading: check server/.env, process.cwd()/.env, and project root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { connectDB } = require('./config/db');
const { apiLimiter, rateLimitConfig } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const taskRoutes = require('./routes/taskRoutes');

const app = express();

// Trust proxy if configured or in production (essential for rate limiting behind reverse proxies)
if (process.env.TRUST_PROXY || process.env.NODE_ENV === 'production') {
  const trustProxyVal = process.env.TRUST_PROXY;
  app.set('trust proxy', trustProxyVal ? (Number.isNaN(Number(trustProxyVal)) ? trustProxyVal : Number(trustProxyVal)) : 1);
}

const PORT = process.env.PORT || 5000;
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set(['http://localhost:5173', 'http://127.0.0.1:5173', ...clientUrls])
);

// Security & Parsing Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = origin.trim().replace(/\/$/, '');
      if (allowedOrigins.includes(normalized) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(new Error(`CORS error: Origin ${origin} not allowed.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// General API rate limiter
app.use('/api', apiLimiter);

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Optional: Serve static client build if present (enables single-container / full-stack deployment on Render)
const candidateDistPaths = [
  path.join(__dirname, '../../client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist'),
];
const clientDistPath = candidateDistPaths.find((p) => fs.existsSync(p));
if (clientDistPath) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized error handling
app.use(errorHandler);

// Connect to MongoDB and start listening
const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`[TeamUp Server] Running on http://localhost:${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    if (rateLimitConfig.enabled) {
      console.log(`[RateLimit] Status: Enabled | API: ${rateLimitConfig.api.max} reqs / ${rateLimitConfig.api.windowMin}m | Auth: ${rateLimitConfig.auth.max} reqs / ${rateLimitConfig.auth.windowMin}m`);
    } else {
      console.log('[RateLimit] Status: Disabled (RATE_LIMIT_ENABLED=false)');
    }
  });
};

startServer();

module.exports = { app };
