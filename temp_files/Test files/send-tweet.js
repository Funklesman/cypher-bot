/**
 * Send a single tweet to Mastodon
 * 
 * Simple script to generate and post one tweet
 */

const bot = require('./bot');
require('dotenv').config();

// Function to generate and post a single tweet
async function sendSingleTweet() {
  try {
    console.log('🤖 Generating and sending a single tweet...\n');
    
    // Ensure MongoDB connection
    await bot.connectToMongoDB();
    
    // Fetch recent articles
    const articles = await bot.fetchNews(2); // Last 2 days
    
    if (articles.length === 0) {
      console.log('❌ No recent unprocessed articles found.');
      return;
    }
    
    // Select a random article
    const randomIndex = Math.floor(Math.random() * articles.length);
    const article = articles[randomIndex];
    
    console.log(`\n📝 Selected article: ${article.title}`);
    console.log(`🔍 Source: ${article.source}`);
    console.log(`📅 Published: ${article.publishedAt.toISOString()}`);
    
    // Generate tweet content
    console.log('\n⏳ Generating tweet...');
    const content = await bot.generateTweet(article);
    
    if (!content) {
      console.log('❌ Could not generate tweet content for this article.');
      return;
    }
    
    // Show the generated content
    console.log('\n📝 Generated tweet:');
    console.log('----------------------------------------');
    console.log(content);
    console.log('----------------------------------------');
    console.log(`📊 Character count: ${content.length}/650`);
    
    // Post to Mastodon
    console.log('\n🚀 Posting to Mastodon...');
    const result = await bot.postToMastodon(content);
    
    if (result) {
      console.log(`✅ Tweet posted successfully!`);
      console.log(`🔗 URL: ${result.url}`);
      
      // Mark as processed
      await bot.markArticleAsProcessed(article);
    } else {
      console.log('❌ Failed to post to Mastodon.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
sendSingleTweet(); 