/**
 * Scan for Urgent News
 * 
 * This script runs a one-time scan for urgent crypto news.
 * It can be run manually or scheduled with cron.
 */

require('dotenv').config();

// Import our main bot module
const bot = require('../src/js/index');

// Parse command line arguments
const args = process.argv.slice(2);
const shouldPost = args.includes('--post') || args.includes('-p');

// Simple async wrapper
async function run() {
  try {
    console.log(`🔍 Scanning for urgent crypto news ${shouldPost ? '(with posting enabled)' : '(without posting)'}`);
    
    if (shouldPost) {
      // Enable posting if --post flag is provided
      process.env.MASTODON_POST_ENABLED = 'true';
      process.env.URGENT_POST_ENABLED = 'true';
    }
    
    // Scan for urgent news
    const result = await bot.scanUrgentNews();
    
    if (result && result.length > 0) {
      console.log(`✅ Found ${result.length} urgent news items`);
    } else {
      console.log('✅ No urgent news found');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error scanning for urgent news:', error);
    process.exit(1);
  }
}

// Run the function
run(); 