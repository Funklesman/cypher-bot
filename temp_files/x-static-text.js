/**
 * X Static Text Test
 * 
 * This script posts a fixed, static text message to X with a timestamp.
 * No fetching from Mastodon, just direct posting of predetermined text.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');

async function run() {
  try {
    // Create a simple test message with timestamp
    const timestamp = new Date().toLocaleTimeString();
    const testMessage = `Cypher University is exploring new ways to share crypto insights across platforms.\n\n#Crypto #Education\n\nPosted at: ${timestamp}`;
    
    console.log('📌 STATIC TEXT FOR X:');
    console.log('==============================');
    console.log(testMessage);
    console.log('==============================');
    console.log(`Character count: ${testMessage.length}`);
    
    console.log('\n⚠️ Are you sure you want to post this to X? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Posting to X...');
    
    // Post to X
    await postToX(testMessage);
    
    console.log('\n✅ Successfully posted to X!');
  } catch (error) {
    console.error('\n❌ Error posting to X:', error);
  }
}

run(); 