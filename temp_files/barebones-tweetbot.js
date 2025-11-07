/**
 * Barebones TweetBot - No External Dependencies
 * Using only built-in Node.js modules
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { createServer } = require('http');

console.log('Starting barebones tweetbot (no npm dependencies)');

// Create logs directory if it doesn't exist
const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Simple file-based storage
function saveToFile(data, filename) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const filePath = path.join(LOGS_DIR, `${filename}_${timestamp}.txt`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`Saved data to ${filePath}`);
  return filePath;
}

// Simple in-memory store for deduplication
const processedUrls = new Set();

// Fetch RSS feed manually using built-in https
function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    console.log(`Fetching RSS from ${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Received ${data.length} bytes of RSS data`);
        
        // Very basic RSS parsing (this is a simplification)
        const items = [];
        const itemMatches = data.match(/<item>[\s\S]*?<\/item>/g) || [];
        
        console.log(`Found ${itemMatches.length} RSS items`);
        
        itemMatches.slice(0, 3).forEach(itemXml => {
          // Extract title, link and description
          const titleMatch = itemXml.match(/<title>(.*?)<\/title>/);
          const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
          const descMatch = itemXml.match(/<description>(.*?)<\/description>/) || 
                           itemXml.match(/<content:encoded>(.*?)<\/content:encoded>/);
          
          if (titleMatch && linkMatch) {
            items.push({
              title: titleMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
              url: linkMatch[1],
              description: descMatch ? descMatch[1] : 'No description',
              source: 'RSS Feed',
              publishedAt: new Date()
            });
          }
        });
        
        resolve(items);
      });
      
    }).on('error', (err) => {
      console.error('Error fetching RSS:', err.message);
      reject(err);
    });
  });
}

// Generate simple content for an article
function generateContent(article) {
  const hashtags = '#crypto #news';
  return `Check this out: "${article.title}" ${article.url} ${hashtags}`;
}

// Process a single article
async function processArticle(article) {
  console.log(`Processing article: ${article.title}`);
  
  // Skip if already processed
  if (processedUrls.has(article.url)) {
    console.log(`Skipping duplicate: ${article.url}`);
    return false;
  }
  
  // Generate content
  const content = generateContent(article);
  console.log('Generated content:', content);
  
  // Save to file
  saveToFile({
    article,
    content,
    timestamp: new Date().toISOString()
  }, 'article');
  
  // Mark as processed
  processedUrls.add(article.url);
  console.log(`Marked as processed: ${article.url}`);
  
  return true;
}

// Main function to check feeds
async function checkFeeds() {
  try {
    // Commonly used crypto news RSS feeds
    const feedUrl = 'https://cointelegraph.com/rss';
    
    console.log(`Checking feed: ${feedUrl}`);
    const articles = await fetchRSS(feedUrl);
    
    if (articles.length === 0) {
      console.log('No articles found');
      return;
    }
    
    console.log(`Found ${articles.length} articles`);
    
    // Process the first article
    const result = await processArticle(articles[0]);
    console.log(`Article processed: ${result}`);
    
  } catch (error) {
    console.error('Error checking feeds:', error.message);
  }
}

// Run once
console.log('Running feed check...');
checkFeeds().then(() => {
  console.log('Feed check complete');
}).catch(err => {
  console.error('Error:', err);
});

// Create a tiny HTTP server just to show it's working
const port = 3000;
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Barebones TweetBot is running!');
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  console.log('Barebones tweetbot is running!');
}); 