const { connectToMongoDB, fetchNews, isArticleProcessed, markArticleAsProcessed } = require('./bot');

// Test the deduplication functionality
async function testDeduplication() {
  try {
    console.log('🔍 Testing article deduplication...\n');
    
    // Connect to MongoDB
    const connected = await connectToMongoDB();
    if (!connected) {
      console.error('❌ Could not connect to MongoDB. Exiting test.');
      return;
    }
    
    // Fetch news articles
    console.log('📰 Fetching news articles...');
    const articles = await fetchNews();
    if (articles.length === 0) {
      console.log('❌ No new articles found or all articles already processed.');
      return;
    }
    
    console.log(`✅ Found ${articles.length} articles that haven't been processed yet.\n`);
    console.log('📊 Articles sorted by recency:');
    articles.forEach((article, index) => {
      const pubDate = article.publishedAt ? article.publishedAt.toISOString() : 'Unknown';
      console.log(`${index+1}. ${article.title} | Source: ${article.source} | Published: ${pubDate}`);
    });
    console.log('\n');
    
    // Test with the first article
    const testArticle = articles[0];
    console.log('🧪 Testing with article:');
    console.log(`   Title: ${testArticle.title}`);
    console.log(`   URL: ${testArticle.url}`);
    console.log(`   Published: ${testArticle.publishedAt ? testArticle.publishedAt.toISOString() : 'Unknown'}\n`);
    
    // First check - should return false (not processed yet)
    const isProcessedBefore = await isArticleProcessed(testArticle.url);
    console.log(`🔍 Is article already processed? ${isProcessedBefore ? 'Yes' : 'No'}`);
    
    if (!isProcessedBefore) {
      // Mark the article as processed
      console.log('✍️ Marking article as processed...');
      const marked = await markArticleAsProcessed(testArticle);
      console.log(`✅ Article marked as processed: ${marked ? 'Success' : 'Failed'}\n`);
      
      // Second check - should return true (now processed)
      const isProcessedAfter = await isArticleProcessed(testArticle.url);
      console.log(`🔍 Is article processed after marking? ${isProcessedAfter ? 'Yes' : 'No'}\n`);
      
      // Fetch news again - should exclude the marked article
      console.log('📰 Fetching news articles again (should exclude the marked article)...');
      const newArticles = await fetchNews();
      
      // Check if our test article is excluded
      const isExcluded = !newArticles.some(article => article.url === testArticle.url);
      console.log(`✅ Test article excluded from new results: ${isExcluded ? 'Yes' : 'No'}`);
      console.log(`📊 Articles count before: ${articles.length}, after: ${newArticles.length}`);
      
      if (isExcluded && newArticles.length < articles.length) {
        console.log('\n🎉 DEDUPLICATION TEST PASSED! The system correctly identifies and filters processed articles.');
      } else {
        console.log('\n⚠️ DEDUPLICATION TEST FAILED! The system did not correctly filter processed articles.');
      }
    } else {
      console.log('\n⚠️ Test article was already processed. Try with different news sources or clear the database.');
    }
    
  } catch (error) {
    console.error('❌ Error in deduplication test:', error);
  }
}

// Run the test
testDeduplication().catch(console.error); 