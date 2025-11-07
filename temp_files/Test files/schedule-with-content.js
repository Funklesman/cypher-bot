/**
 * Enhanced Scheduler with Content Storage
 * 
 * This is a modified version of schedule.js that uses the enhanced bot
 * with content storage functionality.
 */

const cron = require('node-cron');
const { 
    runBotWithContentStorage, 
    DEFAULT_MAX_AGE_DAYS 
} = require('./bot-with-content-storage');

// Configuration
const SCHEDULE_MODE = process.env.SCHEDULE_MODE || 'custom'; // Options: 'hourly', 'daily', 'custom'
const CUSTOM_SCHEDULE = process.env.CUSTOM_SCHEDULE || '0 */6 * * *'; // Default: every 6 hours
const POST_STYLE = process.env.POST_STYLE || 'single'; // Options: 'single', 'batch'
const MAX_AGE_DAYS = process.env.MAX_AGE_DAYS ? parseInt(process.env.MAX_AGE_DAYS) : DEFAULT_MAX_AGE_DAYS;

// Set up schedule based on configuration
let schedule;
switch (SCHEDULE_MODE) {
  case 'hourly':
    schedule = '0 * * * *'; // Run at the start of every hour
    console.log('📅 Scheduling posts to run HOURLY');
    break;
  case 'daily':
    schedule = '0 9,15,21 * * *'; // Run at 9am, 3pm, and 9pm
    console.log('📅 Scheduling posts to run DAILY at 9am, 3pm, and 9pm');
    break;
  case 'custom':
    schedule = CUSTOM_SCHEDULE;
    console.log(`📅 Scheduling posts with CUSTOM schedule: ${CUSTOM_SCHEDULE}`);
    break;
  default:
    schedule = '0 */6 * * *'; // Every 6 hours
    console.log('📅 Scheduling posts to run every 6 hours (default)');
}

// Logging status
console.log(`🤖 Enhanced Bot running in ${POST_STYLE.toUpperCase()} mode with content storage`);
console.log(`🔍 Will only post crypto-relevant articles from the last ${MAX_AGE_DAYS} day(s)`);
console.log(`\n⏰ Schedule started at ${new Date().toLocaleString()}`);
console.log('✅ Bot is now running... Press Ctrl+C to stop\n');

// Function to run on schedule
async function scheduledTask() {
  console.log(`\n🚀 Running scheduled task at ${new Date().toLocaleString()}`);
  try {
    // Always use runBotWithContentStorage which now supports both single and batch modes
    await runBotWithContentStorage(MAX_AGE_DAYS);
    console.log(`✅ Scheduled task completed at ${new Date().toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error in scheduled task:', error);
  }
}

// Schedule the task
cron.schedule(schedule, scheduledTask);

// Also run immediately on startup if enabled
if (process.env.RUN_ON_START === 'true') {
  console.log('🚀 Running initial task on startup...');
  scheduledTask();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Bot scheduler shutting down...');
  process.exit(0);
}); 