/**
 * Signal Report Generator
 * 
 * Creates a daily pattern summary tweet based on the day's crypto news.
 * Runs daily at 10 PM, posts to Mastodon and cross-posts to X.
 * 
 * Adapted from crypto_diary.js architecture but completely independent.
 */

require('dotenv').config();

const OpenAI = require('openai');
const DBClientFactory = require('./db_client_factory');
const cron = require('node-cron');
const Mastodon = require('mastodon-api');
const { MongoClient } = require('mongodb');

// Import cross-posting functionality
let crossPostToSocialMedia = null;
try {
  const crossPoster = require('./crosspost/integrated-cross-poster');
  crossPostToSocialMedia = crossPoster.crossPostToSocialMedia;
  console.log('✅ Cross-posting module loaded for Signal Report');
} catch (e) {
  console.log('⚠️ Cross-posting module not available for Signal Report');
}

// Import bot state checker
let getBotRunningState = null;
function setBotStateChecker(checker) {
  getBotRunningState = checker;
}

// Track next report time
let nextSignalReport = null;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize DB client
const dbClient = DBClientFactory.createClient();

// Initialize Mastodon client if configured
let mastodon;
const isMastodonConfigured = process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_API_URL;

if (isMastodonConfigured && Mastodon) {
  mastodon = new Mastodon({
    access_token: process.env.MASTODON_ACCESS_TOKEN,
    api_url: process.env.MASTODON_API_URL,
    rejectUnauthorized: false
  });
  console.log('✅ Connected to Mastodon API for Signal Report');
}

// ============================================================================
// SIGNAL REPORT PROMPT
// ============================================================================

const signalReportPrompt = `You are a documentary narrator covering crypto. You've watched every major event unfold — collapses, regulatory shifts, product launches, market cycles. Now compress today's signal into ONE observation.

## YOUR TASK
Look at today's articles and find THE ONE PATTERN worth noting. Not a summary — a signal. What did the noise say vs what actually happened?

## FORMAT
- One to two flowing paragraphs
- Under 1500 characters (longer than a tweet, but not a full diary)
- Start with an observation about what happened or what shifted
- Develop the thought with context or comparison
- Include one punch line that's quotable
- 2-4 emojis placed naturally inside text
- End with: "The signal remembers. The noise forgets."
- Add 2 relevant hashtags at the very end

## VOICE
- Grounded, pattern-aware, slightly cinematic
- Observational, not accusatory
- You notice things others miss
- You connect dots, not conspiracies

## DON'T
- List multiple stories (pick THE one pattern)
- Summarize each article one by one
- Predict prices or doom
- Sound like a news anchor or analyst
- Use "Quietly" as an opener
- Start with "Today" or "This week"

## EXAMPLE OUTPUT:
Vanguard flipped the switch on spot Bitcoin ETFs while still calling crypto "speculative" in the fine print 🎭. Same arc gold went through in 2004 — hated as a rock, embraced as a product. In asset management, ideology bends to flows. The signal remembers. The noise forgets. #Bitcoin #ETF`;

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Generate and publish the Signal Report
 */
async function generateSignalReport() {
  console.log('🎬 Generating Signal Report for ' + new Date().toLocaleDateString());
  
  // Check if bot is running
  if (getBotRunningState && !getBotRunningState()) {
    console.log('🛑 Bot is stopped, aborting Signal Report generation');
    return null;
  }
  
  try {
    // 1. Get today's articles from post_history
    const articles = await getTodaysArticles();
    
    if (!articles || articles.length === 0) {
      console.log('❌ No articles found for Signal Report');
      return null;
    }
    
    console.log(`📚 Found ${articles.length} articles for Signal Report`);
    
    // 2. Generate the report content using OpenAI
    const reportContent = await generateReportContent(articles);
    
    if (!reportContent) {
      console.log('❌ Failed to generate Signal Report content');
      return null;
    }
    
    // 3. Post to Mastodon
    let mastodonPostData = null;
    if (process.env.MASTODON_POST_ENABLED === 'true') {
      mastodonPostData = await postReportToMastodon(reportContent);
      
      // 4. Cross-post to X if enabled
      if (mastodonPostData && crossPostToSocialMedia && process.env.X_POST_ENABLED === 'true') {
        try {
          await crossPostToSocialMedia(mastodonPostData, {
            includeMedia: false,
            noHashtags: process.env.X_POST_NOHASHTAGS === 'true',
            maxRetries: 3
          });
        } catch (crossPostError) {
          console.error('⚠️ Cross-posting Signal Report failed:', crossPostError.message);
        }
      }
    }
    
    // 5. Store in MongoDB
    await storeReportInMongoDB(reportContent, articles, mastodonPostData);
    
    return reportContent;
  } catch (error) {
    console.error('❌ Error generating Signal Report:', error);
    return null;
  }
}

/**
 * Get articles from today (last 24 hours)
 */
async function getTodaysArticles() {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1); // Last 24 hours
    
    console.log(`Looking for articles from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const articles = await dbClient.getPostHistoryBetweenDates(startDate, endDate);
    
    if (!articles || articles.length === 0) {
      return [];
    }
    
    // Sort by importance score and take top 8
    const sortedArticles = articles
      .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
      .slice(0, 8);
    
    console.log(`📊 Selected top ${sortedArticles.length} articles by importance`);
    return sortedArticles;
  } catch (error) {
    console.error('❌ Error fetching today\'s articles:', error);
    return [];
  }
}

/**
 * Generate report content using OpenAI
 */
async function generateReportContent(articles) {
  try {
    console.log('🤖 Generating Signal Report content...');
    
    const articlesData = articles.map(article => ({
      title: article.title,
      description: article.description || '',
      content: article.content || '',
      source: article.source || 'Unknown',
      importanceScore: article.importanceScore || 0
    }));
    
    const fullPrompt = `${signalReportPrompt}

## TODAY'S RAW MATERIAL (pick ONE pattern from these):

${JSON.stringify(articlesData, null, 2)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        { role: "system", content: fullPrompt }
      ]
    });
    
    let reportContent = response.choices[0].message.content.trim();
    
    // Validate length
    if (reportContent.length > 1600) {
      console.log(`⚠️ Report too long (${reportContent.length} chars), regenerating...`);
      // Try again with stricter instruction
      const retryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 700,
        messages: [
          { role: "system", content: fullPrompt + "\n\n⚠️ CRITICAL: Keep under 1400 characters. Be more concise." }
        ]
      });
      reportContent = retryResponse.choices[0].message.content.trim();
    }
    
    console.log(`✅ Generated Signal Report (${reportContent.length} characters)`);
    console.log('\n--- Preview ---');
    console.log(reportContent);
    
    return reportContent;
  } catch (error) {
    console.error('❌ Error generating report content:', error);
    return null;
  }
}

/**
 * Post report to Mastodon
 */
async function postReportToMastodon(content) {
  if (!isMastodonConfigured || !mastodon) {
    console.log('❌ Mastodon not configured, skipping post');
    return null;
  }
  
  try {
    console.log('🚀 Posting Signal Report to Mastodon...');
    
    const status = `🎬 THE SIGNAL REPORT\n\n${content}`;
    
    const response = await mastodon.post('statuses', {
      status: status,
      visibility: 'public'
    });
    
    if (!response || !response.data) {
      console.error('❌ Mastodon API returned invalid response');
      return null;
    }
    
    console.log('✅ Posted Signal Report to Mastodon:', response.data.url);
    return response.data;
  } catch (error) {
    console.error('❌ Error posting to Mastodon:', error);
    return null;
  }
}

/**
 * Store report in MongoDB
 */
async function storeReportInMongoDB(content, articles, mastodonPostData) {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) return null;
    
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db('TweetBot');
    const collection = db.collection('signal_reports');
    
    const reportEntry = {
      type: 'signal_report',
      content: content,
      articleCount: articles.length,
      articles: articles.map(a => ({
        title: a.title,
        source: a.source,
        importanceScore: a.importanceScore
      })),
      postedAt: new Date(),
      postUrl: mastodonPostData?.url || null,
      postId: mastodonPostData?.id || null,
      characterCount: content.length
    };
    
    const result = await collection.insertOne(reportEntry);
    console.log('✅ Stored Signal Report in MongoDB:', result.insertedId);
    
    await client.close();
    return result;
  } catch (error) {
    console.error('❌ Error storing report in MongoDB:', error);
    return null;
  }
}

// ============================================================================
// SCHEDULING
// ============================================================================

/**
 * Calculate next report time
 */
function calculateNextReportTime() {
  const now = new Date();
  const next = new Date();
  
  // Set to 10 PM today
  next.setHours(22, 0, 0, 0);
  
  // If it's already past 10 PM today, move to tomorrow
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Schedule the Signal Report to run daily at 10 PM
 */
function scheduleSignalReport() {
  nextSignalReport = calculateNextReportTime();
  console.log(`📅 Next Signal Report scheduled for: ${nextSignalReport.toLocaleString()}`);
  
  // Schedule for 10 PM local time every day
  cron.schedule('0 22 * * *', async () => {
    console.log('⏰ Running scheduled Signal Report...');
    await generateSignalReport();
    nextSignalReport = calculateNextReportTime();
    console.log(`📅 Next Signal Report scheduled for: ${nextSignalReport.toLocaleString()}`);
  });
  
  console.log('📅 Scheduled Signal Report for 10 PM daily');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generateSignalReport,
  scheduleSignalReport,
  setBotStateChecker,
  get nextSignalReport() { return nextSignalReport; }
};

