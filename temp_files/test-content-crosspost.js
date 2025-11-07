/**
 * Test Content Optimization in Cross-Posting Flow
 * 
 * This script fetches your most recent Mastodon post, optimizes it for
 * different platforms, and shows how it would be posted without actually posting.
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs').promises;
const path = require('path');
const { formatContentForPlatforms } = require('../src/js/crosspost/index');

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
    console.log('🔬 Testing Cross-Posting Content Optimization');
    console.log('------------------------------------------');
    
    // Fetch the latest post
    const latestPost = await fetchLatestMastodonPost();
    console.log(`\nFetched post from ${new Date(latestPost.created_at).toLocaleString()}`);
    
    // Clean HTML content
    const cleanContent = latestPost.content.replace(/<[^>]*>/g, '');
    
    console.log('\nOriginal Mastodon Content:');
    console.log('------------------------');
    console.log(cleanContent);
    console.log(`\nLength: ${cleanContent.length} characters`);
    
    // Test the cross-posting formatContentForPlatforms function
    console.log('\nFormatting content for different platforms...');
    const formattedContent = await formatContentForPlatforms(cleanContent);
    
    console.log('\n📱 How Content Will Appear on Each Platform:');
    console.log('---------------------------------------');
    
    console.log('\n📌 X (Twitter):');
    console.log('-------------');
    console.log(formattedContent.x);
    console.log(`Length: ${formattedContent.x.length} characters`);
    
    console.log('\n📌 Bluesky:');
    console.log('---------');
    console.log(formattedContent.bluesky);
    console.log(`Length: ${formattedContent.bluesky.length} characters`);
    
    // Save results to a log file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logDir = path.join(__dirname, '../logs');
    
    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    const logFile = path.join(logDir, `content-crosspost-test-${timestamp}.log`);
    const logContent = `
CONTENT OPTIMIZATION FOR CROSS-POSTING TEST (${new Date().toLocaleString()})
============================================================

ORIGINAL MASTODON CONTENT (${cleanContent.length} characters):
---------------------------------------------------------
${cleanContent}

X (TWITTER) FORMATTED CONTENT (${formattedContent.x.length} characters):
------------------------------------------------------------
${formattedContent.x}

BLUESKY OPTIMIZED CONTENT (${formattedContent.bluesky.length} characters):
------------------------------------------------------------
${formattedContent.bluesky}

`;
    
    await fs.writeFile(logFile, logContent, 'utf8');
    console.log(`\n✅ Results saved to ${logFile}`);
    
    console.log('\n✅ Cross-Posting Content Optimization Test Complete');
    console.log('This test showed how your content would be formatted for each platform without actually posting.');
    
  } catch (error) {
    console.error('Error testing cross-posting content optimization:', error);
  }
}

run(); 