/**
 * Improved RSS-Based News Sources
 * 
 * This module replaces the problematic news fetching with a reliable,
 * RSS-based approach that provides richer content and avoids rate limits.
 */

const Parser = require('rss-parser');

// Initialize RSS parser
const parser = new Parser();

// Cache mechanism to avoid hammering the RSS sources
const cache = {
  data: {},
  timestamps: {},
  ttl: 15 * 60 * 1000 // 15 minutes cache TTL
};

// Improved RSS Source Configuration
// Using sources tested with the test script - all confirmed working
const RSS_SOURCES = {
  cryptoslate: {
    url: 'https://cryptoslate.com/feed/',
    name: 'CryptoSlate', 
    priority: 'high', // High content quality
    articlesPerFetch: 3
  },
  smartliquidity: {
    url: 'https://smartliquidity.info/feed/',
    name: 'Smart Liquidity',
    priority: 'medium', // DeFi focused, good content
    articlesPerFetch: 2
  },
  cryptonews: {
    url: 'https://cryptonews.com/news/feed/',
    name: 'CryptoNews',
    priority: 'medium', // General crypto news
    articlesPerFetch: 3
  },
  thedefiant: {
    url: 'https://thedefiant.io/feed/',
    name: 'The Defiant',
    priority: 'medium', // DeFi focused
    articlesPerFetch: 2
  },
  cryptopotato: {
    url: 'https://cryptopotato.com/feed/',
    name: 'CryptoPotato',
    priority: 'medium', // Keep existing source
    articlesPerFetch: 2
  },
  // Keep some original sources that work
  coindesk: {
    url: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
    name: 'CoinDesk',
    priority: 'high', // Established source
    articlesPerFetch: 3
  },
  decrypt: {
    url: 'https://decrypt.co/feed',
    name: 'Decrypt',
    priority: 'medium', // Good tech coverage
    articlesPerFetch: 2
  }
  // Note: Removed NewsAPI (rate limited) and The Block (403 errors)
  // Note: FX Empire removed (not crypto-focused enough)
};

// Utility function to extract image URL from RSS item (rss-parser format)
function extractImageUrl(item) {
  // Try different image sources in order of preference
  const imageSources = [
    item.enclosure?.url,  // rss-parser format
    item['media:content']?.$?.url,
    item['media:thumbnail']?.$?.url
  ];

  // Find first valid image URL
  for (const imageUrl of imageSources) {
    if (imageUrl && typeof imageUrl === 'string') {
      return imageUrl;
    }
  }

  // Fallback: Parse description/content for img tags
  const contentToSearch = item.content || item.description || '';
  if (contentToSearch) {
    const imgMatch = contentToSearch.match(/<img[^>]+src="([^">]+)"/i);
    if (imgMatch && imgMatch[1]) {
      return imgMatch[1];
    }
  }

  return null;
}

// Utility function to clean and extract description
function cleanDescription(description, maxLength = 500) {
  if (!description) return '';
  
  // Remove CDATA wrapper and HTML tags, but preserve some content
  let cleaned = description
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
    .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags but keep space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Don't truncate if under max length - we want rich content
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) { // If we're close to end, truncate at word
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

// Generic RSS fetcher using rss-parser (secure, no vulnerabilities)
async function fetchRSSFeed(sourceKey) {
  const sourceConfig = RSS_SOURCES[sourceKey];
  if (!sourceConfig) {
    throw new Error(`Unknown RSS source: ${sourceKey}`);
  }

  try {
    // Use rss-parser which is secure and handles all the XML parsing safely
    const feed = await parser.parseURL(sourceConfig.url);
    
    if (!feed.items || feed.items.length === 0) {
      console.warn(`No items found in RSS feed for ${sourceConfig.name}`);
      return [];
    }

    // Transform into standardized format compatible with existing bot
    const transformedItems = feed.items.slice(0, sourceConfig.articlesPerFetch).map(item => {
      const imageUrl = extractImageUrl(item);
      const description = cleanDescription(item.contentSnippet || item.content || item.summary);
      
      return {
        title: item.title || 'No Title',
        description: description,
        url: item.link || '',
        source: sourceConfig.name,
        publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        // Additional metadata for analysis
        author: item.creator || item.author || item['dc:creator'] || null,
        imageUrl: imageUrl,
        contentSnippet: description.substring(0, 200), // For compatibility
        priority: sourceConfig.priority
      };
    });

    console.log(`✅ Fetched ${transformedItems.length} articles from ${sourceConfig.name}`);
    return transformedItems;
    
  } catch (error) {
    console.error(`❌ Error fetching ${sourceConfig.name} feed:`, error.message);
    
    // Don't throw - return empty array to continue with other sources
    return [];
  }
}

// Utility function to get cached data or fetch fresh data
async function getCachedOrFreshData(sourceKey) {
  const now = Date.now();
  
  // Check if we have cached data that's still valid
  if (cache.data[sourceKey] && cache.timestamps[sourceKey] && 
      (now - cache.timestamps[sourceKey] < cache.ttl)) {
    console.log(`📋 Using cached data for ${RSS_SOURCES[sourceKey]?.name}`);
    return cache.data[sourceKey];
  }
  
  try {
    const data = await fetchRSSFeed(sourceKey);
    
    // Update the cache
    cache.data[sourceKey] = data;
    cache.timestamps[sourceKey] = now;
    
    return data;
  } catch (error) {
    console.error(`Error fetching data for ${sourceKey}:`, error.message);
    
    // If we have stale data, return that rather than nothing
    if (cache.data[sourceKey]) {
      console.log(`⚠️ Using stale cached data for ${RSS_SOURCES[sourceKey]?.name}`);
      return cache.data[sourceKey];
    }
    
    return [];
  }
}

// Main function to replace the original fetchNews
async function fetchNews(maxAgeHours = 72) {
  console.log(`🔍 Fetching news from ${Object.keys(RSS_SOURCES).length} RSS sources...`);
  
  const sources = Object.keys(RSS_SOURCES);
  
  try {
    // Fetch from all sources in parallel with error handling
    const allSourcePromises = sources.map(sourceKey => 
      getCachedOrFreshData(sourceKey).catch(error => {
        console.error(`Failed to fetch ${sourceKey}, continuing...`, error.message);
        return []; // Return empty array on error for this source
      })
    );

    const results = await Promise.all(allSourcePromises);

    // Combine all articles
    let allArticles = [];
    results.forEach((sourceArticles, index) => {
      if (Array.isArray(sourceArticles)) {
        allArticles = allArticles.concat(sourceArticles);
      }
    });

    // Sort by publication date (newest first)
    allArticles.sort((a, b) => b.publishedAt - a.publishedAt);

    // Filter out articles older than maxAgeHours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
    
    const recentArticles = allArticles.filter(article => 
      article.publishedAt >= cutoffDate
    );

    console.log(`📰 Found ${recentArticles.length} recent articles (last ${maxAgeHours} hours) from ${sources.length} sources`);
    
    // Log source breakdown
    const sourceBreakdown = {};
    recentArticles.forEach(article => {
      sourceBreakdown[article.source] = (sourceBreakdown[article.source] || 0) + 1;
    });
    
    console.log('📊 Source breakdown:', sourceBreakdown);
    
    return recentArticles;

  } catch (error) {
    console.error('❌ Error in improved fetchNews:', error);
    return [];
  }
}

// Clear cache function (useful for testing)
function clearCache() {
  cache.data = {};
  cache.timestamps = {};
  console.log('🗑️ RSS cache cleared');
}

// Get cache stats (for monitoring)
function getCacheStats() {
  const now = Date.now();
  const stats = {};
  
  Object.keys(cache.data).forEach(sourceKey => {
    const age = now - (cache.timestamps[sourceKey] || 0);
    stats[sourceKey] = {
      articles: cache.data[sourceKey]?.length || 0,
      ageMinutes: Math.round(age / (60 * 1000)),
      isStale: age > cache.ttl
    };
  });
  
  return stats;
}

module.exports = {
  fetchNews,
  clearCache,
  getCacheStats,
  RSS_SOURCES
};
