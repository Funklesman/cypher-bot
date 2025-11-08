#!/usr/bin/env node

/**
 * Clear processed articles from MongoDB to allow reprocessing
 * Use this for testing new prompts on existing articles
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb+srv://funkle:IqyTHXDNtyBAYX8q@cypheru.4jeexhk.mongodb.net/?retryWrites=true&w=majority&appName=CypherU';
const DB_NAME = 'TweetBot';

async function clearProcessedArticles() {
    const client = new MongoClient(MONGO_URI);
    
    try {
        console.log('🔄 Connecting to MongoDB...');
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        const db = client.db(DB_NAME);
        const postHistory = db.collection('post_history');
        
        // Get count before deletion
        const countBefore = await postHistory.countDocuments();
        console.log(`📊 Found ${countBefore} processed articles`);
        
        if (countBefore === 0) {
            console.log('✅ No articles to clear');
            return;
        }
        
        // Clear all processed articles
        const result = await postHistory.deleteMany({});
        console.log(`✅ Cleared ${result.deletedCount} processed articles`);
        console.log('🎯 You can now regenerate tweets from existing articles!');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    } finally {
        await client.close();
        console.log('👋 Disconnected from MongoDB');
    }
}

clearProcessedArticles();

