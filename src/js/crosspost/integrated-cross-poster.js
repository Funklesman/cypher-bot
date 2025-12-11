/**
 * Integrated Cross-Poster Module
 * 
 * This module provides functions to cross-post Mastodon content to X and Bluesky.
 * It reuses the formatting and posting functions from the standalone scripts.
 */

const { postToX } = require('./x-poster');
const { postToBluesky } = require('./bluesky');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const os = require('os');
const https = require('https');

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
 * Format content for X with proper line breaks
 */
function formatContentForX(htmlContent, options = {}) {
  console.log('\n🔍 Formatting content for X...');
  
  // First, properly decode HTML entities
  let decodedContent = decodeHtmlEntities(htmlContent);
  
  // Extract hashtag spans to keep them for later
  const extractedHashtags = [];
  decodedContent = decodedContent.replace(/<a [^>]*?class="mention hashtag"[^>]*?>(#<span>[^<]+<\/span>)<\/a>/g, 
    (match, hashtagContent) => {
      // Extract just the hashtag text from #<span>text</span>
      const hashtagMatch = hashtagContent.match(/#<span>([^<]+)<\/span>/);
      if (hashtagMatch) {
        const hashtag = `#${hashtagMatch[1]}`;
        // Add to our extracted hashtags list if not already there
        if (!extractedHashtags.includes(hashtag)) {
          extractedHashtags.push(hashtag);
        }
        // Remove the hashtag from the main content and add a space to prevent words merging
        return ' ';
      }
      return match;
    }
  );
  
  if (extractedHashtags.length > 0) {
    console.log('Found hashtags:', extractedHashtags.join(', '));
  }
  
  // Handle HTML paragraph tags to preserve original structure
  let content = decodedContent
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n\n')  // Use double line breaks for paragraphs
    .replace(/<br\s*\/?>/g, '\n'); // Use line breaks for <br> tags
  
  // Then remove remaining HTML tags
  content = content.replace(/<[^>]*>/g, '');
  
  // Remove any remaining hashtags from the main content
  // These might be hashtags that weren't in the special span format
  // Add a space after each removal to prevent words merging
  content = content.replace(/#[a-zA-Z0-9_-]+/g, ' ');
  
  // Handle dashes properly - this is key for correct spacing
  content = content
    .replace(/—/g, ' - ')       // Replace em dashes with spaced hyphens
    .replace(/–/g, ' - ')       // Replace en dashes with spaced hyphens
    // Fix any potential double spaces from the replacements
    .replace(/ {2,}/g, ' ');
  
  // Clean up other problematic characters
  content = content
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII chars including emojis
    .replace(/…/g, '...')         // Replace ellipsis
    .replace(/"/g, '"')           // Replace smart quotes
    .replace(/"/g, '"')           // Replace smart quotes
    .replace(/'/g, "'")           // Replace smart apostrophes
    .replace(/'/g, "'");          // Replace smart apostrophes
  
  // Fix spacing issues while preserving paragraph structure
  content = content
    .replace(/ +/g, ' ')          // Replace multiple spaces with a single space
    .replace(/\n +/g, '\n')       // Remove spaces at the beginning of lines
    .replace(/ +\n/g, '\n')       // Remove spaces at the end of lines
    .replace(/\n{3,}/g, '\n\n')   // Replace 3+ consecutive line breaks with just 2
    .trim();
  
  // Check if we should remove hashtag references completely
  const noHashtags = options.noHashtags || false;
  
  if (noHashtags) {
    console.log('No hashtags mode enabled - removing hashtag references');
    return content.trim();
  } else {
    // Add the extracted hashtags at the end if we found any
    let formattedContent = content.trim();
    
    if (extractedHashtags.length > 0) {
      // Ensure there's always a double line break before hashtags
      if (formattedContent && !formattedContent.endsWith('\n\n')) {
        if (formattedContent.endsWith('\n')) {
          formattedContent += '\n'; // Add one more line break
        } else {
          formattedContent += '\n\n'; // Add two line breaks
        }
      }
      
      // Add hashtags at the end
      formattedContent += extractedHashtags.join(' ');
    }
    
    // Add closing tagline
    formattedContent += '\n\nThe signal remembers. The noise forgets.';
    
    console.log('Using real hashtags');
    return formattedContent;
  }
}

/**
 * Format content for Bluesky
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
 * Download media for a post
 */
async function downloadMedia(mediaAttachments = []) {
  const mediaFiles = [];
  if (!mediaAttachments || mediaAttachments.length === 0) {
    return mediaFiles;
  }
  
  const tempDir = path.join(os.tmpdir(), 'crosspost-media');
  
  try {
    // Create temp directory if it doesn't exist
    await fsPromises.mkdir(tempDir, { recursive: true });
    
    // Download each media file
    for (const media of mediaAttachments) {
      const url = media.url;
      const fileName = path.basename(url).split('?')[0]; // Remove query params if any
      const filePath = path.join(tempDir, fileName);
      
      try {
        // Download the file
        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(filePath);
          https.get(url, response => {
            response.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          }).on('error', err => {
            fs.unlink(filePath, () => {});
            reject(err);
          });
        });
        
        mediaFiles.push(filePath);
        console.log(`Downloaded media: ${filePath}`);
      } catch (error) {
        console.error(`Error downloading media from ${url}:`, error);
      }
    }
    
    return mediaFiles;
  } catch (error) {
    console.error('Error setting up media downloads:', error);
    return [];
  }
}

/**
 * Clean up temporary media files
 */
async function cleanupMediaFiles(mediaFiles = []) {
  if (mediaFiles.length === 0) return;
  
  console.log('\nCleaning up temporary media files...');
  for (const file of mediaFiles) {
    try {
      await fsPromises.unlink(file);
    } catch (error) {
      console.warn(`Failed to delete temporary file ${file}: ${error.message}`);
    }
  }
}

/**
 * Post content to X with retry functionality
 */
async function postToXWithRetry(content, mediaFiles = [], options = {}) {
  const maxRetries = options.maxRetries || 3;
  let retryCount = 0;
  let lastError = null;
  
  console.log('🔍 DEBUG: Attempting to post to X with the following content:');
  console.log('--- First 100 chars: ' + content.substring(0, 100) + '...');
  console.log(`--- Media files: ${mediaFiles.length}`);
  console.log(`--- Options: ${JSON.stringify(options)}`);
  
  while (retryCount < maxRetries) {
    try {
      console.log(`X posting attempt ${retryCount + 1}/${maxRetries}...`);
      console.log('🔍 DEBUG: About to call postToX function');
      const result = await postToX(content, mediaFiles);
      console.log('🔍 DEBUG: postToX returned successfully');
      return { success: true, result };
    } catch (error) {
      lastError = error;
      retryCount++;
      console.log(`🔍 DEBUG: Error details - ${error.stack || 'No stack trace'}`);
      
      if (retryCount < maxRetries) {
        const delay = 5000 * retryCount;
        console.log(`Error posting to X: ${error.message}. Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Failed to post to X after ${maxRetries} attempts: ${lastError?.message}`);
  return { success: false, error: lastError };
}

/**
 * Post to Bluesky with retry functionality
 */
async function postToBlueskyWithRetry(content, mediaFiles = [], options = {}) {
  const maxRetries = options.maxRetries || 3;
  let retryCount = 0;
  let lastError = null;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`Bluesky posting attempt ${retryCount + 1}/${maxRetries}...`);
      const result = await postToBluesky(content, mediaFiles);
      
      if (result.success) {
        return result;
      } else {
        lastError = new Error(result.error || 'Unknown error');
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = 5000 * retryCount;
          console.log(`Posting to Bluesky failed. Retrying in ${delay/1000} seconds...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    } catch (error) {
      lastError = error;
      retryCount++;
      
      if (retryCount < maxRetries) {
        const delay = 5000 * retryCount;
        console.log(`Error posting to Bluesky: ${error.message}. Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`Failed to post to Bluesky after ${maxRetries} attempts: ${lastError?.message}`);
  return { success: false, error: lastError };
}

/**
 * Cross-post Mastodon content to X and Bluesky
 * 
 * @param {Object} mastodonPost - The Mastodon post object
 * @param {Object} options - Options for cross-posting
 * @returns {Object} Results of cross-posting operations
 */
async function crossPostToSocialMedia(mastodonPost, options = {}) {
  const results = {
    success: true,
    x: { attempted: false, success: false },
    bluesky: { attempted: false, success: false }
  };
  
  try {
    console.log(`Cross-posting Mastodon post from ${new Date(mastodonPost.created_at).toLocaleString()}`);
    
    // Format content for X
    let xContent = null;
    let xResult = null;
    if (process.env.X_POST_ENABLED === 'true') {
      xContent = formatContentForX(mastodonPost.content, { 
        noHashtags: options.noHashtags 
      });
      
      console.log(`Formatted content for X (${xContent.length} characters)`);
      results.x.attempted = true;
    }
    
    // Format content for Bluesky
    let blueskyContent = null;
    let blueskyResult = null;
    if (process.env.BLUESKY_POST_ENABLED === 'true') {
      blueskyContent = formatContentForBluesky(mastodonPost.content, { 
        removeEmojis: options.removeEmojis 
      });
      
      console.log(`Formatted content for Bluesky (${blueskyContent.length} characters)`);
      results.bluesky.attempted = true;
    }
    
    // Handle media attachments if needed
    let mediaFiles = [];
    if (options.includeMedia && mastodonPost.media_attachments && mastodonPost.media_attachments.length > 0) {
      console.log(`Processing ${mastodonPost.media_attachments.length} media attachments...`);
      mediaFiles = await downloadMedia(mastodonPost.media_attachments);
      console.log(`Downloaded ${mediaFiles.length} media files`);
    }
    
    // Post to X if enabled
    if (results.x.attempted) {
      console.log('\n🚀 Posting to X...');
      const xPostResult = await postToXWithRetry(xContent, mediaFiles, { 
        maxRetries: options.maxRetries 
      });
      
      results.x.success = xPostResult.success;
      if (xPostResult.success) {
        console.log('✅ Successfully posted to X!');
      } else {
        results.success = false;
        console.error('❌ Failed to post to X:', xPostResult.error);
      }
    }
    
    // Post to Bluesky if enabled
    if (results.bluesky.attempted) {
      console.log('\n🚀 Posting to Bluesky...');
      const blueskyPostResult = await postToBlueskyWithRetry(blueskyContent, mediaFiles, { 
        maxRetries: options.maxRetries 
      });
      
      results.bluesky.success = blueskyPostResult.success;
      if (blueskyPostResult.success) {
        console.log('✅ Successfully posted to Bluesky!');
        if (blueskyPostResult.isThread) {
          console.log(`   Posted as a thread (${blueskyPostResult.threadLength} posts)`);
        }
      } else {
        results.success = false;
        console.error('❌ Failed to post to Bluesky:', blueskyPostResult.error);
      }
    }
    
    // Clean up media files
    await cleanupMediaFiles(mediaFiles);
    
    return results;
  } catch (error) {
    console.error('Error in crossPostToSocialMedia:', error);
    return {
      success: false,
      x: { ...results.x, error: error.message },
      bluesky: { ...results.bluesky, error: error.message }
    };
  }
}

module.exports = {
  crossPostToSocialMedia,
  formatContentForX,
  formatContentForBluesky
}; 