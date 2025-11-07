/**
 * Bluesky API Client Module
 * 
 * This module handles posting to Bluesky using the official API.
 * It uses the @atproto/api package to interact with the Bluesky network.
 */

const { BskyAgent } = require('@atproto/api');
const fs = require('fs').promises;
const path = require('path');

// Default Bluesky service URL
const BLUESKY_SERVICE = 'https://bsky.social';
// Max character limit for single Bluesky post
const BLUESKY_CHAR_LIMIT = 280;

/**
 * Post content to Bluesky
 * 
 * @param {string} content - The content to post
 * @param {Array} mediaFiles - Array of media files to attach
 * @param {Object} options - Additional posting options
 * @returns {Object} Result of the posting operation
 */
async function postToBluesky(content, mediaFiles = [], options = {}) {
  console.log('🚀 Posting to Bluesky...');
  
  try {
    // Check for credentials
    if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_PASSWORD) {
      throw new Error('Bluesky credentials not set in environment variables');
    }
    
    // Create Bluesky agent
    const agent = new BskyAgent({ service: BLUESKY_SERVICE });
    
    // Authenticate with Bluesky
    console.log('Authenticating with Bluesky...');
    await agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_PASSWORD
    });
    
    // Check if content is longer than the limit
    if (content.length > BLUESKY_CHAR_LIMIT) {
      console.log(`Content length (${content.length}) exceeds Bluesky limit. Posting as thread...`);
      return await postAsThread(agent, content, mediaFiles, options);
    }
    
    // If content fits in a single post, proceed as normal
    
    // Upload images if provided
    let embedImages = undefined;
    if (mediaFiles && mediaFiles.length > 0) {
      console.log(`Uploading ${mediaFiles.length} media files...`);
      embedImages = await uploadImages(agent, mediaFiles);
    }
    
    // Prepare post options
    const postOptions = {
      text: content,
      ...embedImages
    };
    
    // Create the post
    console.log('Creating post...');
    const response = await agent.post(postOptions);
    
    console.log('✅ Successfully posted to Bluesky!');
    return { success: true, postUri: response.uri };
  } catch (error) {
    console.error('❌ Error posting to Bluesky:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Post content as a thread on Bluesky
 *
 * @param {Object} agent - Authenticated BskyAgent
 * @param {string} content - The content to post
 * @param {Array} mediaFiles - Array of media files to attach
 * @param {Object} options - Additional posting options
 * @returns {Object} Result of the thread posting operation
 */
async function postAsThread(agent, content, mediaFiles = [], options = {}) {
  try {
    console.log('Breaking content into thread parts...');
    const threadParts = breakContentIntoThreadParts(content);
    console.log(`Content will be posted as ${threadParts.length} part thread`);

    // Extract hashtags to add to the last post
    const hashtagRegex = /(#\w+)/g;
    const hashtags = content.match(hashtagRegex) || [];
    const hashtagsString = hashtags.join(' ');
    
    // Upload media for the first post if available
    let embedImages = undefined;
    if (mediaFiles && mediaFiles.length > 0) {
      console.log(`Uploading ${mediaFiles.length} media files for first post...`);
      embedImages = await uploadImages(agent, mediaFiles);
    }
    
    let rootUri = null;
    let rootCid = null;
    let lastPostUri = null;
    let lastPostCid = null;
    
    // Post each thread part
    for (let i = 0; i < threadParts.length; i++) {
      let postText = threadParts[i];
      
      // Add hashtags to the last post if they're not already there
      if (i === threadParts.length - 1 && hashtags.length > 0) {
        // Check if hashtags are already in the last part
        let hasAllHashtags = true;
        for (const hashtag of hashtags) {
          if (!postText.includes(hashtag)) {
            hasAllHashtags = false;
            break;
          }
        }
        
        // If not all hashtags are present, add them
        if (!hasAllHashtags) {
          if (postText.length + hashtagsString.length + 1 <= BLUESKY_CHAR_LIMIT) {
            postText = postText + ' ' + hashtagsString;
          }
        }
      }
      
      console.log(`Posting thread part ${i+1}/${threadParts.length}...`);
      
      // Create post options
      const postOptions = {
        text: postText
      };
      
      // Add media to first post only
      if (i === 0 && embedImages) {
        Object.assign(postOptions, embedImages);
      }
      
      // Add reply reference for all posts except the first one
      if (i > 0 && rootUri && rootCid) {
        postOptions.reply = {
          root: {
            uri: rootUri,
            cid: rootCid
          }
        };
        
        // Add parent reference
        if (lastPostUri && lastPostCid) {
          postOptions.reply.parent = {
            uri: lastPostUri,
            cid: lastPostCid
          };
        }
      }
      
      // Post the thread part
      const response = await agent.post(postOptions);
      
      // Save the root post info if this is the first post
      if (i === 0) {
        rootUri = response.uri;
        rootCid = response.cid;
      }
      
      // Update the last post info
      lastPostUri = response.uri;
      lastPostCid = response.cid;
    }
    
    console.log('✅ Successfully posted thread to Bluesky!');
    return { 
      success: true, 
      isThread: true, 
      threadLength: threadParts.length,
      rootPostUri: rootUri
    };
  } catch (error) {
    console.error('❌ Error posting thread to Bluesky:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Break content into thread parts for Bluesky
 * 
 * @param {string} content - The content to break into thread parts
 * @returns {Array} Array of thread parts
 */
function breakContentIntoThreadParts(content) {
  const threadParts = [];
  const maxLength = BLUESKY_CHAR_LIMIT;
  
  // If content is already shorter than the limit, return as is
  if (content.length <= maxLength) {
    return [content];
  }
  
  let remainingContent = content;
  
  while (remainingContent.length > 0) {
    // If remaining content fits in a single post
    if (remainingContent.length <= maxLength) {
      threadParts.push(remainingContent);
      break;
    }
    
    // Find a good breaking point for the current part
    let breakPoint = maxLength;
    
    // Try to find sentence endings
    const sentenceEndings = ['.', '!', '?'];
    let sentenceBreakPoint = -1;
    
    // Look for sentence endings from the maximum position backwards
    for (let i = maxLength - 1; i >= maxLength * 0.7; i--) {
      if (sentenceEndings.includes(remainingContent[i])) {
        sentenceBreakPoint = i + 1; // Include the punctuation
        break;
      }
    }
    
    if (sentenceBreakPoint > 0) {
      breakPoint = sentenceBreakPoint;
    } else {
      // If no sentence ending, try to break at a space
      for (let i = maxLength - 1; i >= maxLength * 0.7; i--) {
        if (remainingContent[i] === ' ') {
          breakPoint = i + 1; // Include the space
          break;
        }
      }
    }
    
    // Extract this part and add to thread parts
    const part = remainingContent.substring(0, breakPoint).trim();
    threadParts.push(part);
    
    // Remove this part from remaining content
    remainingContent = remainingContent.substring(breakPoint).trim();
  }
  
  return threadParts;
}

/**
 * Upload images to Bluesky
 * 
 * @param {Object} agent - Authenticated BskyAgent
 * @param {Array} mediaFiles - Array of media file paths
 * @returns {Object} Embed object for the post
 */
async function uploadImages(agent, mediaFiles) {
  // Limit to 4 images (Bluesky's current limit)
  const filesToUpload = mediaFiles.slice(0, 4);
  
  // Read and upload each file
  const uploadedImages = await Promise.all(
    filesToUpload.map(async (filePath) => {
      // Read file
      const fileData = await fs.readFile(filePath);
      
      // Determine MIME type from file extension
      const mimeType = getMimeType(filePath);
      
      // Upload to Bluesky
      return agent.uploadBlob(fileData, { mimeType });
    })
  );
  
  // Create embed object for the post
  return {
    embed: {
      $type: 'app.bsky.embed.images',
      images: uploadedImages.map(img => ({
        image: img.data.blob,
        alt: 'Image attachment'
      }))
    }
  };
}

/**
 * Get MIME type from file path
 * 
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Test if Bluesky credentials are valid
 * 
 * @returns {Promise<Object>} Result of the test
 */
async function testBlueskyCredentials() {
  console.log('🔑 Testing Bluesky credentials...');
  
  if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_PASSWORD) {
    return { 
      success: false, 
      error: 'Bluesky credentials not set in environment variables' 
    };
  }
  
  try {
    // Create Bluesky agent
    const agent = new BskyAgent({ service: BLUESKY_SERVICE });
    
    // Try to login
    console.log('Attempting to log in to Bluesky...');
    const response = await agent.login({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_PASSWORD
    });
    
    console.log('✅ Bluesky credentials are valid!');
    return { 
      success: true,
      handle: response.data.handle,
      did: response.data.did
    };
  } catch (error) {
    console.error('❌ Error testing Bluesky credentials:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

module.exports = {
  postToBluesky,
  testBlueskyCredentials,
  breakContentIntoThreadParts
};
