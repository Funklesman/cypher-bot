const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();
require('dotenv').config();

// Test individual news sources and collect stats
async function testNewsSources() {
  console.log('TESTING DIFFERENT NEWS SOURCES FOR DESCRIPTION QUALITY\n');
  
  // Object to store stats for each source
  const stats = {};
  
  // Helper function to process stats
  const processSource = (source, descriptions, dates) => {
    if (descriptions.length === 0) return;
    
    const lengths = descriptions.map(d => d ? d.length : 0);
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);
    const avgLength = Math.round(totalLength / descriptions.length);
    const minLength = Math.min(...lengths);
    const maxLength = Math.max(...lengths);
    
    // Find the most recent date
    let latestDate = dates[0];
    for (const date of dates) {
      if (date > latestDate) {
        latestDate = date;
      }
    }
    
    stats[source] = {
      count: descriptions.length,
      avgLength,
      minLength,
      maxLength,
      totalLength,
      latestDate
    };
  };
  
  // Helper to format date for display
  const formatDate = (date) => {
    if (!date) return 'Unknown';
    
    try {
      const d = new Date(date);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
    } catch (e) {
      return date.toString();
    }
  };
  
  // 1. Test NewsAPI
  console.log('\n===== TESTING NEWSAPI =====');
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 10,
        apiKey: process.env.NEWS_API_KEY,
      },
    });
    
    console.log(`Found ${response.data.articles.length} articles from NewsAPI`);
    const descriptions = [];
    const dates = [];
    
    response.data.articles.slice(0, 3).forEach((article, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${article.title}`);
      console.log(`Description: ${article.description}`);
      console.log(`URL: ${article.url}`);
      console.log(`Source: ${article.source.name}`);
      console.log(`Published: ${formatDate(article.publishedAt)}`);
      console.log(`Description Length: ${article.description ? article.description.length : 0} characters`);
      
      if (article.description) {
        descriptions.push(article.description);
      }
      
      if (article.publishedAt) {
        dates.push(new Date(article.publishedAt));
      }
    });
    
    processSource('NewsAPI', descriptions, dates);
  } catch (error) {
    console.error('Error fetching from NewsAPI:', error.message);
  }
  
  // TEST RSS FEEDS - Function to avoid repeating code
  async function testRSSFeed(name, url, limit = 3) {
    console.log(`\n===== TESTING ${name.toUpperCase()} RSS =====`);
    try {
      const feed = await parser.parseURL(url);
      console.log(`Found ${feed.items.length} articles from ${name} RSS`);
      
      const descriptions = [];
      const dates = [];
      
      feed.items.slice(0, limit).forEach((item, i) => {
        const description = item.contentSnippet || item.content || item.description || '';
        const publishDate = item.pubDate || item.isoDate;
        
        console.log(`\nArticle ${i+1}:`);
        console.log(`Title: ${item.title}`);
        console.log(`Description: ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}`);
        console.log(`URL: ${item.link}`);
        console.log(`Published: ${formatDate(publishDate)}`);
        console.log(`Description Length: ${description.length} characters`);
        
        descriptions.push(description);
        
        if (publishDate) {
          dates.push(new Date(publishDate));
        }
      });
      
      processSource(name, descriptions, dates);
    } catch (error) {
      console.error(`Error fetching from ${name} RSS:`, error.message);
    }
  }
  
  // 2. Test CoinDesk RSS
  await testRSSFeed('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/');
  
  // 3. Test CoinTelegraph RSS
  await testRSSFeed('CoinTelegraph', 'https://cointelegraph.com/rss');
  
  // 4. Test Defiant RSS
  await testRSSFeed('Defiant', 'https://thedefiant.io/feed');
  
  // 5. Test Decrypt RSS
  await testRSSFeed('Decrypt', 'https://decrypt.co/feed');
  
  // 6. Test BlockWorks RSS
  await testRSSFeed('BlockWorks', 'https://blockworks.co/feed');
  
  // 7. Test BeInCrypto RSS
  await testRSSFeed('BeInCrypto', 'https://beincrypto.com/feed/');
  
  // 8. Test Bitcoinist RSS
  await testRSSFeed('Bitcoinist', 'https://bitcoinist.com/feed/');
  
  // 9. Test CryptoPotato RSS
  await testRSSFeed('CryptoPotato', 'https://cryptopotato.com/feed/');
  
  // 10. Test CryptoSlate RSS
  await testRSSFeed('CryptoSlate', 'https://cryptoslate.com/feed/');
  
  // 11. Test The Block RSS
  await testRSSFeed('TheBlock', 'https://www.theblock.co/feed');
  
  // Display statistics table
  console.log('\n\n===== DESCRIPTION LENGTH STATISTICS =====');
  console.log('Source\t\tCount\tAvg Length\tMin\tMax\tLatest Article');
  console.log('-------------------------------------------------------------------------');
  
  // Sort sources by average description length (descending)
  const sortedSources = Object.keys(stats).sort((a, b) => stats[b].avgLength - stats[a].avgLength);
  
  sortedSources.forEach(source => {
    const data = stats[source];
    const sourcePadded = source.padEnd(14, ' ');
    console.log(`${sourcePadded}\t${data.count}\t${data.avgLength}\t\t${data.minLength}\t${data.maxLength}\t${formatDate(data.latestDate)}`);
  });
}

// Run the tests
testNewsSources().catch(error => {
  console.error('Error running tests:', error);
}); 