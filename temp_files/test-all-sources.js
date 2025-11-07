const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();
require('dotenv').config();

// Test all requested crypto news sources
async function testAllSources() {
  console.log('TESTING ALL REQUESTED CRYPTO NEWS SOURCES\n');
  
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
  
  // 1. Test NewsAPI (for comparison)
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
    console.log(`\n===== TESTING ${name.toUpperCase()} =====`);
    try {
      const feed = await parser.parseURL(url);
      console.log(`Found ${feed.items.length} articles from ${name}`);
      
      const descriptions = [];
      const dates = [];
      
      feed.items.slice(0, limit).forEach((item, i) => {
        const description = item.contentSnippet || item.content || item.description || '';
        const publishDate = item.pubDate || item.isoDate;
        
        console.log(`\nArticle ${i+1}:`);
        console.log(`Title: ${item.title}`);
        console.log(`Description: ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}`);
        console.log(`Published: ${formatDate(publishDate)}`);
        console.log(`Description Length: ${description.length} characters`);
        
        descriptions.push(description);
        
        if (publishDate) {
          dates.push(new Date(publishDate));
        }
      });
      
      processSource(name, descriptions, dates);
    } catch (error) {
      console.error(`Error fetching from ${name}:`, error.message);
    }
  }
  
  // Define all sources to test with their RSS feed URLs
  const sources = [
    { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
    { name: 'Cointelegraph', url: 'https://cointelegraph.com/rss' },
    { name: 'The Block', url: 'https://www.theblock.co/feed' },
    { name: 'Decrypt', url: 'https://decrypt.co/feed' },
    { name: 'CryptoSlate', url: 'https://cryptoslate.com/feed/' },
    { name: 'Bitcoin Magazine', url: 'https://bitcoinmagazine.com/.rss/full/' },
    { name: 'CoinGape', url: 'https://coingape.com/feed/' },
    { name: 'AMB Crypto', url: 'https://ambcrypto.com/feed/' },
    { name: 'Crypto Briefing', url: 'https://cryptobriefing.com/feed/' },
    { name: 'BeInCrypto', url: 'https://beincrypto.com/feed/' },
    { name: 'BlockWorks', url: 'https://blockworks.co/feed' },
    { name: 'Bitcoinist', url: 'https://bitcoinist.com/feed/' },
    { name: 'CryptoPotato', url: 'https://cryptopotato.com/feed/' },
    { name: 'The Defiant', url: 'https://thedefiant.io/feed' }
  ];
  
  // Test all sources
  for (const source of sources) {
    await testRSSFeed(source.name, source.url);
  }
  
  // Display statistics table
  console.log('\n\n===== DESCRIPTION LENGTH STATISTICS =====');
  console.log('Source\t\tCount\tAvg Length\tMin\tMax\tLatest Article');
  console.log('-------------------------------------------------------------------------');
  
  // Sort sources by average description length (descending)
  const sortedSources = Object.keys(stats).sort((a, b) => stats[b].avgLength - stats[a].avgLength);
  
  sortedSources.forEach(source => {
    const data = stats[source];
    const sourcePadded = source.padEnd(16, ' ');
    console.log(`${sourcePadded}\t${data.count}\t${data.avgLength}\t\t${data.minLength}\t${data.maxLength}\t${formatDate(data.latestDate)}`);
  });
}

// Run the tests
testAllSources().catch(error => {
  console.error('Error running tests:', error);
}); 