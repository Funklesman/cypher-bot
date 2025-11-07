/**
 * Test Mastodon Server Connection
 * 
 * This script tests the connection to your Mastodon server
 * and verifies that we can post longer content.
 */

const Mastodon = require('mastodon-api');
require('dotenv').config();

// Check for required environment variables
const requiredVars = [
  'MASTODON_ACCESS_TOKEN',
  'MASTODON_API_URL'
];

const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

async function testConnection() {
  try {
    console.log('🔍 Testing connection to Mastodon server...');
    console.log(`🌐 API URL: ${process.env.MASTODON_API_URL}`);
    
    // Initialize Mastodon client
    const mastodon = new Mastodon({
      access_token: process.env.MASTODON_ACCESS_TOKEN,
      api_url: process.env.MASTODON_API_URL
    });
    
    // Test connection by getting the current user's account
    console.log('👤 Verifying credentials...');
    const account = await mastodon.get('accounts/verify_credentials');
    
    console.log(`✅ Successfully connected as: @${account.data.username}`);
    console.log(`👤 Display name: ${account.data.display_name}`);
    console.log(`🆔 Account ID: ${account.data.id}`);
    
    // Test posting a longer status if requested
    if (process.argv.includes('--post-test')) {
      console.log('\n📝 Testing longer post capability...');
      
      // Create a test post with 1000+ characters
      const longPost = `
📊 SYSTEM TEST: This is a test of the Crypto News Bot running on our custom Mastodon server.

This post contains more than 1000 characters to verify that we can successfully post longer content without hitting character limits that exist on public Mastodon instances. This is particularly important for our Daily Crypto Diary feature, which will provide comprehensive summaries of market activity.

${'-'.repeat(50)}

The Crypto News Bot analyzes sentiment in crypto markets and posts timely updates with raw, personal commentary in the voice of the "Crypto Professor" from Cypher University.

Our bot features:
• Sentiment analysis of crypto news (positive, negative, neutral)
• Dynamic hashtag generation for maximum relevance  
• Varied prompts based on content sentiment
• Personal, cyberpunk-inspired tone
• MongoDB tracking of processed articles

${'-'.repeat(50)}

This test post has been automatically generated to verify system functionality. If you're seeing this, our connection is working correctly!

#TestPost #CryptoNewsBot
`.trim();
      
      console.log(`📏 Test post length: ${longPost.length} characters`);
      
      // Post the status
      const post = await mastodon.post('statuses', {
        status: longPost,
        visibility: 'public'
      });
      
      console.log(`\n✅ Successfully posted long content!`);
      console.log(`🔗 Post URL: ${post.data.url}`);
      console.log(`📊 Character count: ${longPost.length}`);
    }
    
    console.log('\n✅ Mastodon server connection test complete');
    
  } catch (error) {
    console.error('❌ Error connecting to Mastodon:');
    if (error.response) {
      console.error(`Status code: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error);
    }
  }
}

// Run the test
testConnection(); 