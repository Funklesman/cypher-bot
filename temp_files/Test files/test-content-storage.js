/**
 * Test Content Storage
 * 
 * This script tests storing article content and generated tweets in MongoDB.
 * It uses a temporary collection to avoid affecting production data.
 */

const { MongoClient } = require('mongodb');
const { 
    fetchNews, 
    generateTweet, 
    analyzeArticleContent, 
    connectToMongoDB 
} = require('./bot');
require('dotenv').config();

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';
let db;
let contentTestCollection;

// Initialize MongoDB connection with test collection
async function setupTestDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        db = client.db(dbName);
        
        // Create a temporary test collection
        contentTestCollection = db.collection('contentTest');
        
        // Create indexes
        await contentTestCollection.createIndex({ url: 1 }, { unique: true });
        console.log('✅ Test collection initialized with unique url index');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        return false;
    }
}

// Store article with content and generated tweet
async function storeArticleWithContent(article, tweet, sentiment) {
    if (!contentTestCollection) return false;
    
    try {
        const result = await contentTestCollection.insertOne({
            url: article.url,
            title: article.title,
            source: article.source,
            content: article.description || '', // Store the article content
            publishedAt: article.publishedAt || new Date(),
            processedAt: new Date(),
            generatedTweet: tweet, // Store the generated tweet
            sentiment: sentiment, // Store the sentiment
            metrics: {
                tweetLength: tweet ? tweet.length : 0,
                // Additional metrics could be added here
            }
        });
        console.log(`✅ Stored article with content and tweet: ${article.title}`);
        return true;
    } catch (error) {
        if (error.code === 11000) {
            console.log(`Article already in test collection: ${article.title}`);
            return true;
        }
        console.error('❌ Error storing article with content:', error);
        return false;
    }
}

// Run the test
async function runTest(maxArticles = 5) {
    try {
        console.log('🧪 Starting content storage test...');
        
        // Connect to MongoDB and setup test collection
        await setupTestDB();
        
        // Fetch recent news
        const articles = await fetchNews(2); // last 2 days
        console.log(`📰 Found ${articles.length} articles to process`);
        
        if (articles.length === 0) {
            console.log('❌ No articles found for testing.');
            return;
        }
        
        // Process a limited number of articles
        const articlesToProcess = articles.slice(0, maxArticles);
        
        for (const article of articlesToProcess) {
            console.log(`\n🔄 Processing: ${article.title}`);
            
            // Analyze sentiment and relevance
            const analysis = await analyzeArticleContent(article.title, article.description, article.source);
            
            if (!analysis.isRelevant) {
                console.log(`⏭️ Skipping non-crypto article: ${article.title}`);
                continue;
            }
            
            console.log(`📊 Sentiment: ${analysis.sentiment}`);
            
            // Generate tweet
            const tweetContent = await generateTweet(article);
            if (!tweetContent) {
                console.log(`⚠️ Failed to generate tweet for: ${article.title}`);
                continue;
            }
            
            console.log(`📝 Generated tweet (${tweetContent.length} chars)`);
            
            // Store the article with content and tweet
            await storeArticleWithContent(article, tweetContent, analysis.sentiment);
        }
        
        // Print summary from the database
        const count = await contentTestCollection.countDocuments();
        console.log(`\n✅ Test complete. Stored ${count} articles with content and tweets.`);
        
        // Print a sample of the data
        console.log('\n📊 Sample of stored data:');
        const sample = await contentTestCollection.find().limit(1).toArray();
        if (sample.length > 0) {
            console.log(`Title: ${sample[0].title}`);
            console.log(`Source: ${sample[0].source}`);
            console.log(`Sentiment: ${sample[0].sentiment}`);
            console.log(`Content (excerpt): ${sample[0].content.substring(0, 100)}...`);
            console.log(`Tweet (excerpt): ${sample[0].generatedTweet.substring(0, 100)}...`);
            console.log(`Tweet Length: ${sample[0].metrics.tweetLength} characters`);
        }
        
    } catch (error) {
        console.error('❌ Error in test:', error);
    }
}

// Function to view stored content
async function viewStoredContent(limit = 10) {
    try {
        // Connect to MongoDB and setup test collection
        await setupTestDB();
        
        // Get count
        const count = await contentTestCollection.countDocuments();
        console.log(`\n📊 Found ${count} stored articles in test collection`);
        
        // Get articles
        const articles = await contentTestCollection.find()
            .sort({ processedAt: -1 })
            .limit(limit)
            .toArray();
            
        articles.forEach((article, index) => {
            console.log(`\n=== ARTICLE ${index + 1} ===`);
            console.log(`Title: ${article.title}`);
            console.log(`Source: ${article.source}`);
            console.log(`Published: ${new Date(article.publishedAt).toLocaleString()}`);
            console.log(`Sentiment: ${article.sentiment}`);
            console.log(`\nTWEET:\n${article.generatedTweet}`);
            console.log(`\nContent (excerpt): ${article.content.substring(0, 150)}...`);
            console.log('==================\n');
        });
        
    } catch (error) {
        console.error('❌ Error viewing stored content:', error);
    }
}

// Run the test with command line arguments
const action = process.argv[2] || 'run';
const count = process.argv[3] ? parseInt(process.argv[3]) : 5;

if (action === 'view') {
    console.log(`🔍 Viewing up to ${count} stored articles...`);
    viewStoredContent(count);
} else {
    console.log(`🧪 Running test with up to ${count} articles...`);
    runTest(count);
} 