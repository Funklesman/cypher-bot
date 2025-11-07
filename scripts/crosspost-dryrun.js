/**
 * Cross-Posting Dry Run Test Script
 * 
 * This script tests the cross-posting process with the latest Mastodon post
 * but without actually posting to any platforms (dry run mode).
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs').promises;
const path = require('path');
const { formatContentForPlatforms } = require('../src/js/crosspost/index');
const { breakContentIntoThreadParts } = require('../src/js/crosspost/bluesky');

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
    console.log('🔬 CROSS-POSTING DRY RUN');
    console.log('------------------------');
    console.log('This is a dry run - no actual posts will be made to X or Bluesky');
    console.log('------------------------');
    
    // Fetch the latest post
    const latestPost = await fetchLatestMastodonPost();
    console.log(`\nFetched post from ${new Date(latestPost.created_at).toLocaleString()}`);
    
    // Clean HTML content
    const cleanContent = latestPost.content.replace(/<[^>]*>/g, '');
    
    console.log('\nOriginal Mastodon Content:');
    console.log('------------------------');
    console.log(cleanContent);
    console.log(`\nLength: ${cleanContent.length} characters`);
    
    // Format content for different platforms
    console.log('\nPreparing content for cross-posting...');
    const formattedContent = await formatContentForPlatforms(cleanContent);
    
    console.log('\n📱 How Content Would Be Posted to Each Platform:');
    console.log('-------------------------------------------');
    
    // X preview
    console.log('\n📌 X (Twitter):');
    console.log('-------------');
    console.log(formattedContent.x);
    console.log(`Length: ${formattedContent.x.length} characters`);
    
    // Bluesky preview
    console.log('\n📌 Bluesky:');
    console.log('---------');
    console.log(formattedContent.bluesky);
    console.log(`Length: ${formattedContent.bluesky.length} characters`);
    
    // Add this code after displaying the content for each platform
    console.log("\n👥 Bluesky Thread Preview:");
    console.log("---------");
    const threadParts = breakContentIntoThreadParts(formattedContent.bluesky);
    console.log(`This content will be posted as a ${threadParts.length}-part thread on Bluesky:`);
    threadParts.forEach((part, index) => {
      console.log(`\nThread part ${index + 1}/${threadParts.length}:`);
      console.log("-".repeat(40));
      console.log(part);
      console.log("-".repeat(40));
      console.log(`Length: ${part.length} characters`);
    });
    
    console.log('\n✅ Cross-Posting Dry Run Complete');
    console.log('To actually cross-post this content, run: npm run crosspost:latest');
    
  } catch (error) {
    console.error('Error in cross-posting dry run:', error);
    process.exit(1);
  }
}

run(); 