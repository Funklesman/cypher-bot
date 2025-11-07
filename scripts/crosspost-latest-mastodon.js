/**
 * Cross-Post Latest Mastodon Post Script
 * 
 * This script fetches your most recent Mastodon post and cross-posts it to X and Bluesky.
 * It's designed for one-time use, not continuous operation, to prevent spamming platforms.
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const fs = require('fs').promises;
const path = require('path');
const { processMastodonPost } = require('../src/js/crosspost');
const { formatContentForPlatforms } = require('../src/js/crosspost/index');

// Create a simple tracking file to prevent duplicate cross-posting
const TRACKING_FILE = path.join(__dirname, '../.lastcrosspost');

// Initialize Mastodon client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: `https://${process.env.MASTODON_INSTANCE}/api/v1/`
});

/**
 * Get the last cross-posted status ID
 * @returns {Promise<string|null>} Last cross-posted status ID or null
 */
async function getLastCrossPostedId() {
  try {
    const data = await fs.readFile(TRACKING_FILE, 'utf8');
    return data.trim();
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Save the last cross-posted status ID
 * @param {string} statusId - Mastodon status ID
 */
async function saveLastCrossPostedId(statusId) {
  await fs.writeFile(TRACKING_FILE, statusId, 'utf8');
  console.log(`Saved status ID ${statusId} to tracking file`);
}

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
 * Download media attachments from Mastodon post
 * @param {Array} attachments - Media attachments from Mastodon post
 * @returns {Promise<Array>} Local file paths
 */
async function downloadMediaAttachments(attachments) {
  if (!attachments || attachments.length === 0) {
    return [];
  }
  
  const tempDir = path.join(__dirname, '../temp');
  
  // Create temp directory if it doesn't exist
  try {
    await fs.mkdir(tempDir, { recursive: true });
  } catch (error) {
    console.error('Error creating temp directory:', error);
  }
  
  // Only process image types we know how to handle
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif'];
  const mediaToDownload = attachments.filter(a => 
    supportedTypes.includes(a.type) && a.url
  );
  
  if (mediaToDownload.length === 0) {
    return [];
  }
  
  console.log(`Downloading ${mediaToDownload.length} media attachments...`);
  
  // For now, just return the URLs - in a production system,
  // you would actually download the files
  // This is to avoid implementing a full HTTP client for this example
  console.log('NOTE: For this example, we are not actually downloading media files');
  
  return mediaToDownload.map(media => media.url);
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

    // Clean HTML content and display the full content
    let cleanContent = latestPost.content.replace(/<[^>]*>/g, '');
    
    // Properly decode HTML entities
    cleanContent = cleanContent.replace(/&amp;/g, '&')
                           .replace(/&lt;/g, '<')
                           .replace(/&gt;/g, '>')
                           .replace(/&quot;/g, '"')
                           .replace(/&#39;/g, "'")
                           .replace(/&nbsp;/g, ' ');
    
    console.log(`\nContent: "${cleanContent}"`);
    
    // TEMPORARILY REMOVED: Check for duplicate posts to allow testing
    // const lastCrossPostedId = await getLastCrossPostedId();
    // if (lastCrossPostedId === latestPost.id) {
    //   console.log('⚠️ This post has already been cross-posted. Exiting to prevent duplicates.');
    //   process.exit(0);
    // }
    
    // Show preview of how content will be formatted for each platform
    const formattedPreview = await formatContentForPlatforms(cleanContent);
    console.log('\n📱 Content Preview for Each Platform:');
    console.log('----------------------------------');
    console.log('\n📌 X (Twitter):');
    console.log(formattedPreview.x.substring(0, 200) + (formattedPreview.x.length > 200 ? '...' : ''));
    console.log(`(${formattedPreview.x.length} characters)`);

    console.log('\n📌 Bluesky:');
    console.log(formattedPreview.bluesky);
    console.log(`(${formattedPreview.bluesky.length} characters)`);
    console.log('----------------------------------');

    // Ask for confirmation
    console.log('\n⚠️ Are you sure you want to cross-post this? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Proceeding with cross-posting...');
    
    // Download media if any
    let mediaFiles = [];
    if (latestPost.media_attachments && latestPost.media_attachments.length > 0) {
      mediaFiles = await downloadMediaAttachments(latestPost.media_attachments);
    }
    
    // Create Mastodon post object with required properties
    const mastodonPost = {
      id: latestPost.id,
      content: cleanContent,
      media_attachments: latestPost.media_attachments,
      visibility: latestPost.visibility
    };
    
    // Cross-post
    const result = await processMastodonPost(mastodonPost);
    
    // Display a clear summary
    console.log('\n📊 Cross-Posting Summary:');
    console.log('------------------------');

    // X results
    if (result.x && result.x.success) {
      console.log('X: ✅ Posted successfully');
    } else if (result.x && result.x.possiblyPosted) {
      console.log('X: ⚠️ May have posted (verification issue)');
    } else if (result.x) {
      console.log(`X: ❌ Failed - ${result.x.error || 'Unknown error'}`);
    } else {
      console.log('X: ⚠️ Not attempted');
    }

    // Bluesky results
    if (result.bluesky && result.bluesky.success) {
      console.log('Bluesky: ✅ Posted successfully');
    } else if (result.bluesky) {
      console.log(`Bluesky: ❌ Failed - ${result.bluesky.error || 'Unknown error'}`);
    } else {
      console.log('Bluesky: ⚠️ Not attempted');
    }

    console.log('------------------------');

    // Consider successful if at least one platform succeeded
    if (result.success) {
      console.log('✅ Cross-posting completed with at least one platform succeeding!');
      
      // TEMPORARILY REMOVED: Save the ID to prevent duplicate cross-posting
      // await saveLastCrossPostedId(latestPost.id);
      
      process.exit(0);
    } else {
      console.error('❌ Cross-posting failed on all platforms');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 