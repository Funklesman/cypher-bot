/**
 * Hashtag Format Test Script
 * 
 * This script tests different approaches to formatting hashtags for X.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');

/**
 * Main function
 */
async function run() {
  try {
    // Get test approach from command line or default to 1
    const approach = parseInt(process.argv[2]) || 1;
    
    // Create different test approaches for hashtag formatting
    let testContent = '';
    
    switch (approach) {
      case 1:
        // Approach 1: Simple inline text with hashtags (control)
        testContent = `Testing hashtags #Test1 #Test2 - posted at ${new Date().toLocaleTimeString()}`;
        break;
      
      case 2:
        // Approach 2: Hashtags on the same line with no special formatting
        testContent = `Asia Web3 Update - Testing hashtags - posted at ${new Date().toLocaleTimeString()} #AsiaWeb3Alliance #JapanCrypto`;
        break;
      
      case 3:
        // Approach 3: Hashtags with a single line break before them
        testContent = `Asia Web3 Update - Testing hashtags - posted at ${new Date().toLocaleTimeString()}
#AsiaWeb3Alliance #JapanCrypto`;
        break;
      
      case 4:
        // Approach 4: Hashtags with double line break before them (our current approach)
        testContent = `Asia Web3 Update - Testing hashtags - posted at ${new Date().toLocaleTimeString()}

#AsiaWeb3Alliance #JapanCrypto`;
        break;
      
      case 5:
        // Approach 5: Hashtags kept in their original position within text
        testContent = `Testing hashtags with #AsiaWeb3Alliance #JapanCrypto intact in the text - posted at ${new Date().toLocaleTimeString()}`;
        break;
        
      case 6:
        // Approach 6: Hashtags at the beginning
        testContent = `#AsiaWeb3Alliance #JapanCrypto Testing hashtags at beginning - posted at ${new Date().toLocaleTimeString()}`;
        break;
        
      case 7:
        // Approach 7: One hashtag integrated, one at end
        testContent = `Testing with integrated #AsiaWeb3Alliance hashtag - posted at ${new Date().toLocaleTimeString()} #JapanCrypto`;
        break;
        
      default:
        testContent = `Default test with hashtags #Test1 #Test2 - posted at ${new Date().toLocaleTimeString()}`;
    }
    
    console.log(`\n🧪 Testing Approach ${approach}:`);
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
      console.log(`Test approach ${approach} worked. Use this formatting approach.`);
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