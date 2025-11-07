/**
 * Bluesky Post Full Content Script
 * 
 * This script fetches your most recent Mastodon post and posts it to Bluesky
 * with preserved formatting, emojis, and hashtags.
 */

require('dotenv').config();
const Mastodon = require('mastodon-api');
const { postToBluesky } = require('../src/js/crosspost/bluesky');
const fsPromises = require('fs').promises;
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');

// Initialize Mastodon client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: `https://${process.env.MASTODON_INSTANCE}/api/v1/`
});

/**
 * Decode HTML entities in content
 * 
 * @param {string} content - Content with HTML entities
 * @returns {string} Decoded content
 */
function decodeHtmlEntities(content) {
  return content
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Handle numeric HTML entities (decimal)
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
    // Handle numeric HTML entities (hex)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Fetch the most recent post from your Mastodon account
 * 
 * @param {string} postId - Optional specific post ID to fetch
 * @returns {Object} Mastodon post data
 */
async function fetchMastodonPost(postId = null) {
  if (postId) {
    console.log(`Fetching specific Mastodon post with ID: ${postId}...`);
    try {
      const response = await mastodon.get(`statuses/${postId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching Mastodon post ${postId}:`, error);
      throw new Error(`Could not fetch post with ID ${postId}: ${error.message}`);
    }
  } else {
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
}

/**
 * Format content for Bluesky with full formatting preserved
 * 
 * @param {string} htmlContent - Original HTML content
 * @param {Object} options - Formatting options
 * @returns {string} Formatted content for Bluesky
 */
function formatContentForBluesky(htmlContent, options = {}) {
  console.log('\n🔍 Formatting content for Bluesky...');
  
  // First, properly decode HTML entities
  let content = decodeHtmlEntities(htmlContent);
  
  // Handle HTML paragraph tags to preserve original structure
  content = content
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n\n')  // Use double line breaks for paragraphs
    .replace(/<br\s*\/?>/g, '\n'); // Use line breaks for <br> tags
  
  // Handle hashtag spans for proper formatting
  content = content.replace(/<a [^>]*?class="mention hashtag"[^>]*?>(#<span>[^<]+<\/span>)<\/a>/g, 
    (match, hashtagContent) => {
      // Extract just the hashtag text from #<span>text</span>
      const hashtagMatch = hashtagContent.match(/#<span>([^<]+)<\/span>/);
      if (hashtagMatch) {
        return `#${hashtagMatch[1]}`;
      }
      return match;
    }
  );
  
  // Handle mentions and links properly
  content = content.replace(/<a[^>]*?href="([^"]+)"[^>]*?>([^<]+)<\/a>/g, (match, href, text) => {
    // If it's a mention
    if (text.startsWith('@')) {
      return text; // Just keep the mention text
    }
    // If it's a general link
    return `${text} (${href})`;
  });
  
  // Then remove remaining HTML tags
  content = content.replace(/<[^>]*>/g, '');
  
  // Keep emojis unless explicitly disabled
  if (options.removeEmojis) {
    content = content.replace(/[\u{1F300}-\u{1F6FF}]/ug, '');
  }
  
  // Fix spacing issues while preserving paragraph structure
  content = content
    .replace(/ +/g, ' ')          // Replace multiple spaces with a single space
    .replace(/\n +/g, '\n')       // Remove spaces at the beginning of lines
    .replace(/ +\n/g, '\n')       // Remove spaces at the end of lines
    .replace(/\n{3,}/g, '\n\n')   // Replace 3+ consecutive line breaks with just 2
    .trim();
  
  return content;
}

/**
 * Download media from a URL to a temporary file
 * 
 * @param {string} url - URL of the media file
 * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadMedia(url) {
  const tempDir = path.join(os.tmpdir(), 'bluesky-poster');
  const fileName = path.basename(url).split('?')[0]; // Remove query params if any
  const filePath = path.join(tempDir, fileName);
  
  try {
    // Create temp directory if it doesn't exist
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    // Download the file
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath);
      https.get(url, response => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(filePath);
        });
      }).on('error', err => {
        fs.unlink(filePath, () => {}); // Use callback version for consistency
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading media from ${url}:`, error);
    return null;
  }
}

/**
 * Post to Bluesky with retry functionality
 * 
 * @param {string} content - Content to post
 * @param {Array} mediaFiles - Array of media file paths
 * @param {Object} options - Posting options
 * @returns {Promise<Object>} Result of posting operation
 */
async function postToBlueskyWithRetry(content, mediaFiles = [], options = {}) {
  const maxRetries = options.maxRetries || 3;
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Posting attempt ${retryCount + 1}/${maxRetries}...`);
      const result = await postToBluesky(content, mediaFiles);
      
      if (result.success) {
        return result;
      } else {
        lastError = new Error(result.error || 'Unknown error');
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = 5000 * retryCount; // Increasing delay for each retry
          console.log(`Posting failed. Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        const delay = 5000 * retryCount;
        console.log(`Error: ${error.message}. Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Failed to post to Bluesky after multiple attempts');
}

/**
 * Parse command line arguments
 * 
 * @returns {Object} Parsed options
 */
function parseCommandLineArgs() {
  const options = {
    includeMedia: true,
    removeEmojis: false,
    dryRun: false,
    postId: null,
    maxRetries: 3
  };
  
  // Process arguments
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    
    switch (arg) {
      case '--nomedia':
        options.includeMedia = false;
        break;
      case '--noemoji':
        options.removeEmojis = true;
        break;
      case '--dryrun':
        options.dryRun = true;
        break;
      case '--postid':
        options.postId = process.argv[i + 1];
        i++; // Skip the next argument as it's the post ID
        break;
      case '--retries':
        options.maxRetries = parseInt(process.argv[i + 1], 10) || 3;
        i++; // Skip the next argument as it's the retry count
        break;
    }
  }
  
  return options;
}

/**
 * Main function
 */
async function run() {
  try {
    // Parse command line options
    const options = parseCommandLineArgs();
    
    // Check for help flag
    if (process.argv.includes('--help')) {
      console.log(`
Bluesky Post Full Content Script Usage:
-------------------------------------
node scripts/bluesky-post-full-content.js [options]

Options:
  --nomedia       Do not include media attachments in the post
  --noemoji       Remove emojis from the content
  --dryrun        Show what would be posted without actually posting
  --postid ID     Post a specific Mastodon post by ID instead of latest
  --retries N     Number of retry attempts if posting fails (default: 3)
  --help          Show this help message

Features:
  - Preserves full formatting including emojis and hashtags
  - Automatically creates thread if content exceeds character limit
  - Includes media attachments from the original post
  
Examples:
  node scripts/bluesky-post-full-content.js               # Post content to Bluesky with media
  node scripts/bluesky-post-full-content.js --nomedia     # Post without media attachments
  node scripts/bluesky-post-full-content.js --dryrun      # Preview what would be posted
  node scripts/bluesky-post-full-content.js --postid 123  # Post a specific Mastodon post
      `);
      process.exit(0);
    }
    
    // Verify credentials are set
    if (!process.env.MASTODON_ACCESS_TOKEN || !process.env.MASTODON_INSTANCE) {
      throw new Error('Mastodon credentials not set in .env file');
    }
    
    if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_PASSWORD) {
      throw new Error('Bluesky credentials not set in .env file');
    }
    
    // Fetch the Mastodon post
    const mastodonPost = await fetchMastodonPost(options.postId);
    
    if (!mastodonPost) {
      throw new Error('Could not fetch Mastodon post');
    }
    
    // Display the post information
    console.log(`Found post from ${new Date(mastodonPost.created_at).toLocaleString()}`);
    
    // Show original content for debugging
    console.log('\n🔍 Original HTML Content:');
    console.log('==============================');
    console.log(mastodonPost.content);
    console.log('==============================');
    
    // Format content for Bluesky with full formatting
    const bskyContent = formatContentForBluesky(mastodonPost.content, options);
    
    // Show preview
    console.log('\n📱 Content Preview for Bluesky:');
    console.log('==============================');
    console.log(bskyContent);
    console.log('==============================');
    console.log(`Character count: ${bskyContent.length}`);
    
    // Handle media attachments if any
    const mediaFiles = [];
    if (options.includeMedia && mastodonPost.media_attachments && mastodonPost.media_attachments.length > 0) {
      console.log(`\n📷 Found ${mastodonPost.media_attachments.length} media attachments`);
      
      // Download media files
      for (const media of mastodonPost.media_attachments) {
        console.log(`Downloading media: ${media.url}`);
        const filePath = await downloadMedia(media.url);
        if (filePath) {
          mediaFiles.push(filePath);
          console.log(`Media saved to: ${filePath}`);
        }
      }
      
      console.log(`Successfully downloaded ${mediaFiles.length} media files`);
    } else if (!options.includeMedia && mastodonPost.media_attachments && mastodonPost.media_attachments.length > 0) {
      console.log('\n📷 Media attachments will be skipped (--nomedia flag)');
    }
    
    // If dry run, exit here
    if (options.dryRun) {
      console.log('\n🔍 Dry run mode - not posting to Bluesky');
      console.log(`Would post content with ${mediaFiles.length} media attachments`);
      process.exit(0);
    }
    
    // Ask for confirmation
    console.log('\n⚠️ Are you sure you want to post to Bluesky? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Posting to Bluesky...');
    
    // Post to Bluesky with retry functionality
    const result = await postToBlueskyWithRetry(bskyContent, mediaFiles, { 
      maxRetries: options.maxRetries 
    });
    
    if (result.success) {
      if (result.isThread) {
        console.log(`\n✅ Successfully posted as a thread (${result.threadLength} posts) to Bluesky!`);
      } else {
        console.log('\n✅ Successfully posted to Bluesky!');
      }
    } else {
      throw new Error(`Failed to post to Bluesky: ${result.error}`);
    }
    
    // Clean up temp files
    if (mediaFiles.length > 0) {
      console.log('\nCleaning up temporary files...');
      for (const file of mediaFiles) {
        try {
          await fsPromises.unlink(file);
        } catch (error) {
          console.warn(`Failed to delete temporary file ${file}: ${error.message}`);
        }
      }
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 