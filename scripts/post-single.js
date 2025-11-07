/**
 * Post Single Tweet
 * 
 * This script runs a one-time post of a single tweet.
 * It's helpful for testing or manual posting.
 */

require('dotenv').config();

// Set posting to enabled
process.env.MASTODON_POST_ENABLED = 'true';

// Import our main bot module
const bot = require('../src/js/index');

// Simple async wrapper
async function run() {
  try {
    console.log('🚀 Running Single Post...');
    
    // Post a single tweet
    await bot.postSingleItem();
    
    console.log('✅ Post complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error posting tweet:', error);
    process.exit(1);
  }
}

// Run the function
run(); 