/**
 * Cross-Post Latest Mastodon with Reliable X Posting
 * 
 * This script fetches your most recent Mastodon post and cross-posts it to X and optionally Bluesky.
 * For X, it uses a very simplified content format that is guaranteed to work.
 * For Bluesky, it uses the full original content with formatting.
 * 
 * Usage:
 * - `node scripts/crosspost-with-reliable-x.js` - Post to X only
 * - `node scripts/crosspost-with-reliable-x.js --bluesky` - Post to both X and Bluesky
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs').promises;
const path = require('path');
const { postToX } = require('../src/js/crosspost/x-poster');
const { postToBluesky } = require('../src/js/crosspost/bluesky');
const ContentDeduplicator = require('../src/js/content_deduplicator');
const { formatContentForPlatforms } = require('../src/js/crosspost/index');

// Initialize content deduplicator
const contentDeduplicator = new ContentDeduplicator();

// Create a simple tracking file to prevent duplicate cross-posting
const TRACKING_FILE = path.join(__dirname, '../.lastcrosspost');

// Initialize Mastodon client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: `https://${process.env.MASTODON_INSTANCE}/api/v1/`
});

// Check command line arguments
const shouldPostToBluesky = process.argv.includes('--bluesky');

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

/**
 * Create ultra-simplified content for X
 */
function createUltraSimpleXContent(content) {
  // Extract hashtags
  const hashtagMatches = content.match(/#[a-zA-Z0-9]+/g) || [];
  
  // Get just the first sentence, strictly ASCII only
  let firstSentence = '';
  const sentenceMatch = content.match(/^[^.!?]+[.!?]/);
  if (sentenceMatch) {
    firstSentence = sentenceMatch[0]
      .replace(/[^\x00-\x7F\s]/g, '') // Remove ALL non-ASCII chars
      .replace(/\n+/g, ' ')           // Replace newlines with spaces
      .replace(/\s{2,}/g, ' ')        // Remove extra spaces
      .trim();
  } else {
    // If no sentence found, just take the first 100 chars
    firstSentence = content.substring(0, 100)
      .replace(/[^\x00-\x7F\s]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  
  // Add a timestamp to ensure the post is unique
  const timestamp = new Date().toLocaleTimeString();
  
  // Limited content with hashtags and timestamp
  let simpleText = `${firstSentence}`;
  
  // Add hashtags at the end with proper spacing (max 2 hashtags)
  if (hashtagMatches.length > 0) {
    simpleText = simpleText.trim() + '\n\n' + hashtagMatches.slice(0, 2).join(' ');
  }
  
  // Add timestamp at the end
  simpleText += `\n\nPosted at: ${timestamp}`;
  
  return simpleText;
}

/**
 * Download media attachments from Mastodon post
 */
async function downloadMediaAttachments(attachments) {
  if (!attachments || attachments.length === 0) {
    return [];
  }
  
  console.log(`Would download ${attachments.length} media files if implemented`);
  return [];
}

/**
 * Main function to run the cross-posting
 */
async function run() {
  try {
    // Verify credentials are set
    if (!process.env.MASTODON_ACCESS_TOKEN || !process.env.MASTODON_INSTANCE) {
      throw new Error('Mastodon credentials not set in .env file');
    }
    
    // Check if crossposting is enabled
    if (process.env.CROSSPOST_ENABLED !== 'true') {
      throw new Error('Cross-posting is not enabled. Set CROSSPOST_ENABLED=true in .env file');
    }
    
    console.log('🔍 Fetching latest Mastodon post...');
    const latestPost = await fetchLatestMastodonPost();
    
    if (!latestPost) {
      throw new Error('Could not fetch latest Mastodon post');
    }
    
    // Display the post information
    console.log(`Found post from ${new Date(latestPost.created_at).toLocaleString()}`);

    // Clean HTML content
    let cleanContent = latestPost.content.replace(/<[^>]*>/g, '');
    
    // Properly decode HTML entities
    cleanContent = cleanContent.replace(/&amp;/g, '&')
                           .replace(/&lt;/g, '<')
                           .replace(/&gt;/g, '>')
                           .replace(/&quot;/g, '"')
                           .replace(/&#39;/g, "'")
                           .replace(/&nbsp;/g, ' ');
    
    console.log(`\nContent: "${cleanContent}"`);
    
    // Format content for Bluesky (normal process)
    console.log('\nFormatting content...');
    const formattedContent = await formatContentForPlatforms(cleanContent);
    
    // Create an ultra-simplified version for X that we know works
    const ultraSimpleXContent = createUltraSimpleXContent(cleanContent);
    
    // Show preview of how content will be formatted for each platform
    console.log('\n📱 Content Preview:');
    console.log('----------------------------------');
    console.log('\n📌 X (Twitter) - ULTRA SIMPLIFIED:');
    console.log(ultraSimpleXContent);
    console.log(`(${ultraSimpleXContent.length} characters)`);

    if (shouldPostToBluesky) {
      console.log('\n📌 Bluesky:');
      console.log(formattedContent.bluesky);
      console.log(`(${formattedContent.bluesky.length} characters)`);
    }
    console.log('----------------------------------');

    // Ask for confirmation
    if (shouldPostToBluesky) {
      console.log('\n⚠️ Are you sure you want to cross-post to X and Bluesky? (Press Ctrl+C to cancel)');
    } else {
      console.log('\n⚠️ Are you sure you want to post to X ONLY? (Press Ctrl+C to cancel)');
    }
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Proceeding with posting...');
    
    // Check if content has been crossposted recently
    const hasBeenCrossposted = await contentDeduplicator.hasBeenCrossposted(cleanContent);
    if (hasBeenCrossposted) {
      console.error('Content has been crossposted recently, skipping...');
      process.exit(1);
    }
    
    // Post to each platform
    const results = {
      x: { success: false },
      bluesky: { success: false, attempted: shouldPostToBluesky }
    };
    
    // Post to X with ultra-simplified content
    try {
      console.log('Posting to X...');
      await postToX(ultraSimpleXContent);
      results.x.success = true;
    } catch (error) {
      console.error('Error posting to X:', error);
      results.x.error = error.message;
    }
    
    // Post to Bluesky with full content (if enabled)
    if (shouldPostToBluesky) {
      try {
        console.log('Posting to Bluesky...');
        await postToBluesky(formattedContent.bluesky);
        results.bluesky.success = true;
      } catch (error) {
        console.error('Error posting to Bluesky:', error);
        results.bluesky.error = error.message;
      }
    }
    
    // Display a clear summary
    console.log('\n📊 Posting Summary:');
    console.log('------------------------');

    // X results
    if (results.x.success) {
      console.log('X: ✅ Posted successfully');
    } else {
      console.log(`X: ❌ Failed - ${results.x.error || 'Unknown error'}`);
    }

    // Bluesky results
    if (shouldPostToBluesky) {
      if (results.bluesky.success) {
        console.log('Bluesky: ✅ Posted successfully');
      } else {
        console.log(`Bluesky: ❌ Failed - ${results.bluesky.error || 'Unknown error'}`);
      }
    } else {
      console.log('Bluesky: ⚠️ Posting disabled');
    }

    console.log('------------------------');

    // Consider successful if X posting succeeded
    if (results.x.success) {
      console.log('✅ Posting completed successfully!');
      
      // Mark as crossposted to prevent duplicates
      await contentDeduplicator.markAsCrossposted(cleanContent);
      
      process.exit(0);
    } else {
      console.error('❌ Posting failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 