/**
 * Cross-Posting Script
 * 
 * This script allows manual cross-posting to X and Bluesky.
 * It can be run directly from the command line.
 */

require('dotenv').config();
const { postToX } = require('../src/js/crosspost/x-poster');
const { postToBluesky } = require('../src/js/crosspost/bluesky');
const ContentDeduplicator = require('../src/js/content_deduplicator');
const fs = require('fs').promises;
const path = require('path');

// Initialize content deduplicator
const contentDeduplicator = new ContentDeduplicator();

// Get content from command line arguments
const content = process.argv.slice(2).join(' ');

if (!content) {
  console.error('❌ Error: No content provided');
  console.log('Usage: npm run crosspost "Your post content here"');
  process.exit(1);
}

// Show user what will be posted and add a delay for verification
console.log('\n🚀 Manual Cross-Posting Tool');
console.log('---------------------------');
console.log(`Content: "${content}"`);

// Preview with a 5-second delay
console.log('\n⚠️ Cross-posting will begin in 5 seconds. Press Ctrl+C to cancel...');
console.log('⏳ ');

// Use setTimeout to create a delay for user to verify content
setTimeout(async () => {
  console.log('📨 Starting cross-posting...');
  
  try {
    // Check if content has been crossposted recently
    const hasBeenCrossposted = await contentDeduplicator.hasBeenCrossposted(content);
    if (hasBeenCrossposted) {
      console.log('Content has been crossposted recently, skipping...');
      return;
    }

    const results = await crosspost(content);
    
    // Display summary
    console.log('\n📊 Cross-Posting Summary:');
    console.log('------------------------');
    console.log(`Overall: ${results.every(r => r.success) ? '✅ Success' : '❌ Failed'}`);
    
    // X results
    if (results.some(r => r.platform === 'x' && r.success)) {
      console.log('X: ✅ Posted');
    } else if (results.some(r => r.platform === 'x' && r.possiblyPosted)) {
      console.log('X: ⚠️ Post may have been submitted (check manually)');
    } else {
      console.log(`X: ❌ Failed - ${results.find(r => r.platform === 'x')?.error || 'Unknown error'}`);
    }
    
    // Bluesky results
    if (results.some(r => r.platform === 'bluesky' && r.success)) {
      console.log('Bluesky: ✅ Posted');
    } else {
      console.log(`Bluesky: ❌ Failed - ${results.find(r => r.platform === 'bluesky')?.error || 'Unknown error'}`);
    }
    
    console.log('------------------------');
    
    if (results.every(r => r.success)) {
      console.log('\n✅ Cross-posting completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Cross-posting failed. Check the errors above for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Fatal error during cross-posting:', error.message);
    process.exit(1);
  }
}, 5000); // 5 second delay

async function crosspost(content, platforms = ['x', 'bluesky']) {
    try {
        // Check if content has been crossposted recently
        const hasBeenCrossposted = await contentDeduplicator.hasBeenCrossposted(content);
        if (hasBeenCrossposted) {
            console.log('Content has been crossposted recently, skipping...');
            return;
        }

        const results = [];
        
        for (const platform of platforms) {
            try {
                if (platform === 'x') {
                    await postToX(content);
                    results.push({ platform: 'x', success: true });
                } else if (platform === 'bluesky') {
                    await postToBluesky(content);
                    results.push({ platform: 'bluesky', success: true });
                }
            } catch (error) {
                console.error(`Error posting to ${platform}:`, error);
                results.push({ platform, success: false, error: error.message });
            }
        }

        // If at least one platform succeeded, mark as crossposted
        if (results.some(r => r.success)) {
            await contentDeduplicator.markAsCrossposted(content);
        }

        return results;
    } catch (error) {
        console.error('Error in crosspost:', error);
        throw error;
    }
}