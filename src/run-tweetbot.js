/**
 * TweetBot Runner Script
 * 
 * Uses our updated src/js/index.js code with headline/title improvements
 */

require('dotenv').config();
const tweetBot = require('./js/index.js');
const { scheduleDailyCryptoDiary } = require('./js/crypto_diary');

console.log('🚀 Starting TweetBot with headline/title improvements');
console.log('📝 Posts will now include the original headline followed by a line break');
console.log('📔 Daily Crypto Diary scheduled for 8 PM local time');

// Set environment variables for testing
process.env.MASTODON_POST_ENABLED = 'true';
process.env.URGENT_POST_ENABLED = 'true';

// Start in testing mode (posts every 30 minutes)
tweetBot.startTestingMode();

// Schedule the daily crypto diary
scheduleDailyCryptoDiary();

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT (Ctrl+C). Shutting down...');
  process.exit(0);
});

console.log('⏳ TweetBot running... Press Ctrl+C to stop'); 