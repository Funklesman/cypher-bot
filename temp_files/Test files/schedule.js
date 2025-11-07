const cron = require('node-cron');
const { runBot, postSingleItem, DEFAULT_MAX_AGE_DAYS } = require('./bot');

// Configuration
const SCHEDULE_MODE = process.env.SCHEDULE_MODE || 'hourly'; // Options: 'hourly', 'daily', 'custom'
const CUSTOM_SCHEDULE = process.env.CUSTOM_SCHEDULE || '0 */3 * * *'; // Default: every 3 hours
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
    schedule = '0 */3 * * *'; // Every 3 hours
    console.log('📅 Scheduling posts to run every 3 hours (default)');
}

// Logging status
console.log(`🤖 Bot running in ${POST_STYLE.toUpperCase()} mode`);
console.log(`🔍 Will only post crypto-relevant articles from the last ${MAX_AGE_DAYS} day(s)`);
console.log(`\n⏰ Schedule started at ${new Date().toLocaleString()}`);
console.log('✅ Bot is now running... Press Ctrl+C to stop\n');

// Function to run on schedule
async function scheduledTask() {
  console.log(`\n🚀 Running scheduled task at ${new Date().toLocaleString()}`);
  try {
    if (POST_STYLE === 'single') {
      await postSingleItem(MAX_AGE_DAYS);
    } else {
      await runBot(MAX_AGE_DAYS);
    }
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