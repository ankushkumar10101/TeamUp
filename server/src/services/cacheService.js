const { safeRedis } = require('../config/redis');

const DEFAULT_TTL_SECONDS = 120; // 2-minute TTL

/**
 * Generate standardized cache key for project task queries
 */
const buildTaskCacheKey = (projectId, query = {}) => {
  const page = query.page || 1;
  const limit = query.limit || 20;
  const status = query.status || 'ALL';
  const priority = query.priority || 'ALL';
  const assignedTo = query.assignedTo || 'ALL';

  return `project:${projectId}:tasks:${page}:${limit}:${status}:${priority}:${assignedTo}`;
};

/**
 * Retrieve cached data
 */
const getCachedData = async (key) => {
  try {
    const raw = await safeRedis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[CacheService] Error parsing cached value for key ${key}: ${err.message}`);
    return null;
  }
};

/**
 * Store data in cache with TTL
 */
const setCachedData = async (key, data, ttlSeconds = DEFAULT_TTL_SECONDS) => {
  try {
    await safeRedis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
  } catch (err) {
    console.warn(`[CacheService] Failed to set cache for key ${key}: ${err.message}`);
  }
};

/**
 * Invalidate all cached task queries for a specific project
 */
const invalidateProjectTasks = async (projectId) => {
  try {
    const pattern = `project:${projectId}:tasks:*`;
    await safeRedis.delByPattern(pattern);
    console.log(`[CacheService] Invalidated cache matching pattern: ${pattern}`);
  } catch (err) {
    console.warn(`[CacheService] Cache invalidation failed for project ${projectId}: ${err.message}`);
  }
};

module.exports = {
  buildTaskCacheKey,
  getCachedData,
  setCachedData,
  invalidateProjectTasks,
};
