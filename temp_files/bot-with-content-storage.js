/**
 * Enhanced Content Storage Module for the Crypto News Bot
 * This file adds functions to the main bot.js to store article content and tweets
 */

// Import the existing bot functionality
const botFunctions = require('./bot');

// Function to store an article with its content and generated tweet
async function storeArticleWithContent(db, article, tweet, sentiment) {
    if (!db) return false;
    
    try {
        // Get collection for content storage
        const contentCollection = db.collection('articleContent');
        
        // Create unique index if it doesn't exist
        await contentCollection.createIndex({ url: 1 }, { unique: true });
        
        // Store the article with content
        const result = await contentCollection.insertOne({
            url: article.url,
            title: article.title,
            source: article.source,
            content: article.description || '',
            publishedAt: article.publishedAt || new Date(),
            processedAt: new Date(),
            generatedTweet: tweet,
            sentiment: sentiment,
            postStatus: 'created', // Values: 'created', 'posted', 'failed'
            metrics: {
                tweetLength: tweet ? tweet.length : 0,
                // Add more metrics here as needed
            }
        });
        
        console.log(`✅ Stored article with content and tweet: ${article.title}`);
        return true;
    } catch (error) {
        if (error.code === 11000) {
            console.log(`Article already in content collection: ${article.title}`);
            
            // Update the existing record with the tweet info
            try {
                await contentCollection.updateOne(
                    { url: article.url },
                    { 
                        $set: { 
                            generatedTweet: tweet,
                            sentiment: sentiment,
                            processedAt: new Date(),
                            metrics: {
                                tweetLength: tweet ? tweet.length : 0,
                            }
                        } 
                    }
                );
                console.log(`✅ Updated existing article with new tweet: ${article.title}`);
                return true;
            } catch (updateError) {
                console.error('❌ Error updating article content:', updateError);
                return false;
            }
        }
        console.error('❌ Error storing article with content:', error);
        return false;
    }
}

// Function to update post status after posting
async function updatePostStatus(db, articleUrl, status, postDetails = null) {
    if (!db) return false;
    
    try {
        const contentCollection = db.collection('articleContent');
        
        const update = { 
            $set: { 
                postStatus: status,
                postedAt: new Date()
            } 
        };
        
        // If postDetails are provided, add them to the update
        if (postDetails) {
            update.$set.postDetails = postDetails;
        }
        
        await contentCollection.updateOne(
            { url: articleUrl },
            update
        );
        
        console.log(`✅ Updated post status to "${status}" for article: ${articleUrl}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating post status:', error);
        return false;
    }
}

// Enhanced generateTweet function that also stores the content
async function generateTweetAndStore(db, event, retryCount = 0) {
    // First, generate the tweet using the original function
    const tweetContent = await botFunctions.generateTweet(event, retryCount);
    
    // If the tweet was generated successfully and we have a DB connection
    if (tweetContent && db) {
        // Get the sentiment (we need to analyze again because generateTweet doesn't return it)
        const analysis = await botFunctions.analyzeArticleContent(
            event.title, 
            event.description, 
            event.source
        );
        
        // Store the article with its content and tweet
        await storeArticleWithContent(db, event, tweetContent, analysis.sentiment);
    }
    
    return tweetContent;
}

// Enhanced postToMastodon function that also updates the post status
async function postToMastodonAndUpdate(db, content, articleUrl) {
    // Call the original postToMastodon function
    const result = await botFunctions.postToMastodon(content);
    
    // If we have a DB connection, update the post status
    if (db) {
        if (result) {
            // Post was successful, update with the result data
            await updatePostStatus(db, articleUrl, 'posted', {
                url: result.url,
                id: result.id,
                timestamp: new Date()
            });
        } else {
            // Post failed or was skipped
            await updatePostStatus(db, articleUrl, 'failed');
        }
    }
    
    return result;
}

// Function to get recent content from the database
async function getRecentContent(db, limit = 10) {
    if (!db) return [];
    
    try {
        const contentCollection = db.collection('articleContent');
        
        return await contentCollection.find()
            .sort({ processedAt: -1 })
            .limit(limit)
            .toArray();
    } catch (error) {
        console.error('❌ Error getting recent content:', error);
        return [];
    }
}

// Enhanced runBot that uses content storage
async function runBotWithContentStorage(maxAgeDays = 1) {
    try {
        // Connect to MongoDB
        const dbConnected = await botFunctions.connectToMongoDB();
        const db = dbConnected ? global.db : null;
        
        // Fetch news using the original function
        const news = await botFunctions.fetchNews(maxAgeDays);
        if (news.length === 0) {
            console.log(`No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        
        console.log(`✅ Found ${news.length} recent articles (last ${maxAgeDays} days) to process.`);
        
        for (const event of news) {
            try {
                console.log(`\n🔄 Processing: ${event.title}`);
                console.log(`📅 Published: ${event.publishedAt.toISOString()}`);
                
                // Generate tweet and store content
                const content = await generateTweetAndStore(db, event);
                
                // Skip if the content is null (not crypto-relevant)
                if (content === null) {
                    console.log(`⏭️ Skipping article as it's not crypto-relevant: ${event.title}`);
                    continue;
                }
                
                console.log('Generated Content:', content);
                
                // Post to Mastodon and update status
                const result = await postToMastodonAndUpdate(db, content, event.url);
                
                // Mark article as processed if posted successfully or saved to file
                if (result || !botFunctions.isMastodonConfigured) {
                    await botFunctions.markArticleAsProcessed(event);
                }
                
                await botFunctions.delay(60000); // 1-minute delay between posts
            } catch (error) {
                console.error(`Error processing event: ${event.title}`, error);
            }
        }
    } catch (error) {
        console.error('Error in runBotWithContentStorage:', error);
    }
}

// Export the enhanced functions
module.exports = {
    ...botFunctions,  // Include all original functions
    storeArticleWithContent,
    updatePostStatus,
    generateTweetAndStore,
    postToMastodonAndUpdate,
    getRecentContent,
    runBotWithContentStorage
}; 