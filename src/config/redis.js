const Redis = require('ioredis');

let redisClient;

async function connectRedis() {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    lazyConnect: true,
  });

  redisClient.on('error', (err) => {
    console.warn('Redis error (non-fatal):', err.message);
  });

  try {
    await redisClient.connect();
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis unavailable — caching disabled:', err.message);
  }
}

function getRedis() {
  return redisClient;
}

module.exports = { connectRedis, getRedis };
