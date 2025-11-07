/**
 * Test Crypto Diary Generation
 * 
 * This script tests the generation of the daily crypto diary.
 */

require('dotenv').config();
const { generateCryptoDiary } = require('./js/crypto_diary');

/**
 * Main function to run the crypto diary test
 */
async function testCryptoDiary() {
  try {
    console.log('🧪 Testing Crypto Diary generation...');
    
    // Before running, check if required environment variables are set
    const requiredEnvVars = ['OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.error(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
      console.error('Please set these in your .env file and try again.');
      process.exit(1);
    }
    
    // Generate the crypto diary
    console.log('Generating crypto diary...');
    const content = await generateCryptoDiary();
    
    if (content) {
      console.log('\n✅ Crypto Diary generation test completed successfully!');
      
      // Log content preview
      console.log('\n=== CONTENT PREVIEW ===');
      console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      console.log(`\nTotal length: ${content.length} characters`);
    } else {
      console.error('❌ Crypto Diary generation failed or returned no content');
    }
  } catch (error) {
    console.error('❌ Error in Crypto Diary test:', error);
  } finally {
    process.exit(0);
  }
}

// Run the test
testCryptoDiary(); 