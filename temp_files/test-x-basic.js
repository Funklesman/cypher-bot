/**
 * Basic X Posting Test
 * 
 * This script tests posting to X with simple content about Cypher University.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');

async function run() {
  try {
    // Create a natural sounding test message
    const testMessage = "Cypher University will soon launch something new. Stay tuned for our upcoming crypto education initiatives.";
    
    console.log("Posting to X: ", testMessage);
    console.log("Waiting 5 seconds before posting...");
    
    // Simple wait
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Post to X
    await postToX(testMessage);
    
    console.log("✅ Successfully posted to X!");
  } catch (error) {
    console.error("❌ Error posting to X:", error);
  }
}

run(); 