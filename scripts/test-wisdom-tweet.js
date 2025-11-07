#!/usr/bin/env node

/**
 * Test script to generate a single wisdom tweet
 * Usage: node scripts/test-wisdom-tweet.js
 */

require('dotenv').config();
const { postWisdomTweet } = require('../src/js/index');

async function testWisdomTweet() {
    console.log('🎓 Testing Wisdom Tweet Generation...\n');
    
    try {
        // Enable posting for this test
        process.env.MASTODON_POST_ENABLED = 'true';
        
        const result = await postWisdomTweet();
        
        if (result) {
            console.log('\n✅ Wisdom tweet posted successfully!');
            console.log(`🔗 View at: ${result.data.url || `https://social.kodex.academy/@funkle/${result.data.id}`}`);
        } else {
            console.log('\n⚠️ Wisdom tweet generation completed but not posted (check logs above)');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error testing wisdom tweet:', error);
        process.exit(1);
    }
}

testWisdomTweet();

