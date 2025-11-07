/**
 * TweetBot Production Script
 * 
 * This script combines all features of the TweetBot:
 * 1. Regular scheduled tweets (every 6 hours)
 * 2. Urgent news detection (every 30 minutes)
 * 
 * Run this script with PM2 for production use.
 */

require('dotenv').config();
const cron = require('node-cron');
const { runBot } = require('./bot-with-content-storage');
const { scanForUrgentNews } = require('./scanForUrgentNews');

// Track statistics
let regularTweetsPosted = 0;
let urgentNewsScans = 0;
let urgentTweetsPosted = 0;
let startTime = new Date();

// Log startup information
console.log('🚀 Starting TweetBot in Production Mode');
console.log('📅 Started at:', startTime.toISOString());
console.log('⏰ Regular tweets will be posted every 6 hours');
console.log('🔍 Urgent news will be scanned every 30 minutes');

// Check environment
if (process.env.MASTODON_POST_ENABLED !== 'true') {
  console.log('⚠️ MASTODON_POST_ENABLED is not set to true in .env');
  console.log('⚠️ Regular tweets will NOT be posted to Mastodon');
}

if (process.env.URGENT_POST_ENABLED !== 'true') {
  console.log('⚠️ URGENT_POST_ENABLED is not set to true in .env');
  console.log('⚠️ Urgent news will be detected but NOT posted to Mastodon');
}

// Function to log stats
function logStats() {
  const uptime = Math.floor((new Date() - startTime) / (1000 * 60 * 60)); // hours
  console.log('\n--- TweetBot Status Report ---');
  console.log(`⏱️ Uptime: ${uptime} hours`);
  console.log(`📊 Regular tweets posted: ${regularTweetsPosted}`);
  console.log(`🔍 Urgent news scans: ${urgentNewsScans}`);
  console.log(`🚨 Urgent tweets posted: ${urgentTweetsPosted}`);
  console.log('-------------------------------\n');
}

// Schedule regular tweets every 6 hours (at 00:00, 06:00, 12:00, 18:00)
// Cron format: second(0-59) minute(0-59) hour(0-23) day(1-31) month(1-12) day of week(0-6)
cron.schedule('0 0 */6 * * *', async () => {
  try {
    console.log(`\n🕒 Running scheduled regular tweet at ${new Date().toISOString()}`);
    
    // Track posts before running
    const beforeRegularTweets = regularTweetsPosted;
    
    // Monitor console.log to count tweets
    const originalConsoleLog = console.log;
    console.log = function() {
      // Check for posts published
      if (arguments[0] && typeof arguments[0] === 'string' && 
          arguments[0].includes('Posted to Mastodon:')) {
        regularTweetsPosted++;
      }
      
      // Call original console.log
      originalConsoleLog.apply(console, arguments);
    };
    
    // Run the bot with a 1-day lookback
    await runBot(1);
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Log completion
    console.log(`✅ Regular tweet posting completed at ${new Date().toISOString()}`);
    
    // Check if new tweets were posted
    const newTweets = regularTweetsPosted - beforeRegularTweets;
    if (newTweets > 0) {
      console.log(`📤 Posted ${newTweets} new regular tweet(s) to Mastodon`);
    } else {
      console.log('ℹ️ No new regular tweets were posted');
    }
  } catch (error) {
    console.error('❌ Error in regular tweet schedule:', error);
  }
});

// Schedule urgent news scans every 30 minutes
cron.schedule('0 */30 * * * *', async () => {
  try {
    console.log(`\n🕒 Running urgent news scan at ${new Date().toISOString()}`);
    
    // Track stats
    urgentNewsScans++;
    const beforeUrgentTweets = urgentTweetsPosted;
    
    // Set environment variable for posting
    if (process.env.URGENT_POST_ENABLED === 'true') {
      process.env.MASTODON_POST_ENABLED = 'true';
    } else {
      process.env.MASTODON_POST_ENABLED = 'false';
    }
    
    // Monitor console.log to count tweets
    const originalConsoleLog = console.log;
    console.log = function() {
      // Check for posts published
      if (arguments[0] && typeof arguments[0] === 'string' && 
          arguments[0].includes('Posted urgent news to Mastodon:')) {
        urgentTweetsPosted++;
      }
      
      // Call original console.log
      originalConsoleLog.apply(console, arguments);
    };
    
    // Run the urgent news scan
    await scanForUrgentNews();
    
    // Restore console.log
    console.log = originalConsoleLog;
    
    // Log completion
    console.log(`✅ Urgent news scan completed at ${new Date().toISOString()}`);
    
    // Check if new urgent tweets were posted
    const newUrgentTweets = urgentTweetsPosted - beforeUrgentTweets;
    if (newUrgentTweets > 0) {
      console.log(`🚨 Posted ${newUrgentTweets} new urgent tweet(s) to Mastodon`);
    }
    
    // Log periodic stats every 24 scans (12 hours)
    if (urgentNewsScans % 24 === 0) {
      logStats();
    }
  } catch (error) {
    console.error('❌ Error in urgent news scan:', error);
  }
});

// Run initial scans at startup
console.log('🔍 Running initial urgent news scan...');
scanForUrgentNews()
  .then(() => {
    console.log('✅ Initial urgent news scan completed');
    urgentNewsScans++;
    
    // Run regular tweet after 1 minute to avoid overloading the API
    setTimeout(() => {
      console.log('🔍 Running initial regular tweet post...');
      runBot(1)
        .then(() => {
          console.log('✅ Initial regular tweet posting completed');
        })
        .catch(error => {
          console.error('❌ Error in initial regular tweet posting:', error);
        });
    }, 60000);
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
console.log('⏳ TweetBot production script running...');
console.log('📋 Press Ctrl+C to stop'); 