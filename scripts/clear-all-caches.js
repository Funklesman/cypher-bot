const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
});

async function clearAllCaches() {
    try {
        console.log('🔄 Connecting to Redis...');
        
        // Clear all deduplication-related keys
        console.log('\n🗑️ Clearing Redis deduplication cache...');
        
        // Get all content fingerprints
        const contentKeys = await redis.keys('content:*');
        console.log(`  - Found ${contentKeys.length} content: keys`);
        if (contentKeys.length > 0) {
            await redis.del(...contentKeys);
        }
        
        // Get all semantic fingerprints
        const semanticKeys = await redis.keys('semantic:*');
        console.log(`  - Found ${semanticKeys.length} semantic: keys`);
        if (semanticKeys.length > 0) {
            await redis.del(...semanticKeys);
        }
        
        // Get all source sets
        const sourceKeys = await redis.keys('source:*');
        console.log(`  - Found ${sourceKeys.length} source: keys`);
        if (sourceKeys.length > 0) {
            await redis.del(...sourceKeys);
        }
        
        // Clear global articles set
        const globalExists = await redis.exists('global:articles');
        if (globalExists) {
            await redis.del('global:articles');
            console.log(`  - Cleared global:articles`);
        }
        
        // Clear recent topics
        const topicsExists = await redis.exists('recent_topics');
        if (topicsExists) {
            await redis.del('recent_topics');
            console.log(`  - Cleared recent_topics`);
        }
        
        // Clear crosspost tracking
        const crosspostExists = await redis.exists('crosspost:last');
        if (crosspostExists) {
            await redis.del('crosspost:last');
            console.log(`  - Cleared crosspost:last`);
        }
        
        console.log('\n✅ All Redis caches cleared!');
        console.log('🎯 Bot can now regenerate tweets from existing articles with new prompts\n');
        
    } catch (error) {
        console.error('❌ Error clearing caches:', error);
    } finally {
        await redis.quit();
    }
}

clearAllCaches();

