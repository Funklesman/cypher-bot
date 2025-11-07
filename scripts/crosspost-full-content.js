/**
 * Cross-Post Latest Mastodon with Full Content
 * 
 * This script fetches your most recent Mastodon post and cross-posts it to X and Bluesky.
 * Unlike the simplified version, this attempts to preserve the full content for both platforms.
 * For X, it only removes problematic special characters but keeps the full text.
 * 
 * Usage:
 * - `node scripts/crosspost-full-content.js` - Post to X only
 * - `node scripts/crosspost-full-content.js --bluesky` - Post to both X and Bluesky
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
 * Format content for X while preserving line breaks from HTML
 */
function formatFullContentForX(content, htmlContent) {
  // Extract hashtags to ensure they're properly spaced
  const hashtagMatches = content.match(/#[a-zA-Z0-9]+/g) || [];
  
  // First, handle HTML paragraph tags to preserve original structure
  let contentWithLineBreaks = htmlContent
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n');
  
  // Clean HTML content but preserve line breaks
  let cleanContent = contentWithLineBreaks.replace(/<[^>]*>/g, '');
  
  // Properly decode HTML entities
  cleanContent = cleanContent
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Replace problematic characters with safe alternatives
  cleanContent = cleanContent
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII chars including emojis
    .replace(/—/g, '-')           // Replace em dashes with regular dashes
    .replace(/–/g, '-')           // Replace en dashes with regular dashes
    .replace(/…/g, '...')         // Replace ellipsis with three dots
    .replace(/"/g, '"')           // Replace smart quotes with regular quotes
    .replace(/"/g, '"')           // Replace smart quotes with regular quotes
    .replace(/'/g, "'")           // Replace smart apostrophes with regular ones
    .replace(/'/g, "'")           // Replace smart apostrophes with regular ones
    .trim();
  
  // Fix specific spacing issues in the original content
  cleanContent = cleanContent
    // Fix "CloudCME" - add space between Cloud and CME
    .replace(/Cloud([A-Z])/g, 'Cloud $1')
    // Ensure "it's" has proper spacing
    .replace(/talk([a-z])/g, 'talk $1')
    // Make sure sentences have spaces after periods
    .replace(/\.([A-Z])/g, '. $1');
  
  // Split by paragraphs and clean
  const paragraphs = cleanContent
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  // Remove any existing hashtags from the content
  // Create a direct template literal with explicit line breaks
  let formattedContent = '';
  
  // Add each paragraph with explicit line breaks
  for (let i = 0; i < paragraphs.length; i++) {
    // Skip hashtag paragraphs (we'll add them at the end)
    if (paragraphs[i].match(/^#[a-zA-Z0-9]/)) continue;
    
    // Add paragraph
    formattedContent += paragraphs[i];
    
    // Add double line break after each paragraph except the last
    if (i < paragraphs.length - 1) {
      formattedContent += '\n\n';
    }
  }
  
  // Add hashtags at the end with proper spacing
  if (hashtagMatches.length > 0) {
    formattedContent += '\n\n' + hashtagMatches.join(' ');
  }
  
  return formattedContent;
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
    
    // Format content for platforms
    console.log('\nFormatting content...');
    const formattedContent = await formatContentForPlatforms(cleanContent);
    
    // Format full content for X
    const fullXContent = formatFullContentForX(cleanContent, latestPost.content);
    
    // Show preview of how content will be formatted for each platform
    console.log('\n📱 Content Preview:');
    console.log('----------------------------------');
    console.log('\n📌 X (Twitter) - FULL CONTENT:');
    console.log(fullXContent);
    console.log(`(${fullXContent.length} characters)`);

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
    
    // Post to X with full content (minus problematic characters)
    try {
      console.log('Posting to X...');
      await postToX(fullXContent);
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