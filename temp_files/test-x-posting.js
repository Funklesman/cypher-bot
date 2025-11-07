/**
 * Test X Posting Script
 * 
 * This script tests posting to X using the browser automation functionality.
 */

require('dotenv').config();
const { postToX, testXCredentials } = require('../src/js/crosspost/x-poster');

// Test post content
const testContent = `CypherUni is working on something new...`;

// Simple async wrapper
async function run() {
  try {
    console.log('🔍 Testing X credentials...');
    const credentialsValid = await testXCredentials();
    
    if (!credentialsValid) {
      console.error('❌ X credentials are invalid! Please check your .env file.');
      process.exit(1);
    }
    
    console.log('🚀 Testing posting to X...');
    console.log(`Content: "${testContent}"`);
    
    const result = await postToX(testContent);
    
    if (result.success) {
      console.log('✅ Test post to X successful!');
    } else {
      console.error('❌ Test post to X failed:', result.error);
    }
    
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the function
run(); 