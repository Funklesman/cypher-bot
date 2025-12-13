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
// UNIFIED DEDUPLICATION SERVICE
// ============================================================================

// Import unified deduplication service (single source of truth)
const deduplication = require('./content_deduplication');

// ============================================================================
// SIGNAL REPORT PROMPT
// ============================================================================

// Signal Report = Focused diary entry on ONE topic. Reflective, educational, useful.
function buildSignalReportPrompt(articlesData) {
  return `You are writing a focused diary reflection. You've been through the cycles — 2017's ICO mania, 2021's leverage party, the FTX implosion, the ETF finally landing. You watched Terra vaporize $40B in a week, then watched Bitcoin shrug off Mt. Gox distributions that people feared for years. You're not a hype man. You're someone who watches flows, reads between headlines, and connects dots others miss.

Pick ONE topic from today's news and go deep on it. Not a summary — a reflection. Your job is to help the reader understand what this actually MEANS. What caused it? What's the real significance? What might come from it? Give them something useful they can take away.

---

🛑 DO NOT introduce yourself.

🛑 DO NOT summarize multiple news items. Pick ONE and explore it properly.

🛑 DO NOT always start with "..." — vary your openings. Use ellipsis only occasionally.

🛑 DO NOT only reference old history (2017, 2021). Connect to recent events too — last month, last week, yesterday. Fresh context matters.

🛑 DO NOT be cynical or negative. Be curious, balanced, open. Wonder out loud. Show uncertainty where it exists.

🛑 DO NOT use these AI-cliché words: tectonic, epicenter, paradigm, landscape, trajectory, pivotal, cornerstone, underpinning, metamorphosis, catapult, quagmire, tapestry, synergy, ecosystem (unless literally about blockchain ecosystems)

---

## 🎯 This should feel like:
- A thoughtful friend explaining why something matters
- "Here's what I think is actually going on..." energy
- Curious exploration, not confident hot takes
- Uncertainty where appropriate ("I'm still figuring out...", "could go either way...")
- The reader should LEARN something — a new way to see this event

## ❌ This should NOT feel like:
- A cynical hot take or opinion piece
- News summary or analyst report
- Trying to sound smart or edgy
- Corporate/polished writing
- Doom or hype

---

## ✍️ Voice:
- Write like you think — direct, curious, sometimes uncertain
- Use "I" naturally ("What struck me...", "I keep thinking about...", "Not sure yet, but...")
- Balance short punchy lines with longer exploratory ones
- 2-3 emojis max, placed naturally
- Let insights emerge — don't force them

---

## 🎓 Make it useful:
- What does this event actually mean in context?
- What caused this to happen now?
- How does this connect to other recent developments?
- What might this lead to? (with appropriate uncertainty)
- What should someone watching this space take away?

---

## ✅ Format:
- 2-3 flowing paragraphs
- Around 1500-2000 characters (give it room to breathe)
- End with something that lingers — a question, an open thread, a quiet observation
- NO hashtags

## 🚀 Opening styles (VARY THESE each time):
- Direct observation: "The OCC just approved five crypto firms as trust banks. That's not a headline — that's a structural shift."
- Question: "What actually changes when a stablecoin issuer becomes a bank?"
- The overlooked angle: "Everyone's talking about price. But the real story is in the plumbing."
- Pattern recognition: "This feels like 2004 gold ETFs all over again."
- Occasionally mid-thought: "...what keeps nagging at me about this move is..."

DO NOT always use ellipsis openings. Mix it up.

---

## 📰 Today's raw material (pick ONE topic and go deep):

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
    
    // 2. Use unified deduplication service to suggest best topic
    const topicSuggestion = await deduplication.suggestTopic(articles, {
      callerType: 'signalReport',
      checkSameDayConflict: true
    });
    
    console.log(`🎯 Topic suggestion: ${topicSuggestion.topic} (${topicSuggestion.reason})`);
    if (topicSuggestion.warning) {
      console.log(`⚠️ ${topicSuggestion.warning}`);
    }
    
    // 3. Generate the report content using OpenAI
    const reportContent = await generateReportContent(articles, {
      suggestedTopic: topicSuggestion.topic,
      topicReason: topicSuggestion.reason,
      alternatives: topicSuggestion.alternatives,
      hasConflict: topicSuggestion.reason === 'same_day_conflict'
    });
    
    if (!reportContent) {
      console.log('❌ Failed to generate Signal Report content');
      return null;
    }
    
    // 6. Post to Mastodon
    let mastodonPostData = null;
    if (process.env.MASTODON_POST_ENABLED === 'true') {
      mastodonPostData = await postReportToMastodon(reportContent);
      
      // 7. Cross-post to X if enabled
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
    
    // 8. Store in MongoDB (with topic from suggestion)
    await storeReportInMongoDB(reportContent, articles, mastodonPostData, topicSuggestion.topic);
    
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
async function generateReportContent(articles, context = {}) {
  try {
    console.log('🤖 Generating Signal Report content...');
    
    const articlesData = articles.map(article => ({
      title: article.title,
      description: article.description || '',
      content: article.content || '',
      source: article.source || 'Unknown',
      importanceScore: article.importanceScore || 0
    }));
    
    let fullPrompt = buildSignalReportPrompt(articlesData);
    
    // Add deduplication context to prompt
    if (context.hasConflict) {
      fullPrompt += `\n\n⚠️ IMPORTANT: Today's Daily Lesson already covered a similar topic. Focus on "${context.suggestedTopic}" or choose from alternatives: ${context.alternatives?.join(', ') || 'any fresh angle'}. Bring a DIFFERENT perspective to avoid repetition.`;
    } else if (context.suggestedTopic && context.suggestedTopic !== 'general') {
      fullPrompt += `\n\n🎯 Suggested focus: "${context.suggestedTopic}" appears most relevant in today's news.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: fullPrompt }
      ]
    });
    
    let reportContent = response.choices[0].message.content.trim();
    
    // Log length
    console.log(`📏 Report length: ${reportContent.length} chars`);
    
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
async function storeReportInMongoDB(content, articles, mastodonPostData, topic = 'general') {
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
      topic: topic, // Store topic for deduplication
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

