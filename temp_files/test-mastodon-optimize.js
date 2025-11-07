/**
 * Test Mastodon Post Optimization
 * 
 * This script fetches your most recent Mastodon post and tests content optimization
 * using OpenAI to create a shorter version for Bluesky without actually posting.
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const { optimizeContent } = require('../src/js/crosspost/content-optimizer');
const fs = require('fs').promises;
const path = require('path');

// Initialize Mastodon client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: `https://${process.env.MASTODON_INSTANCE}/api/v1/`
});

/**
 * Fetch the most recent post from your Mastodon account
 */
async function fetchLatestMastodonPost() {
  console.log('Fetching your latest Mastodon post...');
  
  try {
    // Fetch account ID first
    const accountResponse = await mastodon.get('accounts/verify_credentials');
    const accountId = accountResponse.data.id;
    
    // Fetch latest status from this account
    const statusesResponse = await mastodon.get(`accounts/${accountId}/statuses`, {
      limit: 1,
      exclude_replies: true,
      exclude_reblogs: true
    });
    
    if (!statusesResponse.data || statusesResponse.data.length === 0) {
      throw new Error('No Mastodon posts found');
    }
    
    return statusesResponse.data[0];
  } catch (error) {
    console.error('Error fetching Mastodon post:', error);
    throw error;
  }
}

async function run() {
  try {
    console.log('🔬 Testing Mastodon Post Optimization');
    console.log('----------------------------------');
    
    // Fetch the latest post
    const latestPost = await fetchLatestMastodonPost();
    console.log(`\nFetched post from ${new Date(latestPost.created_at).toLocaleString()}`);
    
    // Clean HTML content
    const cleanContent = latestPost.content.replace(/<[^>]*>/g, '');
    
    console.log('\nOriginal Content:');
    console.log('---------------');
    console.log(cleanContent);
    console.log(`\nLength: ${cleanContent.length} characters`);
    
    // Test optimization for Bluesky
    console.log('\nOptimizing for Bluesky (280 characters)...');
    const blueskyContent = await optimizeContent(cleanContent, {
      maxLength: 280,
      platform: 'Bluesky'
    });
    
    console.log('\nBluesky Optimized Content:');
    console.log('------------------------');
    console.log(blueskyContent);
    console.log(`\nLength: ${blueskyContent.length} characters`);
    
    // Save results to a log file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logDir = path.join(__dirname, '../logs');
    
    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    const logFile = path.join(logDir, `mastodon-optimization-${timestamp}.log`);
    const logContent = `
MASTODON POST OPTIMIZATION TEST (${new Date().toLocaleString()})
=======================================================

ORIGINAL CONTENT (${cleanContent.length} characters):
---------------------------------------------------
${cleanContent}

BLUESKY OPTIMIZED CONTENT (${blueskyContent.length} characters):
------------------------------------------------------------
${blueskyContent}

`;
    
    await fs.writeFile(logFile, logContent, 'utf8');
    console.log(`\n✅ Results saved to ${logFile}`);
    
  } catch (error) {
    console.error('Error testing Mastodon post optimization:', error);
  }
}

run(); 