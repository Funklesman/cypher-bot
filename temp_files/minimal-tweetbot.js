/**
 * Ultra-Minimal TweetBot - Just RSS and Redis
 */

// Add timestamp to console logs
const originalConsoleLog = console.log;
console.log = function() {
  const timestamp = new Date().toISOString();
  originalConsoleLog.apply(console, [`[${timestamp}]`, ...arguments]);
};

console.log('Starting ultra-minimal tweetbot (RSS + Redis only)');

// Load environment variables
require('dotenv').config();

// Core dependencies only
const Parser = require('rss-parser');
const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

console.log('All modules imported successfully');

// Initialize Redis for deduplication
console.log('Initializing Redis connection...');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || '',
});

// Test Redis connection
redis.ping().then(result => {
  console.log(`Redis PING result: ${result}`);
  console.log('Redis connection successful');
  startFeedChecking();
}).catch(error => {
  console.error(`Redis connection error: ${error.message}`);
  process.exit(1);
});

// Initialize RSS parser
const parser = new Parser();

// Simple storage
const HISTORY_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(HISTORY_DIR)) {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

// Simple file-based storage functions
function saveToFile(data, filename) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(HISTORY_DIR, `${filename}_${timestamp}.txt`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved data to ${filePath}`);
  return filePath;
}

// Fetch news from CoinDesk RSS
async function fetchCoinDeskRSS() {
  try {
    console.log('Fetching news from CoinDesk...');
    const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
    console.log(`Retrieved ${feed.items.length} items from CoinDesk`);
    
    return feed.items.slice(0, 3).map(item => ({
      title: item.title,
      description: item.contentSnippet || item.content || 'No description',
      url: item.link,
      source: 'CoinDesk',
      publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
    }));
  } catch (error) {
    console.error('Error fetching news from CoinDesk:', error.message);
    return [];
  }
}

// Check for duplicates in Redis
async function isDuplicate(url) {
  try {
    console.log(`Checking if article is duplicate: ${url}`);
    const exists = await redis.exists(`article:${url}`);
    console.log(`Duplicate check result: ${exists === 1 ? 'YES' : 'NO'}`);
    return exists === 1;
  } catch (error) {
    console.error(`Error checking duplicate: ${error.message}`);
    return false;
  }
}

// Mark an article as processed
async function markProcessed(article) {
  try {
    // Store in Redis with 1-day expiration
    console.log(`Marking as processed: ${article.title}`);
    await redis.set(`article:${article.url}`, Date.now(), 'EX', 24 * 60 * 60);
    console.log(`Marked as processed: ${article.title}`);
    return true;
  } catch (error) {
    console.error(`Error marking as processed: ${error.message}`);
    return false;
  }
}

// Generate mock content (no OpenAI dependency)
function generateMockContent(article) {
  const content = `Check out this crypto news: "${article.title}" from ${article.source}. #crypto #news`;
  console.log(`Generated mock content: ${content}`);
  return content;
}

// Process a single article
async function processArticle(article) {
  try {
    console.log(`Processing article: ${article.title}`);
    
    // Check if already processed
    const duplicate = await isDuplicate(article.url);
    if (duplicate) {
      console.log(`Skipping duplicate article: ${article.title}`);
      return false;
    }
    
    // Generate mock content
    const content = generateMockContent(article);
    
    // Save to file instead of posting
    saveToFile({
      article,
      content,
      processed: new Date().toISOString()
    }, 'processed_article');
    
    // Mark as processed
    await markProcessed(article);
    
    console.log(`Successfully processed article: ${article.title}`);
    return true;
  } catch (error) {
    console.error(`Error processing article: ${error.message}`);
    return false;
  }
}

// Main function to check feeds
async function checkFeeds() {
  try {
    console.log('Checking RSS feeds...');
    
    // Get news from CoinDesk
    const articles = await fetchCoinDeskRSS();
    
    if (articles.length === 0) {
      console.log('No articles found');
      return;
    }
    
    console.log(`Found ${articles.length} articles. Processing first one...`);
    
    // Process only the most recent article
    await processArticle(articles[0]);
    
  } catch (error) {
    console.error(`Error in checkFeeds: ${error.message}`);
  }
}

// Initialize and run once
function startFeedChecking() {
  console.log('Starting feed checking...');
  
  // Run once immediately
  checkFeeds().then(() => {
    console.log('Initial feed check complete');
  }).catch(err => {
    console.error('Error in initial feed check:', err);
  });
  
  // No cron schedule - just run once
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await redis.quit();
  process.exit(0);
});

console.log('Script setup complete - will start feed checking once Redis connects...'); 