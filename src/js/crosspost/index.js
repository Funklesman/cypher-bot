/**
 * Cross-Posting Module
 * 
 * This module handles cross-posting to multiple platforms from Mastodon.
 * Currently supports X (Twitter) and Bluesky.
 */

const { postToX } = require('./x-poster');
const { postToBluesky } = require('./bluesky');
const path = require('path');
const fs = require('fs').promises;
const ContentDeduplicator = require('../content_deduplicator');

// Initialize content deduplicator
const contentDeduplicator = new ContentDeduplicator();

/**
 * Post content to X (formerly Twitter)
 * 
 * @param {string} content - Content to post
 * @param {Array} mediaFiles - Array of media files to attach
 * @param {Object} options - Additional options
 * @returns {Object} Result of posting operation
 */
async function postToXWithRetry(content, mediaFiles = [], options = {}) {
  // Allow up to 2 retries for X posting
  let attempts = 0;
  const maxAttempts = 3;
  let lastError = null;
  
  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await postToX(content, mediaFiles, options);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`X posting attempt ${attempts} failed: ${error.message}`);
      
      if (attempts < maxAttempts) {
        // Wait between retry attempts
        const waitTime = 10000; // 10 seconds
        console.log(`Waiting ${waitTime/1000} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  // If all attempts failed, throw the last error
  throw new Error(`Failed to post to X after ${maxAttempts} attempts: ${lastError.message}`);
}

/**
 * Cross-post content to multiple platforms
 * 
 * @param {string} content - Content to post
 * @param {Array} mediaFiles - Array of media files to attach
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Results of cross-posting operations
 */
async function crossPost(content, platforms = ['x', 'bluesky']) {
    try {
        // Check if content has been crossposted recently
        const hasBeenCrossposted = await contentDeduplicator.hasBeenCrossposted(content);
        if (hasBeenCrossposted) {
            console.log('Content has been crossposted recently, skipping...');
            return {
                success: false,
                x: { success: false, error: 'Content already crossposted' },
                bluesky: { success: false, error: 'Content already crossposted' }
            };
        }

        const results = {
            success: true,
            x: { success: false },
            bluesky: { success: false }
        };

        for (const platform of platforms) {
            try {
                if (platform === 'x') {
                    await postToX(content);
                    results.x.success = true;
                } else if (platform === 'bluesky') {
                    await postToBluesky(content);
                    results.bluesky.success = true;
                }
            } catch (error) {
                console.error(`Error posting to ${platform}:`, error);
                results[platform].error = error.message;
                results.success = false;
            }
        }

        // If at least one platform succeeded, mark as crossposted
        if (results.x.success || results.bluesky.success) {
            await contentDeduplicator.markAsCrossposted(content);
        }

        return results;
    } catch (error) {
        console.error('Error in crossPost:', error);
        return {
            success: false,
            x: { success: false, error: error.message },
            bluesky: { success: false, error: error.message }
        };
    }
}

/**
 * Format content for different platforms
 * 
 * @param {string} content - Original content
 * @returns {Promise<Object>} Content formatted for each platform
 */
async function formatContentForPlatforms(content) {
  console.log('Formatting content for different platforms...');
  
  // For X (Twitter), format with X Blue limit (4000 chars)
  const xContent = formatContentForX(content);
  
  // For Bluesky, we now use the full content and let the posting function handle threading
  // No need for AI optimization since we're posting the full content as a thread
  console.log('Using full content for Bluesky (will be posted as thread if needed)...');
  
  return {
    x: xContent,
    bluesky: content // Use the full content
  };
}

/**
 * Format content for X (Twitter)
 * X Blue users can post up to 4,000 characters
 * 
 * @param {string} content - Original content
 * @returns {string} Formatted content for X
 */
function formatContentForX(content) {
  // X Blue users can post up to 4,000 characters
  const maxLength = 4000; // Using full Twitter Blue limit
  
  // First, ensure any HTML entities are properly decoded
  let processedContent = decodeHtmlEntities(content);
  
  // Then handle HTML line breaks
  processedContent = processedContent.replace(/<br\s*\/?>/gi, '\n');
  
  // Extract title (assuming the title is the first bold text)
  const titleMatch = processedContent.match(/\*\*([^*]+)\*\*/);
  let title = titleMatch ? titleMatch[1] : '';
  
  // Handle title formatting - using a simpler approach
  if (title) {
    // Remove the original title
    processedContent = processedContent.replace(/\*\*([^*]+)\*\*/, '');
    // Add the title at beginning (uppercase but no special chars)
    title = title.trim();
    processedContent = `${title.toUpperCase()}\n\n${processedContent}`;
  }
  
  // Extract hashtags before processing further (to ensure they're correctly identified)
  // More robust regex that captures hashtags with underscores and hyphens
  const hashtagMatches = processedContent.match(/#[a-zA-Z0-9_-]+/g) || [];
  
  // Add line breaks at natural breaking points if they don't exist
  // This helps create a more readable post structure
  processedContent = processedContent
    .replace(/(\.|\?|!|\:)(\s+)([A-Z])/g, '$1\n\n$3') // Add paragraph breaks after sentences that start new thoughts
    .replace(/\n+#([a-zA-Z0-9_-]+)/g, ' #$1'); // Keep hashtags on same line
  
  // Remove markdown formatting (except for the title we've already handled)
  processedContent = processedContent.replace(/\*\*/g, ''); // Remove bold markers
  
  // Clean up problematic characters but KEEP emojis
  processedContent = processedContent
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes → regular
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes → regular
    .replace(/\u2026/g, '...')        // Ellipsis → three dots
    .replace(/[\u2013\u2014]/g, '-'); // En/em dashes → regular dash
  
  // Clean up excessive line breaks (no more than 2 consecutive)
  processedContent = processedContent.replace(/\n{3,}/g, '\n\n');
  
  // Ensure hashtags are properly included
  // Remove any existing hashtags first to avoid duplication
  processedContent = processedContent.replace(/#[a-zA-Z0-9_-]+/g, '').trim();
  
  // Add hashtags at the end if we found any
  if (hashtagMatches.length > 0) {
    processedContent += '\n\n' + hashtagMatches.join(' ');
  }
  
  // Keep content within limits
  return processedContent.substring(0, maxLength);
}

/**
 * Format content for Bluesky
 * Bluesky has a limit of 300 graphemes (characters)
 * 
 * @param {string} content - Original content
 * @returns {string} Formatted content for Bluesky
 */
function formatContentForBluesky(content) {
  // Bluesky has a strict limit of 300 graphemes/characters
  const maxLength = 300;
  
  if (content.length <= maxLength) {
    return content;
  }
  
  // Truncate and add ellipsis for content exceeding the limit
  return content.substring(0, maxLength - 3) + '...';
}

/**
 * Remove Mastodon-specific formatting
 * 
 * @param {string} content - Original content
 * @returns {string} Content without Mastodon formatting
 */
function removeMastodonFormatting(content) {
  // Replace Mastodon mentions with plain mentions
  let formatted = content.replace(/@([a-zA-Z0-9_]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]+)/g, '@$1');
  
  // Other Mastodon-specific formatting can be handled here
  
  return formatted;
}

/**
 * Log a summary of cross-posting results
 * 
 * @param {Object} results - Cross-posting results
 */
function logSummary(results) {
  console.log('\n📊 Cross-Posting Summary:');
  console.log('------------------------');
  console.log(`Overall: ${results.success ? '✅ Success' : '❌ Failed'}`);
  
  if (results.platforms.x.attempted) {
    console.log(`X: ${results.platforms.x.success ? '✅ Posted' : '❌ Failed'}`);
  } else {
    console.log('X: ⚠️ Not attempted');
  }
  
  if (results.platforms.bluesky.attempted) {
    console.log(`Bluesky: ${results.platforms.bluesky.success ? '✅ Posted' : '❌ Failed'}`);
  } else {
    console.log('Bluesky: ⚠️ Not attempted');
  }
  
  console.log('------------------------');
}

/**
 * Process a Mastodon post for cross-posting
 * 
 * @param {Object} mastodonPost - Mastodon post object
 * @returns {Promise<Object>} Results of cross-posting
 */
async function processMastodonPost(mastodonPost) {
  try {
    // Extract content from Mastodon post
    const content = mastodonPost.content;
    
    // Process media attachments if any
    const mediaFiles = [];
    if (mastodonPost.media_attachments && mastodonPost.media_attachments.length > 0) {
      // Download media files to temp directory
      for (const media of mastodonPost.media_attachments) {
        const tempFilePath = await downloadMedia(media.url);
        if (tempFilePath) {
          mediaFiles.push(tempFilePath);
        }
      }
    }
    
    // Cross-post with options
    const options = {
      removeMastodonFormatting: true,
      mastodonId: mastodonPost.id,
      visibility: mastodonPost.visibility
    };
    
    return await crossPost(content, mediaFiles, options);
  } catch (error) {
    console.error('Error processing Mastodon post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Download media from URL to temporary file
 * 
 * @param {string} url - URL of the media file
 * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadMedia(url) {
  // This is a placeholder - you'd implement actual download logic here
  // Using fetch or another HTTP client library
  
  console.log(`Would download media from ${url}`);
  return null;
}

/**
 * Decode HTML entities in content
 * 
 * @param {string} content - Content with HTML entities
 * @returns {string} Decoded content
 */
function decodeHtmlEntities(content) {
  // Create a temporary element and use the browser's native decoder
  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = content;
    return textarea.value;
  }

  // For Node.js environment, use a more comprehensive approach
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

module.exports = {
  crossPost,
  processMastodonPost,
  formatContentForPlatforms
};
