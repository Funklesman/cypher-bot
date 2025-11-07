/**
 * Enhanced Crypto News Bot
 * Extends the original bot with content storage and additional features
 */

// Import original bot functionality
const originalBot = require('./bot');
const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';
let db;

// Initialize enhanced MongoDB connection
async function connectToMongoDB() {
    try {
        // Use the original bot's connection function
        const connected = await originalBot.connectToMongoDB();
        
        if (connected) {
            // Get a new MongoDB client instance
            const client = new MongoClient(mongoUri);
            await client.connect();
            db = client.db(dbName);
            
            // Just get references to collections instead of creating them
            // This works with existing collections or creates them if they don't exist
            const contentCollection = db.collection('contentTest');
            const postHistoryCollection = db.collection('post_history');
            const urgentCollection = db.collection('urgentNews');
            
            console.log('✅ Enhanced collections initialized');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error setting up enhanced collections:', error);
        return false;
    }
}

// Store article content in the contentTest collection
async function storeArticleContent(article, content) {
    if (!db) return false;
    
    try {
        const contentCollection = db.collection('contentTest');
        
        // Check if article already exists
        const existing = await contentCollection.findOne({ url: article.url });
        
        if (existing) {
            // Update existing entry
            await contentCollection.updateOne(
                { url: article.url },
                { 
                    $set: {
                        content: content,
                        updatedAt: new Date()
                    }
                }
            );
            console.log('✅ Updated existing article content in contentTest collection');
        } else {
            // Create new entry
            await contentCollection.insertOne({
                url: article.url,
                title: article.title,
                source: article.source,
                description: article.description || '',
                publishedAt: article.publishedAt || new Date(),
                processedAt: new Date(),
                content: content,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log('✅ Stored article content in contentTest collection');
        }
        return true;
    } catch (error) {
        console.error('❌ Error storing article content:', error);
        return false;
    }
}

// Store post history in the post_history collection
async function storePostHistory(article, content, postResult) {
    if (!db) return false;
    
    try {
        const postHistoryCollection = db.collection('post_history');
        
        await postHistoryCollection.insertOne({
            url: article.url,
            title: article.title,
            source: article.source,
            publishedAt: article.publishedAt || new Date(),
            postedAt: new Date(),
            content: content,
            postSuccess: !!postResult,
            postUrl: postResult ? postResult.url : null,
            postId: postResult ? postResult.id : null,
            characterCount: content.length
        });
        
        console.log('✅ Stored post history in post_history collection');
        return true;
    } catch (error) {
        console.error('❌ Error storing post history:', error);
        return false;
    }
}

// Check if an article should be considered urgent
async function checkUrgentNews(article) {
    // Keywords that indicate urgency
    const urgentKeywords = [
        'hack', 'exploit', 'vulnerability', 'attack', 'stolen', 'theft', 'crash',
        'collapse', 'plunge', 'emergency', 'critical', 'urgent', 'breaking',
        'halted', 'suspended', 'SEC charges', 'fraud', 'investigation', 'lawsuit',
        'security breach', 'major loss'
    ];
    
    // Check if title contains any urgent keywords
    const isUrgent = urgentKeywords.some(keyword => 
        article.title.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isUrgent) {
        // Store in urgentNews collection
        if (db) {
            try {
                const urgentCollection = db.collection('urgentNews');
                
                await urgentCollection.insertOne({
                    url: article.url,
                    title: article.title,
                    source: article.source,
                    publishedAt: article.publishedAt || new Date(),
                    detectedAt: new Date(),
                    processed: false
                });
                
                console.log('🚨 Urgent news detected and stored:', article.title);
            } catch (error) {
                console.error('❌ Error storing urgent news:', error);
            }
        }
        return true;
    }
    
    return false;
}

// Enhanced version of generateTweet that also stores content
async function generateTweetAndStore(article) {
    // Generate the tweet using the original function
    const content = await originalBot.generateTweet(article);
    
    // If content was generated successfully, store it
    if (content) {
        await storeArticleContent(article, content);
        await checkUrgentNews(article);
    }
    
    return content;
}

// Enhanced version of postToMastodon that stores post history
async function postToMastodonAndStore(article, content) {
    // Post to Mastodon using the original function
    const result = await originalBot.postToMastodon(content);
    
    // Store post history
    await storePostHistory(article, content, result);
    
    return result;
}

// Enhanced version of runBot
async function runEnhancedBot(maxAgeDays = 1) {
    try {
        console.log(`🤖 Starting enhanced bot with ${maxAgeDays} day lookback period...`);
        
        // Ensure MongoDB connection with enhanced collections
        await connectToMongoDB();
        
        // Fetch news using the original function
        const news = await originalBot.fetchNews(maxAgeDays);
        
        if (news.length === 0) {
            console.log(`No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        
        console.log(`✅ Found ${news.length} recent articles (last ${maxAgeDays} days) to process.`);
        
        for (const article of news) {
            try {
                console.log(`\n🔄 Processing: ${article.title}`);
                console.log(`📅 Published: ${article.publishedAt.toISOString()}`);
                
                // Check if urgent first
                const isUrgent = await checkUrgentNews(article);
                if (isUrgent) {
                    console.log(`🚨 Article flagged as potentially urgent: ${article.title}`);
                }
                
                // Generate tweet and store content
                const content = await generateTweetAndStore(article);
                
                // Skip if the content is null (not crypto-relevant)
                if (content === null) {
                    console.log(`⏭️ Skipping article as it's not crypto-relevant: ${article.title}`);
                    continue;
                }
                
                console.log('Generated Content:', content);
                
                if (process.env.MASTODON_POST_ENABLED === 'true') {
                    console.log('🚀 Posting to Mastodon (MASTODON_POST_ENABLED=true)');
                    const result = await postToMastodonAndStore(article, content);
                    
                    // Mark article as processed if posted successfully or saved to file
                    if (result) {
                        await originalBot.markArticleAsProcessed(article);
                    }
                } else {
                    console.log('⚠️ Skipping Mastodon post (MASTODON_POST_ENABLED not set to true)');
                    console.log('💾 Content will be saved to file');
                    
                    // Store post history with null result
                    await storePostHistory(article, content, null);
                    
                    // Mark as processed even when not posting
                    await originalBot.markArticleAsProcessed(article);
                }
                
                await originalBot.delay(60000); // 1-minute delay between posts
            } catch (error) {
                console.error(`Error processing article: ${article.title}`, error);
            }
        }
    } catch (error) {
        console.error('Error in runEnhancedBot:', error);
    }
}

// Post a single item with enhanced functionality
async function postSingleItemEnhanced(maxAgeDays = 1) {
    try {
        // Ensure MongoDB connection with enhanced collections
        await connectToMongoDB();
        
        console.log('🤖 Generating a single enhanced post...\n');
        const news = await originalBot.fetchNews(maxAgeDays);
        
        if (news.length === 0) {
            console.log(`❌ No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        
        const randomIndex = Math.floor(Math.random() * news.length);
        const article = news[randomIndex];
        
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${article.source}`);
        console.log(`📝 TITLE: ${article.title}`);
        console.log(`📅 PUBLISHED: ${article.publishedAt.toISOString()}`);
        console.log(`🔗 URL: ${article.url}`);
        
        // Check if urgent
        await checkUrgentNews(article);
        
        // Generate tweet and store content
        const content = await generateTweetAndStore(article);
        
        // Handle non-crypto-relevant content
        if (content === null) {
            console.log('\n⏭️ This article is not crypto-relevant and will be skipped.');
            return;
        }
        
        console.log('\n🐦 GENERATED CONTENT:');
        console.log(content);
        console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
        
        if (process.env.MASTODON_POST_ENABLED === 'true') {
            console.log('🚀 Posting to Mastodon...');
            const result = await postToMastodonAndStore(article, content);
            
            if (result) {
                console.log(`✅ Posted to Mastodon: ${result.url}`);
                console.log(`📱 View your post at: ${result.url}`);
                await originalBot.markArticleAsProcessed(article);
            }
        } else {
            console.log('\n⚠️ To post this to Mastodon, set MASTODON_POST_ENABLED=true in your .env file');
            
            // Store post history with null result when not posting
            await storePostHistory(article, content, null);
        }
        
        console.log('=====================================\n');
    } catch (error) {
        console.error('❌ Error in postSingleItemEnhanced:', error);
    }
}

// Export the enhanced functions
module.exports = {
    // Include all original functions
    ...originalBot,
    
    // Enhanced functions
    connectToMongoDB,
    storeArticleContent,
    storePostHistory,
    checkUrgentNews,
    generateTweetAndStore,
    postToMastodonAndStore,
    runEnhancedBot,
    postSingleItemEnhanced
}; 