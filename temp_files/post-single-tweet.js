/**
 * Simple script to post a single tweet to Mastodon
 */

const botFunctions = require('./bot');
const Mastodon = require('mastodon-api');
require('dotenv').config();

async function postSingleTweet() {
  try {
    console.log('🤖 Starting single tweet posting process...');
    
    // Ensure MongoDB connection
    const dbConnected = await botFunctions.connectToMongoDB();
    console.log(`MongoDB connection: ${dbConnected ? '✅ Connected' : '❌ Failed'}`);
    
    // Get a single recent article
    const news = await botFunctions.fetchNews(1);
    
    if (news.length === 0) {
      console.log('❌ No recent news found to post');
      return;
    }
    
    // Select the first article
    const article = news[0];
    console.log('\n=====================================');
    console.log(`🔍 SOURCE: ${article.source}`);
    console.log(`📝 TITLE: ${article.title}`);
    console.log(`📅 PUBLISHED: ${article.publishedAt.toISOString()}`);
    console.log(`🔗 URL: ${article.url}`);
    
    // Generate the tweet content
    console.log('\n🔄 Generating tweet content...');
    const content = await botFunctions.generateTweet(article);
    
    // Check if content was generated
    if (!content) {
      console.log('❌ Failed to generate content (article may not be crypto-relevant)');
      return;
    }
    
    console.log('\n🐦 GENERATED CONTENT:');
    console.log(content);
    console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
    
    // Post directly to Mastodon using our own implementation
    console.log('\n🚀 Posting to Mastodon directly...');
    
    try {
      // Initialize Mastodon client directly
      const mastodon = new Mastodon({
        access_token: process.env.MASTODON_ACCESS_TOKEN,
        api_url: process.env.MASTODON_API_URL,
        timeout_ms: 60 * 1000 // 60 seconds timeout
      });
      
      console.log('✅ Mastodon client initialized');
      console.log(`🌐 Using API URL: ${process.env.MASTODON_API_URL}`);
      
      // Post to Mastodon
      const postResult = await mastodon.post('statuses', {
        status: content,
        visibility: 'public'
      });
      
      console.log('✅ Post request successful');
      console.log(`🔗 Post URL: ${postResult.data.url}`);
      
      // Mark article as processed
      await botFunctions.markArticleAsProcessed(article);
      console.log('✅ Article marked as processed in database');
      
    } catch (error) {
      console.error('❌ Error posting to Mastodon:');
      if (error.response) {
        console.error(`Status code: ${error.response.status}`);
        console.error('Response data:', error.response.data);
      } else {
        console.error(error);
      }
      
      // Fallback to saving to file
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const fileName = `./generated_content_${timestamp}.txt`;
      console.log(`💾 Saving content to file: ${fileName}`);
      require('fs').writeFileSync(fileName, content);
    }
    
    console.log('\n=====================================');
    console.log('✅ Single tweet process completed');
    
  } catch (error) {
    console.error('❌ Error in postSingleTweet:', error);
  }
}

// Run the function
postSingleTweet(); 