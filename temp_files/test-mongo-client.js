/**
 * Test script for MongoDB client
 * 
 * Simple test to verify the direct MongoDB client works
 */

require('dotenv').config();

// Import MongoDB client directly
const MongoDBClient = require('./src/js/mongodb_client');
const dbClient = new MongoDBClient();

async function runTests() {
  try {
    console.log('Testing MongoDB client directly...');
    
    // Test 1: Check if MongoDB client is initialized
    console.log('\nTest 1: Check MongoDB client initialized');
    const isHealthy = await dbClient.isHealthy();
    console.log(`MongoDB client is healthy: ${isHealthy}`);
    
    if (!isHealthy) {
      console.error('MongoDB client is not healthy. Check your MongoDB connection.');
      return;
    }
    
    // Test 2: Get recent articles
    console.log('\nTest 2: Get recent articles');
    const articles = await dbClient.getRecentArticles(5);
    console.log(`Retrieved ${articles.length} recent articles`);
    
    // Test 3: Check article processing status
    console.log('\nTest 3: Check if an article exists');
    // Use a URL from the articles if we have one, otherwise use a test URL
    const testUrl = articles.length > 0 ? articles[0].url : 'https://example.com/test-article';
    const isProcessed = await dbClient.isArticleProcessed(testUrl);
    console.log(`Article ${testUrl} is processed: ${isProcessed}`);
    
    console.log('\nAll tests completed successfully!');
  } catch (error) {
    console.error('Error running tests:', error);
  }
}

// Run tests and exit
runTests().then(() => {
  console.log('Tests finished, exiting...');
  process.exit(0);
}); 