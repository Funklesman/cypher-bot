/**
 * Simple wrapper script to run the bot's functions with MASTODON_POST_ENABLED set
 */

// Enable Mastodon posting
process.env.MASTODON_POST_ENABLED = 'true';

// Import the bot functions
const botFunctions = require('./bot');

// Simple async wrapper
async function run() {
  try {
    // Use the postSingleItem function from bot.js
    await botFunctions.postSingleItem();
  } catch (error) {
    console.error('Error running bot:', error);
  }
}

// Run the function
run(); 