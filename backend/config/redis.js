const Redis = require('redis');

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('❌ Missing Redis configuration');
  process.exit(1);
}

const redis = Redis.createClient({
  url: redisUrl,
  retry_strategy: (options) => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('❌ Redis server refused connection');
      return new Error('Redis server refused connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      console.error('❌ Redis retry time exhausted');
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      console.error('❌ Redis max retry attempts reached');
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('❌ Redis connection error:', err.message);
});

redis.on('ready', () => {
  console.log('🚀 Redis ready for operations');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

// Connect to Redis
redis.connect().catch(console.error);

module.exports = redis;

// Cache utilities
const cacheKeys = {
  landingContent: (lang) => `landing:${lang}`,
  pricingContent: (lang) => `pricing:${lang}`,
  serverLocations: 'server_locations',
  userTunnels: (userId) => `user_tunnels:${userId}`,
};

const cacheTTL = {
  content: 3600, // 1 hour
  locations: 86400, // 24 hours
  tunnels: 300, // 5 minutes
};

module.exports.cacheKeys = cacheKeys;
module.exports.cacheTTL = cacheTTL;