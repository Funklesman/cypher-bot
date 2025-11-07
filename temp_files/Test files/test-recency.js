const { connectToMongoDB, fetchNews } = require('./bot');

// Test the article recency sorting
async function testRecency() {
  try {
    console.log('🔍 Testing article recency sorting...\n');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Fetch news articles
    console.log('📰 Fetching and sorting news articles by recency...');
    const articles = await fetchNews();
    if (articles.length === 0) {
      console.log('❌ No new articles found.');
      return;
    }
    
    // Display the articles with their publication dates in a table-like format
    console.log('\n📅 Articles sorted by publication date (newest first):');
    console.log('='.repeat(100));
    console.log('| # | Source    | Publication Date       | Title');
    console.log('='.repeat(100));
    
    articles.forEach((article, index) => {
      const pubDate = article.publishedAt ? article.publishedAt.toISOString().replace('T', ' ').substr(0, 19) : 'Unknown';
      const source = article.source.padEnd(10);
      const num = (index + 1).toString().padStart(2);
      const title = article.title.length > 60 ? article.title.substr(0, 57) + '...' : article.title;
      console.log(`| ${num} | ${source} | ${pubDate} | ${title}`);
    });
    
    console.log('='.repeat(100));
    
    // Verify that the articles are actually sorted by date
    let isSorted = true;
    for (let i = 0; i < articles.length - 1; i++) {
      if (articles[i].publishedAt < articles[i+1].publishedAt) {
        isSorted = false;
        console.log(`\n⚠️ Articles not properly sorted at index ${i} and ${i+1}`);
        console.log(`   ${articles[i].publishedAt.toISOString()} vs ${articles[i+1].publishedAt.toISOString()}`);
      }
    }
    
    if (isSorted) {
      console.log('\n✅ Articles are correctly sorted by publication date (newest first).');
    } else {
      console.log('\n❌ Articles are NOT correctly sorted by publication date.');
    }
    
    // Check if all articles are recent (within last 2 days)
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const recentArticles = articles.filter(article => article.publishedAt > twoDaysAgo);
    console.log(`\n📊 ${recentArticles.length} of ${articles.length} articles are from the last 2 days.`);
    
    if (recentArticles.length === articles.length) {
      console.log('✅ All articles are recent (within the last 2 days).');
    } else {
      console.log('⚠️ Some articles are older than 2 days.');
      
      // Show the older articles
      const olderArticles = articles.filter(article => article.publishedAt <= twoDaysAgo);
      console.log('\n⏳ Older articles:');
      olderArticles.forEach((article, index) => {
        console.log(`${index+1}. ${article.title} | Published: ${article.publishedAt.toISOString()}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error in testRecency:', error);
  }
}

// Run the test
testRecency().catch(console.error); 