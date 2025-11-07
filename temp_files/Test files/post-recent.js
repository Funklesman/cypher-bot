const { postSingleItem, runBot, DEFAULT_MAX_AGE_DAYS } = require('./bot');

// Configuration
const MAX_AGE_DAYS = process.env.MAX_AGE_DAYS ? parseInt(process.env.MAX_AGE_DAYS) : DEFAULT_MAX_AGE_DAYS;
const POST_MODE = process.env.POST_MODE || 'single'; // Options: 'single' or 'all'

async function main() {
  try {
    console.log(`🚀 Running tweet bot with ${MAX_AGE_DAYS} day(s) recency filter in '${POST_MODE}' mode`);
    console.log(`🔍 Only crypto-relevant articles will be processed\n`);
    
    if (POST_MODE === 'single') {
      // Post a single article from recent news
      await postSingleItem(MAX_AGE_DAYS);
    } else if (POST_MODE === 'all') {
      // Post all recent unprocessed articles
      await runBot(MAX_AGE_DAYS);
    } else {
      console.error(`❌ Invalid POST_MODE: ${POST_MODE}. Use 'single' or 'all'.`);
    }
    
    console.log('\n✅ Post-Recent process complete!');
  } catch (error) {
    console.error('❌ Error in post-recent script:', error);
  }
}

// Display usage info
console.log('📌 USAGE:');
console.log('   - Set POST_MODE=single (default) to post a single article');
console.log('   - Set POST_MODE=all to post all recent articles');
console.log('   - Set MAX_AGE_DAYS=n to control recency (default: 1 day)');
console.log('   - Set MASTODON_POST_ENABLED=true in .env to enable actual posting\n');

// Run the script
main().catch(console.error); 