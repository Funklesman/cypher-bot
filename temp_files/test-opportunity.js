/**
 * Test script for the opportunity hashtag feature
 * This script runs a real tweet generation using the opportunity detection
 */

require('dotenv').config();
const botFunctions = require('./src/js/index');

// Sample opportunity article
const opportunityArticle = {
  title: "Regulatory Clarity: New Guidelines for Crypto Businesses Announced",
  description: "Government financial regulators have issued new guidelines that provide clearer frameworks for cryptocurrency businesses to operate. The rules aim to protect consumers while allowing innovation to continue.",
  url: "https://example.com/test-article",
  source: "TestSource",
  publishedAt: new Date()
};

async function runTest() {
  try {
    console.log("🧪 TESTING OPPORTUNITY HASHTAG FEATURE\n");
    console.log(`📰 ARTICLE: ${opportunityArticle.title}`);
    
    // Force sentiment and opportunity values for testing
    const originalAnalyzeContent = botFunctions.analyzeArticleContent;
    botFunctions.analyzeArticleContent = async () => {
      console.log("🔍 Using forced neutral sentiment with opportunity");
      return {
        sentiment: 'neutral',
        isRelevant: true,
        hasOpportunity: true
      };
    };
    
    console.log("\n📝 Generating tweet with opportunity flagged content...");
    const tweetResult = await botFunctions.generateTweet(opportunityArticle);
    
    console.log("\n🔍 RESULTS:");
    console.log(`📊 Prompt type: ${tweetResult.promptType}`);
    console.log("\n📱 GENERATED TWEET:");
    console.log(`${tweetResult.content}`);
    
    // Restore original function
    botFunctions.analyzeArticleContent = originalAnalyzeContent;
    
    // Check if the content includes one of our special hashtags
    const hasOpportunityHashtag = 
      tweetResult.content.includes('#EarlySigns') || 
      tweetResult.content.includes('#HopeSignal');
    
    if (hasOpportunityHashtag) {
      console.log("\n✅ SUCCESS: Tweet contains an opportunity hashtag");
    } else {
      console.log("\n❌ FAILED: Tweet does not contain an opportunity hashtag");
    }
    
  } catch (error) {
    console.error("❌ Test failed with error:", error);
  }
}

// Run the test
runTest(); 