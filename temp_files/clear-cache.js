#!/usr/bin/env node

/**
 * Clear content deduplication cache
 * 
 * This script clears all cached content from Redis to allow reposting of previously posted content
 */

require('dotenv').config();
const Redis = require('ioredis');

// Create Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

async function clearContentCache() {
  try {
    console.log('🧹 Clearing content deduplication cache...');
    
    // Get all content keys
    const contentKeys = await redis.keys('content:*');
    console.log(`Found ${contentKeys.length} content keys`);
    
    if (contentKeys.length > 0) {
      const deleteResult = await redis.del(...contentKeys);
      console.log(`✅ Deleted ${deleteResult} content keys`);
    }
    
    // Get all source keys
    const sourceKeys = await redis.keys('source:*');
    console.log(`Found ${sourceKeys.length} source keys`);
    
    if (sourceKeys.length > 0) {
      const deleteResult = await redis.del(...sourceKeys);
      console.log(`✅ Deleted ${deleteResult} source keys`);
    }
    
    // Get all semantic keys
    const semanticKeys = await redis.keys('semantic:*');
    console.log(`Found ${semanticKeys.length} semantic keys`);
    
    if (semanticKeys.length > 0) {
      const deleteResult = await redis.del(...semanticKeys);
      console.log(`✅ Deleted ${deleteResult} semantic keys`);
    }
    
    // Clear global articles key
    const globalArticlesKey = 'global:articles';
    const globalExists = await redis.exists(globalArticlesKey);
    
    if (globalExists) {
      await redis.del(globalArticlesKey);
      console.log('✅ Cleared global articles set');
    } else {
      console.log('No global articles set found');
    }
    
    // Clear recent topics
    const recentTopicsKey = 'recent_topics';
    const topicsExist = await redis.exists(recentTopicsKey);
    
    if (topicsExist) {
      await redis.del(recentTopicsKey);
      console.log('✅ Cleared recent topics');
    } else {
      console.log('No recent topics found');
    }
    
    // Clear crosspost data
    const crosspostKey = 'crosspost:last';
    const crosspostExists = await redis.exists(crosspostKey);
    
    if (crosspostExists) {
      await redis.del(crosspostKey);
      console.log('✅ Cleared crosspost data');
    } else {
      console.log('No crosspost data found');
    }
    
    console.log('🎉 Cache clearing complete!');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    // Close Redis connection
    redis.quit();
  }
}

// Run the function
clearContentCache(); 