const { connectToMongoDB, fetchNewsAPI, isCryptoRelevant } = require('./bot');
const axios = require('axios');

// Test crypto relevance filtering
async function testCryptoRelevance() {
  try {
    console.log('🔍 Testing crypto relevance filtering...\n');
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // First test our targeted crypto news API fetch
    console.log('📰 Fetching crypto-targeted news from API...');
    const cryptoArticles = await fetchNewsAPI();
    console.log(`✅ Found ${cryptoArticles.length} articles from crypto-targeted search`);
    
    // Now test with some general technology news for comparison
    console.log('\n📰 Fetching general technology news for comparison...');
    
    try {
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'technology OR startup OR artificial intelligence OR innovation',
          language: 'en',
          sortBy: 'publishedAt',
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      
      const techArticles = response.data.articles.slice(0, 10).map((article) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        source: 'Tech News',
        publishedAt: new Date(article.publishedAt || Date.now()),
      }));
      
      console.log(`✅ Found ${techArticles.length} technology articles for testing\n`);
      
      // Combine all articles for testing
      const allTestArticles = [...cryptoArticles, ...techArticles];
      
      // Shuffle the articles to mix them
      for (let i = allTestArticles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allTestArticles[i], allTestArticles[j]] = [allTestArticles[j], allTestArticles[i]];
      }
      
      // Test each article for crypto relevance
      console.log('🧪 Testing articles for crypto relevance:');
      console.log('='.repeat(100));
      console.log('| Result | Source    | Title');
      console.log('='.repeat(100));
      
      let cryptoCount = 0;
      let nonCryptoCount = 0;
      
      for (const article of allTestArticles) {
        const isRelevant = await isCryptoRelevant(article);
        const result = isRelevant ? '✅ YES  ' : '❌ NO   ';
        const source = article.source.padEnd(10);
        const title = article.title.length > 70 ? article.title.substr(0, 67) + '...' : article.title;
        
        if (isRelevant) {
          cryptoCount++;
        } else {
          nonCryptoCount++;
        }
        
        console.log(`| ${result} | ${source} | ${title}`);
      }
      
      console.log('='.repeat(100));
      console.log(`\n📊 Results: ${cryptoCount} crypto-relevant articles, ${nonCryptoCount} non-relevant articles`);
      
      // Calculate accuracy against our crypto-targeted vs general tech sets
      const expectedCryptoCount = cryptoArticles.length;
      const expectedNonCryptoCount = techArticles.length;
      const accuracy = (cryptoCount / expectedCryptoCount * 100).toFixed(1);
      
      console.log(`\n📈 Crypto detection rate: Detected ${cryptoCount} out of approximately ${expectedCryptoCount} expected crypto articles (${accuracy}%)`);
      console.log(`\n💡 Note: This is an approximate test as some general tech articles might genuinely be crypto-related.`);
      
    } catch (error) {
      console.error('Error fetching general technology news:', error);
    }
    
  } catch (error) {
    console.error('❌ Error in testCryptoRelevance:', error);
  }
}

// Run the test
testCryptoRelevance().catch(console.error); 