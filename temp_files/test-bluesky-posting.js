/**
 * Test Bluesky Posting Script
 * 
 * This script tests posting to Bluesky using the API client functionality.
 */

require('dotenv').config();
const { postToBluesky, testBlueskyCredentials } = require('../src/js/crosspost/bluesky');

// Test post content
const testContent = `CypherUni is working on something new...`;

// Simple async wrapper
async function run() {
  try {
    console.log('🔍 Testing Bluesky credentials...');
    const credentialsResult = await testBlueskyCredentials();
    
    if (!credentialsResult.success) {
      console.error(`❌ Bluesky credentials test failed: ${credentialsResult.error}`);
      process.exit(1);
    }
    
    console.log(`✅ Bluesky credentials valid for user: ${credentialsResult.handle}`);
    
    // Post test content
    console.log(`\nPosting test content to Bluesky: "${testContent}"`);
    const postResult = await postToBluesky(testContent);
    
    if (postResult.success) {
      console.log('✅ Successfully posted to Bluesky!');
      console.log(`Post URI: ${postResult.postUri}`);
      process.exit(0);
    } else {
      console.error(`❌ Failed to post to Bluesky: ${postResult.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

// Run the test
run(); 