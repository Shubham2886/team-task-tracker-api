const { getRedis } = require('../config/redis');

const CACHE_TTL = 60; // seconds

function buildTaskCacheKey(assigneeId, query = {}) {
  const parts = [`tasks:assignee:${assigneeId}`];
  if (query.status) parts.push(`status:${query.status}`);
  if (query.priority) parts.push(`priority:${query.priority}`);
  if (query.page) parts.push(`page:${query.page}`);
  if (query.limit) parts.push(`limit:${query.limit}`);
  return parts.join(':');
}

async function getCache(key) {
  try {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return null;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

async function setCache(key, value, ttl = CACHE_TTL) {
  try {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch {
    // Silently fail — cache is non-critical
  }
}

async function invalidateAssigneeCache(assigneeId) {
  try {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    // Pattern-based invalidation: delete all keys for this assignee
    const pattern = `tasks:assignee:${assigneeId}*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silently fail
  }
}

async function invalidateOrgCache(organization) {
  try {
    const redis = getRedis();
    if (!redis || redis.status !== 'ready') return;
    const pattern = `tasks:org:${organization}*`;
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {}
}

module.exports = {
  buildTaskCacheKey,
  getCache,
  setCache,
  invalidateAssigneeCache,
  invalidateOrgCache,
};
