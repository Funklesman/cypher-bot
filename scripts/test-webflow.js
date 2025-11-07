#!/usr/bin/env node

/**
 * Test Webflow Integration
 * 
 * This script helps you test and configure the Webflow CMS integration
 * for your crypto diary entries.
 */

require('dotenv').config();
const WebflowClient = require('../src/js/webflow_client');

async function main() {
  console.log('🧪 Testing Webflow Integration');
  console.log('========================================\n');

  // Initialize client
  const webflowClient = new WebflowClient();

  if (!webflowClient.isConfigured) {
    console.log('❌ Webflow not configured. Please add these to your .env file:');
    console.log('');
    console.log('WEBFLOW_API_TOKEN=your_api_token_here');
    console.log('WEBFLOW_SITE_ID=your_site_id_here');
    console.log('WEBFLOW_COLLECTION_ID=your_collection_id_here');
    console.log('WEBFLOW_POST_ENABLED=true');
    console.log('WEBFLOW_AUTO_PUBLISH=false  # Set to true to auto-publish site');
    console.log('');
    console.log('📚 How to get these values:');
    console.log('1. Go to https://webflow.com/dashboard/account/general');
    console.log('2. Generate an API token');
    console.log('3. Find your Site ID in your site settings');
    console.log('4. Create a collection for diary entries and get Collection ID');
    console.log('');
    return;
  }

  try {
    // Test 1: Connection test
    console.log('🔍 Test 1: Testing connection...');
    const connectionTest = await webflowClient.testConnection();
    if (!connectionTest) {
      console.log('❌ Connection failed. Check your API token and Site ID.');
      return;
    }

    // Test 2: Collection info
    console.log('\n🔍 Test 2: Getting collection info...');
    const collectionInfo = await webflowClient.getCollectionInfo();
    if (!collectionInfo) {
      console.log('❌ Collection access failed. Check your Collection ID.');
      return;
    }

    // Test 3: Create a test diary entry
    console.log('\n🔍 Test 3: Creating test diary entry...');
    const testContent = `**Test Crypto Diary Entry - API v2**

This is a test entry to verify Webflow API v2 integration is working correctly. 📝

The crypto market showed mixed signals today, with Bitcoin consolidating around key support levels while altcoins demonstrated varied performance patterns. 📊

**Key Developments:**
- API v2 integration working properly
- Automated posting from crypto diary generator  
- Rich content formatting preserved

This automated posting will help streamline content workflow between analysis and publication. ⚡

How will automated content publishing enhance crypto education delivery? 🤔`;

    const testMetadata = {
      'article-count': 5,
      'avg-importance': 7.2,
      'top-sources': 'CoinDesk, Decrypt, TheBlock',
      'topics-covered': 'Bitcoin, DeFi, Regulation'
    };

    const result = await webflowClient.createDiaryEntry(testContent, testMetadata);
    
    if (result) {
      console.log('✅ Test diary entry created successfully!');
      console.log(`📝 Entry ID: ${result.id}`);
      console.log(`🔗 You should see this entry in your Webflow CMS`);
    } else {
      console.log('❌ Failed to create test entry');
    }

    console.log('\n========================================');
    console.log('🎉 Webflow integration test complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Check your Webflow CMS for the test entry');
    console.log('2. Customize collection fields as needed');
    console.log('3. Set WEBFLOW_POST_ENABLED=true in .env');
    console.log('4. Run diary generation to auto-post to Webflow');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };