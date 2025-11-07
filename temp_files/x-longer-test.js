/**
 * X Longer Content Test
 * 
 * This script tests posting a longer message (600 chars) to X
 * with line breaks but no special characters.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');

async function run() {
  try {
    // Create a longer test message with line breaks but no special characters
    const timestamp = new Date().toLocaleTimeString();
    const testMessage = 
`Cypher University Research: Digital Asset Evolution in 2024.

Our latest analysis shows institutional adoption becoming a primary driver of cryptocurrency market development.

Key observations from our research team:
1. Traditional financial institutions are increasingly building crypto infrastructure
2. Regulatory clarity is emerging in major markets, particularly in the EU and parts of Asia
3. Enterprise blockchain adoption has accelerated, with focus on supply chain and settlement use cases

We expect these trends to continue through 2024 as market fundamentals strengthen and technological innovation progresses.

#Crypto #DigitalAssets #Research

Posted at: ${timestamp}`;
    
    console.log('📌 LONGER TEXT FOR X:');
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