/**
 * X Post Full Content Script
 * 
 * This script fetches your most recent Mastodon post and posts it to X
 * with preserved line breaks and proper formatting.
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
 * Alternative approach to handle problematic hashtags by directly recognizing 
 * and manually reconstructing them. This can be used as a fallback if the 
 * normal HTML entity decoding doesn't work as expected.
 * 
 * @param {string} content - Content with potentially problematic hashtags
 * @returns {string} Content with fixed hashtags
 */
function fixProblemHashtags(content) {
  // Look for patterns like "#" followed by a numeric HTML entity
  let fixedContent = content;
  
  // Match patterns like #&#39;
  const problematicHashtags = content.match(/#(&[#a-zA-Z0-9]+;)[a-zA-Z0-9_-]*/g) || [];
  
  // Process each problematic hashtag
  for (const tag of problematicHashtags) {
    // Get the entity part
    const entityMatch = tag.match(/#(&[#a-zA-Z0-9]+;)([a-zA-Z0-9_-]*)/);
    if (entityMatch) {
      const entityPart = entityMatch[1];
      const restOfTag = entityMatch[2];
      
      // Decode just the entity
      const decoded = decodeHtmlEntities(entityPart);
      
      // Replace in the content
      const fixedTag = `#${decoded}${restOfTag}`;
      fixedContent = fixedContent.replace(tag, fixedTag);
      
      console.log(`Fixed problematic hashtag: ${tag} -> ${fixedTag}`);
    }
  }
  
  return fixedContent;
}

/**
 * Format content for X with proper line breaks - REAL HASHTAGS WITH TEXT AFTER
 * This approach tries to keep hashtags functional by adding a small line of text after them
 */
function formatContentForX(htmlContent) {
  console.log('\n🔍 Formatting content for X (real hashtags with text after)...');
  
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
  const noHashtags = process.argv.includes('--nohashtags');
  
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
      
      // Add hashtags followed by attribution
      formattedContent += extractedHashtags.join(' ');
      formattedContent += '\nCypher University: http://cypheruniversity.com';
    }
    
    console.log('Using real hashtags with Cypher University attribution');
    return formattedContent;
  }
}

/**
 * Main function
 */
async function run() {
  try {
    // Check for help flag
    if (process.argv.includes('--help')) {
      console.log(`
X Post Full Content Script Usage:
--------------------------------
node scripts/x-post-full-content.js [options]

Options:
  --nohashtags    Post without hashtags (hashtags will be removed)
  --help          Show this help message

Features:
  - Preserves line breaks and paragraph structure
  - Keeps hashtags functional by adding Cypher University attribution after them
  - The attribution text helps make hashtags work on X while promoting your brand
  
Examples:
  node scripts/x-post-full-content.js              # Post with functional hashtags
  node scripts/x-post-full-content.js --nohashtags # Post without hashtags (if hashtags cause issues)
      `);
      process.exit(0);
    }
    
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
    
    // Show original content for debugging
    console.log('\n🔍 Original HTML Content:');
    console.log('==============================');
    console.log(latestPost.content);
    console.log('==============================');
    
    // Debug: Show decoded content before extraction
    const decodedContent = decodeHtmlEntities(latestPost.content);
    console.log('\n🔍 Decoded HTML Content:');
    console.log('==============================');
    console.log(decodedContent);
    console.log('==============================');
    
    // Format content for X with proper line breaks
    const xContent = formatContentForX(latestPost.content);
    
    // Debug: Extract hashtags for validation
    const cleanContent = decodeHtmlEntities(latestPost.content)
      .replace(/<[^>]*>/g, '');
    const extractedHashtags = cleanContent.match(/#[a-zA-Z0-9_-]+/g) || [];
    
    // Only show hashtags section if running with hashtags
    if (!process.argv.includes('--nohashtags') && extractedHashtags.length > 0) {
      console.log('\n🔍 Extracted Hashtags:');
      console.log('==============================');
      console.log(extractedHashtags.join(' '));
      console.log('==============================');
    }
    
    // Show preview
    console.log('\n📱 Content Preview for X:');
    console.log('==============================');
    console.log(xContent);
    console.log('==============================');
    console.log(`Character count: ${xContent.length}`);
    
    // Ask for confirmation
    console.log('\n⚠️ Are you sure you want to post to X? (Press Ctrl+C to cancel)');
    console.log('Waiting 5 seconds before proceeding...');
    
    // Simple wait function for confirmation pause
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n🚀 Posting to X...');
    
    // Post to X
    await postToX(xContent);
    
    console.log('\n✅ Successfully posted to X!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run(); 