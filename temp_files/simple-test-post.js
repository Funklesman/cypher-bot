/**
 * Simple X Test Post Script
 * 
 * This script posts minimal content to X for testing purposes.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');

/**
 * Main function
 */
async function run() {
  try {
    // Create a very simple test message
    const testContent = `Testing hashtags #Test1 #Test2 - posted at ${new Date().toLocaleTimeString()}`;
    
    console.log('\n📱 Content to post:');
    console.log('==============================');
    console.log(testContent);
    console.log('==============================');
    console.log(`Character count: ${testContent.length}`);
    
    // Ask for confirmation
    console.log('\n⚠️ Are you sure you want to post this test message to X? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Posting to X...');
    
    // Post to X
    const result = await postToX(testContent);
    
    if (result.success) {
      console.log('\n✅ Successfully posted to X!');
    } else {
      console.error('\n❌ Failed to post to X:', result.error || 'Unknown error');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 