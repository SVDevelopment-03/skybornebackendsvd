// ============================================
// src/config/redis.ts
// ============================================
import { createClient } from 'redis';
import { logger } from '../utils/winston.utils'; 

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis connection retries exhausted');
        return new Error('Redis connection retries exhausted');
      }
      return retries * 100;
    },
  },
});

redisClient.on('error', (err) => {
  logger.error(`Redis Client Error: ${err.message}`);
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis Connected');
  console.log('✅ Redis Connected');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis Reconnecting...');
  console.log('⚠️ Redis Reconnecting...');
});

redisClient.on('ready', () => {
  logger.info('Redis Ready');
  console.log('✅ Redis Ready');
});

export const connectRedis = async (): Promise<void> => {
  try {
    await redisClient.connect();
    logger.info('Redis connection established');
  } catch (error: any) {
    logger.error(`Redis connection failed: ${error.message}`);
    console.error('❌ Redis connection failed:', error);
    // Don't exit process, continue without Redis
  }
};

export default redisClient;