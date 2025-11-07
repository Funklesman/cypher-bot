/**
 * Test ContentDeduplicator with Redis
 */

require('dotenv').config();
const ContentDeduplicator = require('./src/js/content_deduplicator');

async function testDeduplicator() {
  console.log('Testing ContentDeduplicator with Redis...');
  const deduplicator = new ContentDeduplicator();
  
  try {
    // Test basic Redis connection via the deduplicator
    const ping = await deduplicator.redis.ping();
    console.log(`Redis PING via deduplicator: ${ping}`);
    
    // Test storing and retrieving content
    const testArticle = {
      title: 'Test Article for Deduplicator',
      description: 'This is a test article to verify ContentDeduplicator Redis functionality',
      url: 'https://example.com/test-deduplicator',
      source: 'TestSource',
      publishedAt: new Date()
    };
    
    const testContent = "This is some test content for the article about Bitcoin and cryptocurrency.";
    
    console.log('Testing storeContent method...');
    await deduplicator.storeContent(testArticle, testContent);
    console.log('✅ Content stored successfully');
    
    console.log('Testing isSimilarToCached method...');
    const isSimilar = await deduplicator.isSimilarToCached(testArticle, testContent);
    console.log(`Is similar to cached: ${isSimilar}`);
    
    console.log('Testing cleanup method...');
    await deduplicator.cleanup();
    console.log('✅ Cleanup completed');
    
    // Close the Redis connection
    console.log('Closing Redis connection...');
    await deduplicator.close();
    console.log('✅ Redis connection closed');
    
    console.log('\nContentDeduplicator tests completed successfully.');
  } catch (error) {
    console.error(`❌ Error in ContentDeduplicator test: ${error.message}`);
    console.error(error.stack);
    
    // Try to close the connection regardless of error
    try {
      await deduplicator.close();
    } catch (closeError) {
      console.error(`Error closing Redis connection: ${closeError.message}`);
    }
  }
}

// Run the test
testDeduplicator(); 