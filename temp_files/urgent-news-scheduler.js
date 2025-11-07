/**
 * Urgent News Scheduler
 * 
 * Sets up a cron job to run the urgent news detection every 30 minutes.
 * This script should be kept running as a background process.
 */

const cron = require('node-cron');
const { scanForUrgentNews } = require('./scanForUrgentNews');
require('dotenv').config();

// Log startup information
console.log('🚀 Starting Urgent News Scheduler');
console.log('⏰ Will scan for urgent news every 30 minutes');
console.log(`📅 Started at: ${new Date().toISOString()}`);

// Set environment defaults if not provided
if (!process.env.URGENCY_THRESHOLD) {
  console.log('ℹ️ URGENCY_THRESHOLD not set in .env, using default value of 7');
}

if (!process.env.SCAN_HOURS) {
  console.log('ℹ️ SCAN_HOURS not set in .env, using default value of 4');
}

if (process.env.MASTODON_POST_ENABLED !== 'true') {
  console.log('⚠️ MASTODON_POST_ENABLED is not set to true in .env');
  console.log('⚠️ Urgent news will be detected but NOT posted to Mastodon');
}

// Track statistics
let totalScans = 0;
let urgentArticlesFound = 0;
let postsPublished = 0;
let lastScanTime = null;

// Function to log stats
function logStats() {
  console.log('\n--- Urgent News Scheduler Statistics ---');
  console.log(`🔢 Total scans: ${totalScans}`);
  console.log(`🚨 Urgent articles found: ${urgentArticlesFound}`);
  console.log(`📤 Posts published: ${postsPublished}`);
  if (lastScanTime) {
    console.log(`⏱️ Last scan: ${lastScanTime.toISOString()}`);
  }
  console.log('-----------------------------------------\n');
}

// Schedule the job to run every 30 minutes
// Cron format: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) day of week(0-6)
cron.schedule('0 */30 * * * *', async () => {
  try {
    console.log(`\n🕒 Running scheduled urgent news scan at ${new Date().toISOString()}`);
    
    // Track scan time
    lastScanTime = new Date();
    totalScans++;
    
    // Run the scan with a wrapper to track metrics
    const beforeArticles = urgentArticlesFound;
    const beforePosts = postsPublished;
    
    // Add a listener to count urgent articles
    const originalConsoleLog = console.log;
    console.log = function() {
      // Check for urgent news detected message
      if (arguments[0] && typeof arguments[0] === 'string' && 
          arguments[0].includes('URGENT NEWS DETECTED')) {
        urgentArticlesFound++;
      }
      
      // Check for posts published
      if (arguments[0] && typeof arguments[0] === 'string' && 
          arguments[0].includes('Posted urgent news to Mastodon:')) {
        postsPublished++;
      }
      
      // Call original console.log
      originalConsoleLog.apply(console, arguments);
    };
    
    // Run the scan
    await scanForUrgentNews();
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Log scan completion
    console.log(`✅ Scheduled scan completed at ${new Date().toISOString()}`);
    
    // Log new findings
    const newUrgent = urgentArticlesFound - beforeArticles;
    const newPosts = postsPublished - beforePosts;
    
    if (newUrgent > 0) {
      console.log(`🚨 Found ${newUrgent} new urgent article(s) in this scan`);
      if (newPosts > 0) {
        console.log(`📤 Posted ${newPosts} new urgent message(s) to Mastodon`);
      }
    } else {
      console.log('📉 No urgent news found in this scan');
    }
    
    // Log periodic stats every 12 scans (6 hours)
    if (totalScans % 12 === 0) {
      logStats();
    }
  } catch (error) {
    console.error('❌ Error in scheduled urgent news scan:', error);
  }
});

// Also run immediately on startup
console.log('🔍 Running initial urgent news scan...');
scanForUrgentNews()
  .then(() => {
    console.log('✅ Initial scan completed');
    lastScanTime = new Date();
    totalScans++;
  })
  .catch(error => {
    console.error('❌ Error in initial urgent news scan:', error);
  });

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Received SIGINT (Ctrl+C). Shutting down urgently...');
  logStats();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Received SIGTERM. Shutting down gracefully...');
  logStats();
  process.exit(0);
});

// Keep the process running
console.log('⏳ Urgent news scheduler running...');
console.log('📋 Press Ctrl+C to stop'); 