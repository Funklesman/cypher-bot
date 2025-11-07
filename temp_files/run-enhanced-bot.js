/**
 * Run Enhanced Bot - uses the enhanced version of the bot that populates all MongoDB collections
 */

// Enable Mastodon posting if needed (comment out to disable)
process.env.MASTODON_POST_ENABLED = 'true';

// Import enhanced bot functions
const enhancedBot = require('./enhanced-bot');

// Simple async wrapper
async function run() {
  try {
    console.log('🚀 Starting Enhanced Crypto News Bot...');
    console.log('This version will populate all MongoDB collections:');
    console.log('- processedArticles (original collection)');
    console.log('- contentTest (stores article content)');
    console.log('- post_history (stores post history)');
    console.log('- urgentNews (stores potentially urgent news items)');
    console.log('\n=========================================\n');
    
    // Use the enhanced single post function
    await enhancedBot.postSingleItemEnhanced();
    
    console.log('\n=========================================');
    console.log('✅ Enhanced bot run complete!');
    console.log('Check your MongoDB collections to see the new data.');
  } catch (error) {
    console.error('❌ Error running enhanced bot:', error);
  }
}

// Run the enhanced bot
run(); 