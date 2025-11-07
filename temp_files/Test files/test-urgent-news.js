/**
 * Test Urgent News Detection
 * 
 * This script allows you to quickly test the urgent news detection
 * functionality without having to run the scheduler.
 */

require('dotenv').config();
const { scanForUrgentNews } = require('../scanForUrgentNews');

// Set a low urgency threshold to see the emergency prompts in action
process.env.URGENCY_THRESHOLD = process.env.TEST_URGENCY_THRESHOLD || "5";
console.log(`✅ Using test urgency threshold: ${process.env.URGENCY_THRESHOLD}`);

// Use a larger scan window to find more articles
process.env.SCAN_HOURS = process.env.TEST_SCAN_HOURS || "12";
console.log(`✅ Using test scan hours: ${process.env.SCAN_HOURS}`);

// Check if posting is enabled for this test
if (process.argv.includes('--post')) {
  process.env.MASTODON_POST_ENABLED = 'true';
  console.log('🚨 WARNING: Posts will be published to Mastodon!');
} else {
  process.env.MASTODON_POST_ENABLED = 'false';
  console.log('ℹ️ Running in test mode (posts will NOT be published)');
}

// Show configuration
console.log('\n--- Test Configuration ---');
console.log(`🔍 Urgency threshold: ${process.env.URGENCY_THRESHOLD}`);
console.log(`⏰ Scan hours: ${process.env.SCAN_HOURS}`);
console.log(`📤 Post enabled: ${process.env.MASTODON_POST_ENABLED === 'true'}`);
console.log('-------------------------\n');

console.log('🚀 Starting urgent news test scan...');

// Run the scan
scanForUrgentNews()
  .then(() => {
    console.log('\n✅ Urgent news test scan completed');
  })
  .catch(error => {
    console.error('\n❌ Error in urgent news test scan:', error);
  }); 