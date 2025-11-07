/**
 * Test Content Optimization
 * 
 * This script tests the AI-based content optimization without posting to any platforms.
 */

require('dotenv').config();
const { optimizeContent } = require('../src/js/crosspost/content-optimizer');
const fs = require('fs').promises;
const path = require('path');

async function run() {
  try {
    // Get crypto diary content
    console.log('Reading crypto diary content...');
    const diaryPath = path.join(__dirname, '../logs/crypto-diary/crypto-diary-2025-03-23.md');
    const diaryContent = await fs.readFile(diaryPath, 'utf8');
    
    console.log('\n🔬 Testing Content Optimization');
    console.log('----------------------------');
    console.log('\nOriginal Content:');
    console.log('---------------');
    console.log(diaryContent);
    console.log(`\nLength: ${diaryContent.length} characters`);
    
    console.log('\nOptimizing for Bluesky (280 characters)...');
    const blueskyContent = await optimizeContent(diaryContent, {
      maxLength: 280,
      platform: 'Bluesky'
    });
    
    console.log('\nBluesky Optimized Content:');
    console.log('------------------------');
    console.log(blueskyContent);
    console.log(`\nLength: ${blueskyContent.length} characters`);
    
    // Save results to a log file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const logDir = path.join(__dirname, '../logs');
    
    // Ensure log directory exists
    await fs.mkdir(logDir, { recursive: true });
    
    const logFile = path.join(logDir, `content-optimization-${timestamp}.log`);
    const logContent = `
CONTENT OPTIMIZATION TEST (${new Date().toLocaleString()})
=======================================================

ORIGINAL CONTENT (${diaryContent.length} characters):
---------------------------------------------------
${diaryContent}

BLUESKY OPTIMIZED CONTENT (${blueskyContent.length} characters):
------------------------------------------------------------
${blueskyContent}

`;
    
    await fs.writeFile(logFile, logContent, 'utf8');
    console.log(`\n✅ Results saved to ${logFile}`);
    
  } catch (error) {
    console.error('Error testing content optimization:', error);
  }
}

run(); 