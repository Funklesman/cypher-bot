const axios = require('axios');
const Parser = require('rss-parser');
const { analyzeArticleContent } = require('./bot');

// Initialize RSS parser
const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['media:content', 'media', {keepArray: true}],
      ['content:encoded', 'contentEncoded']
    ]
  }
});

// List of potential crypto news sources with RSS feeds
const cryptoSources = [
  {
    name: 'CoinDesk',
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    type: 'rss'
  },
  {
    name: 'CoinTelegraph',
    url: 'https://cointelegraph.com/rss',
    type: 'rss'
  },
  {
    name: 'Decrypt',
    url: 'https://decrypt.co/feed',
    type: 'rss'
  },
  {
    name: 'CryptoSlate',
    url: 'https://cryptoslate.com/feed/',
    type: 'rss'
  },
  {
    name: 'Blockworks',
    url: 'https://blockworks.co/feed',
    type: 'rss'
  },
  {
    name: 'TheBlock',
    url: 'https://www.theblock.co/rss.xml',
    type: 'rss'
  },
  {
    name: 'Bitcoin Magazine',
    url: 'https://bitcoinmagazine.com/feed',
    type: 'rss'
  }
];

// Function to test an RSS feed
async function testRSSFeed(source) {
  console.log(`\n🔍 Testing ${source.name} (${source.url})`);
  try {
    const feed = await parser.parseURL(source.url);
    
    // Check for feed information
    console.log(`✅ Successfully connected to feed`);
    console.log(`📰 Title: ${feed.title || 'Unknown'}`);
    console.log(`📋 Description: ${(feed.description || '').substring(0, 100)}...`);
    console.log(`🔢 Items found: ${feed.items.length}`);
    
    if (feed.items.length === 0) {
      console.log(`❌ No items found in the feed`);
      return { success: false, articles: [] };
    }
    
    // Process the first 3 articles (or fewer if less available)
    const articlesToProcess = Math.min(3, feed.items.length);
    const articles = [];
    
    for (let i = 0; i < articlesToProcess; i++) {
      const item = feed.items[i];
      const article = {
        title: item.title,
        description: item.contentSnippet || item.content || item.contentEncoded || item.description || '',
        url: item.link,
        source: source.name,
        publishedAt: new Date(item.pubDate || item.isoDate || Date.now())
      };
      
      // Check if content is parsable and has necessary fields
      if (!article.title || !article.url) {
        console.log(`⚠️ Article #${i+1} missing essential fields`);
        continue;
      }
      
      // Trim description if too long
      if (article.description && article.description.length > 500) {
        article.description = article.description.substring(0, 500) + '...';
      }
      
      // Check if it's actually crypto-relevant
      console.log(`\n📄 Article #${i+1}: ${article.title}`);
      console.log(`📅 Published: ${article.publishedAt.toISOString()}`);
      
      try {
        const analysis = await analyzeArticleContent(article.title, article.description, article.source);
        console.log(`🔍 Crypto-relevant: ${analysis.isRelevant ? 'Yes ✅' : 'No ❌'}`);
        console.log(`🔍 Sentiment: ${analysis.sentiment}`);
        article.isRelevant = analysis.isRelevant;
        article.sentiment = analysis.sentiment;
      } catch (error) {
        console.error(`❌ Error analyzing article content: ${error.message}`);
        article.isRelevant = null;
        article.sentiment = null;
      }
      
      articles.push(article);
    }
    
    const relevantCount = articles.filter(a => a.isRelevant).length;
    console.log(`\n📊 Summary for ${source.name}:`);
    console.log(`   Total articles tested: ${articles.length}`);
    console.log(`   Crypto-relevant articles: ${relevantCount} (${Math.round(relevantCount/articles.length*100)}%)`);
    console.log(`   Articles with publication dates: ${articles.filter(a => !!a.publishedAt).length}`);
    
    // Calculate freshness (how recent the most recent article is)
    const mostRecent = new Date(Math.max(...articles.map(a => a.publishedAt.getTime())));
    const ageInHours = (Date.now() - mostRecent.getTime()) / (1000 * 60 * 60);
    console.log(`   Most recent article: ${mostRecent.toISOString()} (${Math.round(ageInHours)} hours ago)`);
    
    // Rating system (basic)
    let rating = 0;
    // Points for relevance
    rating += (relevantCount/articles.length) * 5;
    // Points for freshness (max 5 if less than 6h old, 0 if more than 48h)
    rating += Math.max(0, 5 - (ageInHours / 10));
    // Points for quantity 
    rating += Math.min(5, feed.items.length / 5);
    
    console.log(`   📈 Overall rating: ${rating.toFixed(1)}/15`);
    
    return { success: true, articles, rating };
    
  } catch (error) {
    console.error(`❌ Error testing RSS feed: ${error.message}`);
    return { success: false, articles: [] };
  }
}

// Main testing function
async function testAllSources() {
  console.log('🚀 Starting test of crypto news sources...');
  
  const results = [];
  
  // Test each source
  for (const source of cryptoSources) {
    if (source.type === 'rss') {
      const result = await testRSSFeed(source);
      results.push({
        source: source.name,
        success: result.success,
        rating: result.rating || 0,
        articlesFound: result.articles ? result.articles.length : 0,
        relevantArticles: result.articles ? result.articles.filter(a => a.isRelevant).length : 0
      });
    }
    // Add handling for other types of sources if needed
  }
  
  // Display final summary
  console.log('\n====================================================');
  console.log('📊 SUMMARY OF CRYPTO NEWS SOURCES');
  console.log('====================================================');
  
  // Sort by rating
  results.sort((a, b) => b.rating - a.rating);
  
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    const relevancePercent = result.articlesFound > 0 
      ? Math.round((result.relevantArticles / result.articlesFound) * 100) 
      : 0;
    
    console.log(`${status} ${result.source.padEnd(15)} | Rating: ${result.rating.toFixed(1).padStart(4)}/15 | Relevance: ${relevancePercent}% | Articles: ${result.articlesFound}`);
  }
  
  // Provide recommendations
  console.log('\n====================================================');
  console.log('🏆 RECOMMENDED SOURCES TO ADD');
  console.log('====================================================');
  
  const recommended = results
    .filter(r => r.success && r.rating > 8 && r.relevantArticles > 0)
    .slice(0, 3);
    
  if (recommended.length === 0) {
    console.log('No sources met the recommendation criteria.');
  } else {
    recommended.forEach((rec, i) => {
      const source = cryptoSources.find(s => s.name === rec.source);
      console.log(`${i+1}. ${rec.source} (${source.url})`);
      console.log(`   Rating: ${rec.rating.toFixed(1)}/15 | Relevance: ${Math.round((rec.relevantArticles / rec.articlesFound) * 100)}%`);
    });
  }
}

// Run the tests
testAllSources().catch(console.error); 