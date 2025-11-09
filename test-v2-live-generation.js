/**
 * V2 Live Generation Test
 * 
 * Generates real tweets using V2 prompt system with live RSS data.
 * Does NOT post to Mastodon - only tests generation + validation.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Import the main bot module (will use real article fetching)
const bot = require('./src/js/index');

// Override Mastodon posting to prevent actual posts
process.env.MASTODON_POST_ENABLED = 'false';

console.log('🧪 V2 LIVE GENERATION TEST');
console.log('=' .repeat(80));
console.log('📡 Fetching real articles from RSS feeds...');
console.log('🚫 Mastodon posting DISABLED for testing');
console.log('=' .repeat(80) + '\n');

// Create results storage
const results = {
    timestamp: new Date().toISOString(),
    articles_processed: 0,
    tweets_generated: 0,
    tweets_failed: 0,
    colon_labels_caught: 0,
    rewrites_triggered: 0,
    modes_used: {
        'v2-negative': 0,
        'v2-positive': 0,
        'v2-neutral': 0,
        'v2-breaking': 0
    },
    tweets: []
};

// Test configuration
const TEST_CONFIG = {
    articles_to_process: 20,
    max_age_hours: 12,
    output_file: './logs/v2-test-results.json',
    verbose: true
};

/**
 * Main test function
 */
async function runLiveTest() {
    try {
        console.log(`📊 Configuration:`);
        console.log(`   - Articles to process: ${TEST_CONFIG.articles_to_process}`);
        console.log(`   - Max article age: ${TEST_CONFIG.max_age_hours} hours`);
        console.log(`   - Output file: ${TEST_CONFIG.output_file}\n`);
        
        // Fetch real news articles (same function production uses)
        console.log('🔍 Fetching articles...\n');
        const articles = await bot.fetchNews(TEST_CONFIG.max_age_hours);
        
        if (!articles || articles.length === 0) {
            console.log('❌ No articles found. Try increasing max_age_hours.');
            return;
        }
        
        console.log(`✅ Found ${articles.length} articles\n`);
        console.log('=' .repeat(80));
        
        // Process articles one by one
        const articlesToTest = articles.slice(0, TEST_CONFIG.articles_to_process);
        
        for (let i = 0; i < articlesToTest.length; i++) {
            const article = articlesToTest[i];
            results.articles_processed++;
            
            console.log(`\n📰 ARTICLE ${i + 1}/${articlesToTest.length}`);
            console.log('─'.repeat(80));
            console.log(`📝 Title: ${article.title}`);
            console.log(`📊 Importance: ${article.importanceScore || 'N/A'}/10`);
            console.log(`🚨 Urgency: ${article.urgencyScore || 'N/A'}/10`);
            console.log(`📰 Source: ${article.source}`);
            
            try {
                // Generate tweet using V2 system (same function production uses)
                console.log('\n🤖 Generating tweet with V2 system...');
                const result = await bot.generateTweet(article);
                
                if (!result) {
                    console.log('⏭️  Skipped (not crypto-relevant or generation failed)');
                    results.tweets_failed++;
                    continue;
                }
                
                const { content, promptType } = result;
                results.tweets_generated++;
                results.modes_used[promptType] = (results.modes_used[promptType] || 0) + 1;
                
                console.log(`✅ Mode: ${promptType}`);
                console.log(`📏 Length: ${content.length} chars`);
                
                // Validate with regex (same as production)
                const colonLabelRegex = /^(?:[A-Za-z][A-Za-z ]{0,24}|Who|What|Why|Pattern|Translation|Observation)\s*:\s/m;
                const midSentenceRegex = /(?:^|\.\s)([A-Za-z ]{2,24}):\s/g;
                const metaPhraseRegex = /\b(the tell is|follow the money|watch for|the point is|here's the thing|key insight|one observation|one insight|my take|the real story|bottom line|takeaway|net effect|in short|tl;dr)\b/gi;
                
                const hasColonLabel = colonLabelRegex.test(content) || midSentenceRegex.test(content);
                const hasMetaPhrase = metaPhraseRegex.test(content);
                
                if (hasColonLabel) {
                    console.log('⚠️  COLON-LABEL DETECTED (would trigger rewrite in production)');
                    results.colon_labels_caught++;
                    
                    const colonMatches = content.match(colonLabelRegex) || [];
                    const midMatches = content.match(midSentenceRegex) || [];
                    console.log('🔍 Found colon-labels:', [...colonMatches, ...midMatches].join(', '));
                } else {
                    console.log('✅ No colon-labels detected');
                }
                
                if (hasMetaPhrase) {
                    console.log('⚠️  META-PHRASE DETECTED (would trigger rewrite in production)');
                    results.colon_labels_caught++; // Using same counter for simplicity
                    
                    const metaMatches = content.match(metaPhraseRegex) || [];
                    console.log('🔍 Found meta-phrases:', metaMatches.join(', '));
                } else {
                    console.log('✅ No meta-phrases detected');
                }
                
                // Count emojis
                const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
                console.log(`😀 Emojis: ${emojiCount} (expected 2-4)`);
                
                // Character count validation
                if (content.length > 650) {
                    console.log(`⚠️  Exceeds 650 chars by ${content.length - 650}`);
                }
                
                // Display the generated tweet
                console.log('\n🐦 GENERATED TWEET:');
                console.log('┌' + '─'.repeat(78) + '┐');
                content.split('\n').forEach(line => {
                    console.log(`│ ${line.padEnd(77)}│`);
                });
                console.log('└' + '─'.repeat(78) + '┘');
                
                // Store result
                results.tweets.push({
                    article_title: article.title,
                    article_source: article.source,
                    importance_score: article.importanceScore,
                    urgency_score: article.urgencyScore,
                    mode: promptType,
                    tweet_content: content,
                    char_count: content.length,
                    emoji_count: emojiCount,
                    has_colon_labels: hasColonLabel,
                    has_meta_phrases: hasMetaPhrase,
                    validation_passed: !hasColonLabel && !hasMetaPhrase && content.length <= 650 && emojiCount >= 2 && emojiCount <= 4
                });
                
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
                results.tweets_failed++;
            }
        }
        
        // Print summary
        console.log('\n\n' + '='.repeat(80));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`Articles processed: ${results.articles_processed}`);
        console.log(`Tweets generated: ${results.tweets_generated}`);
        console.log(`Tweets failed: ${results.tweets_failed}`);
        console.log(`Colon-labels caught: ${results.colon_labels_caught}`);
        console.log(`\nMode distribution:`);
        Object.entries(results.modes_used).forEach(([mode, count]) => {
            if (count > 0) {
                const percentage = ((count / results.tweets_generated) * 100).toFixed(1);
                console.log(`  ${mode}: ${count} (${percentage}%)`);
            }
        });
        
        // Validation stats
        const validTweets = results.tweets.filter(t => t.validation_passed).length;
        const validationRate = ((validTweets / results.tweets_generated) * 100).toFixed(1);
        console.log(`\n✅ Validation pass rate: ${validationRate}% (${validTweets}/${results.tweets_generated})`);
        
        // Colon-label rate
        const colonRate = ((results.colon_labels_caught / results.tweets_generated) * 100).toFixed(1);
        console.log(`🚨 Colon-label detection rate: ${colonRate}% (${results.colon_labels_caught}/${results.tweets_generated})`);
        
        // Save results to file
        const logsDir = path.dirname(TEST_CONFIG.output_file);
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        fs.writeFileSync(
            TEST_CONFIG.output_file,
            JSON.stringify(results, null, 2)
        );
        
        console.log(`\n💾 Results saved to: ${TEST_CONFIG.output_file}`);
        console.log('\n🎯 Next steps:');
        console.log('1. Review the generated tweets above');
        console.log('2. Check for colon-labels manually');
        console.log('3. Verify tone distinctiveness per mode');
        console.log('4. Compare with V1 system if needed');
        console.log('5. If satisfied, enable Mastodon posting in production\n');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        // Ensure process exits
        process.exit(0);
    }
}

// Run the test
runLiveTest();

