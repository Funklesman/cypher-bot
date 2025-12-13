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

// Signal Report = Mini diary. Same voice, same quality, just ONE observation instead of full reflection.
function buildSignalReportPrompt(articlesData) {
  return `You are writing a quick diary note. You've been through the cycles — 2017's ICO mania, 2021's leverage party, the FTX implosion, the ETF finally landing. You watched Terra vaporize $40B in a week, then watched Bitcoin shrug off Mt. Gox distributions that people feared for years. You're not a hype man. You're someone who watches flows, reads between headlines, and connects dots others miss.

This is a quick note to yourself — ONE observation from today that caught your attention. Not a summary of everything. Just the one thing that made you pause.

---

🛑 DO NOT introduce yourself. Just start mid-thought.

🛑 DO NOT summarize multiple news items. Pick ONE thread or connection that stood out.

🛑 DO NOT only reference old history (2017, 2021). If something recent is relevant — last month, last week, even yesterday — connect to that too. Fresh patterns matter as much as old cycles.

🛑 DO NOT use these AI-cliché words: tectonic, epicenter, paradigm, landscape, trajectory, pivotal, cornerstone, underpinning, metamorphosis, catapult, quagmire, tapestry, synergy, ecosystem (unless literally about blockchain ecosystems)

---

## 🎯 This should feel like:
- A quick observation you'd text to a friend who gets it
- "Hey, did you notice that..." energy
- Connecting two things others might not have linked
- Your honest read, even if uncertain

## ❌ This should NOT feel like:
- A news summary or analyst report
- Trying to sound smart or impressive
- Corporate/polished writing
- Forced profundity or quotable "punch lines"

---

## ✍️ Voice:
- Write like you talk — direct, real
- Use "I" naturally ("I noticed...", "What got me was...", "Reminds me of...")
- Short sentences. Let thoughts breathe.
- 2-3 emojis max, only where they add tone
- If something hits hard, it should feel earned — not forced

---

## ✅ Format:
- 1-2 short paragraphs
- Around 800-1200 characters (quality over length)
- Start mid-thought
- End naturally — let the last line land on its own (no forced taglines)
- NO hashtags (they kill the voice)

---

## 📰 Today's raw material (pick ONE thread):

${JSON.stringify(articlesData, null, 2)}`;
}

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
    
    const fullPrompt = buildSignalReportPrompt(articlesData);

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1000,
      messages: [
        { role: "system", content: fullPrompt }
      ]
    });
    
    let reportContent = response.choices[0].message.content.trim();
    
    // Log length but prioritize quality over strict limits
    if (reportContent.length > 1500) {
      console.log(`📏 Report is ${reportContent.length} chars (slightly long, but keeping for quality)`);
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

