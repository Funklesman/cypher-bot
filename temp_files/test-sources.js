const axios = require('axios');
const Parser = require('rss-parser');
const parser = new Parser();
require('dotenv').config();

// Test individual news sources
async function testNewsSources() {
  console.log('TESTING DIFFERENT NEWS SOURCES FOR DESCRIPTION QUALITY\n');
  
  // 1. Test NewsAPI
  console.log('\n===== TESTING NEWSAPI =====');
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain',
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: 5,
        apiKey: process.env.NEWS_API_KEY,
      },
    });
    
    console.log(`Found ${response.data.articles.length} articles from NewsAPI`);
    response.data.articles.slice(0, 2).forEach((article, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${article.title}`);
      console.log(`Description: ${article.description}`);
      console.log(`URL: ${article.url}`);
      console.log(`Source: ${article.source.name}`);
      console.log(`Published: ${article.publishedAt}`);
      console.log(`Description Length: ${article.description ? article.description.length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from NewsAPI:', error.message);
  }
  
  // 2. Test CoinDesk RSS
  console.log('\n===== TESTING COINDESK RSS =====');
  try {
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    console.log(`Found ${feed.items.length} articles from CoinDesk RSS`);
    
    feed.items.slice(0, 2).forEach((item, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${item.title}`);
      console.log(`Description: ${item.contentSnippet || item.content}`);
      console.log(`URL: ${item.link}`);
      console.log(`Published: ${item.pubDate || item.isoDate}`);
      console.log(`Description Length: ${(item.contentSnippet || item.content) ? (item.contentSnippet || item.content).length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from CoinDesk RSS:', error.message);
  }
  
  // 3. Test CoinTelegraph RSS
  console.log('\n===== TESTING COINTELEGRAPH RSS =====');
  try {
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    console.log(`Found ${feed.items.length} articles from CoinTelegraph RSS`);
    
    feed.items.slice(0, 2).forEach((item, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${item.title}`);
      console.log(`Description: ${item.contentSnippet || item.content}`);
      console.log(`URL: ${item.link}`);
      console.log(`Published: ${item.pubDate || item.isoDate}`);
      console.log(`Description Length: ${(item.contentSnippet || item.content) ? (item.contentSnippet || item.content).length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from CoinTelegraph RSS:', error.message);
  }
  
  // 4. Test Defiant RSS
  console.log('\n===== TESTING DEFIANT RSS =====');
  try {
    const feed = await parser.parseURL('https://thedefiant.io/feed');
    console.log(`Found ${feed.items.length} articles from Defiant RSS`);
    
    feed.items.slice(0, 2).forEach((item, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${item.title}`);
      console.log(`Description: ${item.contentSnippet || item.content}`);
      console.log(`URL: ${item.link}`);
      console.log(`Published: ${item.pubDate || item.isoDate}`);
      console.log(`Description Length: ${(item.contentSnippet || item.content) ? (item.contentSnippet || item.content).length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from Defiant RSS:', error.message);
  }
  
  // 5. Test Decrypt RSS - Adding a new source
  console.log('\n===== TESTING DECRYPT RSS =====');
  try {
    const feed = await parser.parseURL('https://decrypt.co/feed');
    console.log(`Found ${feed.items.length} articles from Decrypt RSS`);
    
    feed.items.slice(0, 2).forEach((item, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${item.title}`);
      console.log(`Description: ${item.contentSnippet || item.content}`);
      console.log(`URL: ${item.link}`);
      console.log(`Published: ${item.pubDate || item.isoDate}`);
      console.log(`Description Length: ${(item.contentSnippet || item.content) ? (item.contentSnippet || item.content).length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from Decrypt RSS:', error.message);
  }
  
  // 6. Test BlockWorks RSS - Adding another new source
  console.log('\n===== TESTING BLOCKWORKS RSS =====');
  try {
    const feed = await parser.parseURL('https://blockworks.co/feed');
    console.log(`Found ${feed.items.length} articles from BlockWorks RSS`);
    
    feed.items.slice(0, 2).forEach((item, i) => {
      console.log(`\nArticle ${i+1}:`);
      console.log(`Title: ${item.title}`);
      console.log(`Description: ${item.contentSnippet || item.content}`);
      console.log(`URL: ${item.link}`);
      console.log(`Published: ${item.pubDate || item.isoDate}`);
      console.log(`Description Length: ${(item.contentSnippet || item.content) ? (item.contentSnippet || item.content).length : 0} characters`);
    });
  } catch (error) {
    console.error('Error fetching from BlockWorks RSS:', error.message);
  }
}

// Run the tests
testNewsSources().catch(error => {
  console.error('Error running tests:', error);
}); 