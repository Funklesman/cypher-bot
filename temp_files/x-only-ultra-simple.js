/**
 * X-Only Ultra-Simple Posting
 * 
 * This script posts ONLY to X with ultra-simplified content.
 * Bluesky posting is completely disabled.
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const { postToX } = require('../src/js/crosspost/x-poster');

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

/**
 * Create ultra-simplified content for X
 */
function createUltraSimpleContent(content) {
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
 * Main function
 */
async function run() {
  try {
    // Verify credentials are set
    if (!process.env.MASTODON_ACCESS_TOKEN || !process.env.MASTODON_INSTANCE) {
      throw new Error('Mastodon credentials not set in .env file');
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
    
    console.log(`\nOriginal Content: "${cleanContent}"`);
    
    // Create ultra-simple X content
    const ultraSimpleContent = createUltraSimpleContent(cleanContent);
    
    // Show preview
    console.log('\n📌 ULTRA-SIMPLE CONTENT FOR X:');
    console.log('==============================');
    console.log(ultraSimpleContent);
    console.log('==============================');
    console.log(`Character count: ${ultraSimpleContent.length}`);

    // Ask for confirmation
    console.log('\n⚠️ Are you sure you want to post this to X ONLY? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Proceeding with X posting ONLY...');
    
    // Post to X only
    try {
      await postToX(ultraSimpleContent);
      console.log('✅ Successfully posted to X!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error posting to X:', error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 