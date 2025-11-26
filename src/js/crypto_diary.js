/**
 * Crypto Diary Generator
 * 
 * Creates a daily summary of the most important crypto news
 * in the voice of The Crypto Professor from Kodex Academy.
 */

// Load environment variables
require('dotenv').config();

const OpenAI = require('openai');
const DBClientFactory = require('./db_client_factory');
const WebflowClient = require('./webflow_client');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const Mastodon = require('mastodon-api');
const { MongoClient } = require('mongodb');

// Import bot state checker
let getBotRunningState = null;
function setBotStateChecker(checker) {
  getBotRunningState = checker;
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize DB client
const dbClient = DBClientFactory.createClient();

// Initialize Webflow client
const webflowClient = new WebflowClient();

// Initialize Mastodon client if configured
let mastodon;
const isMastodonConfigured = process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_API_URL;

if (isMastodonConfigured && Mastodon) {
  mastodon = new Mastodon({
    access_token: process.env.MASTODON_ACCESS_TOKEN,
    api_url: process.env.MASTODON_API_URL,
    // TEMPORARY: Bypass SSL certificate verification for expired cert
    rejectUnauthorized: false
  });
  console.log('✅ Connected to Mastodon API for Crypto Diary (SSL bypass enabled)');
} else {
  console.log('⚠️ Mastodon integration not configured for Crypto Diary');
}

/**
 * The main function to generate and publish the Crypto Diary
 */
async function generateCryptoDiary() {
  console.log('🔍 Generating Crypto Diary for ' + new Date().toLocaleDateString());
  
  // Check if bot is running
  if (getBotRunningState && !getBotRunningState()) {
    console.log('🛑 Bot is stopped, aborting diary generation');
    return;
  }
  
  try {
    // 1. Get recent articles from the post_history collection
    const articles = await getRecentImportantArticles();
    
    if (!articles || articles.length === 0) {
      console.log('❌ No recent articles found for diary generation');
      return null;
    }
    
    console.log(`📚 Found ${articles.length} articles for diary generation`);
    
    // 2. Generate the diary content using OpenAI
    const diaryContent = await generateDiaryContent(articles);
    
    if (!diaryContent) {
      console.log('❌ Failed to generate diary content');
      return null;
    }
    
    // 3. Save the diary content to a file
    saveDiaryToFile(diaryContent);
    
    // 4. Post to Mastodon if enabled
    let mastodonPostData = null;
    if (process.env.MASTODON_POST_ENABLED === 'true') {
      mastodonPostData = await postDiaryToMastodon(diaryContent);
    } else {
      console.log('⚠️ Mastodon posting disabled - set MASTODON_POST_ENABLED=true to enable');
    }
    
    // 5. Post to Webflow CMS if enabled
    if (process.env.WEBFLOW_POST_ENABLED === 'true') {
      await postDiaryToWebflow(diaryContent, articles);
    } else {
      console.log('⚠️ Webflow posting disabled - set WEBFLOW_POST_ENABLED=true to enable');
    }
    
    // 6. Store diary entry in MongoDB for dashboard tracking
    await storeDiaryInMongoDB(diaryContent, articles, mastodonPostData);
    
    return diaryContent;
  } catch (error) {
    console.error('❌ Error generating crypto diary:', error);
    return null;
  }
}

/**
 * Retrieves the most important articles from the last 2 days
 */
async function getRecentImportantArticles() {
  try {
    // Query the database for articles from the last 2 days (dynamic)
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 2); // Go back 2 days
    
    console.log(`Looking for articles from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    // Get articles from post_history collection
    const articles = await dbClient.getPostHistoryBetweenDates(startDate, endDate);
    
    if (!articles || articles.length === 0) {
      console.log('❌ No articles found in the specified date range');
      return [];
    }
    
    console.log(`📊 Found ${articles.length} total articles in the specified date range`);
    
    // Sort by importance score (descending)
    const sortedArticles = articles.sort((a, b) => {
      const scoreA = a.importanceScore || 0;
      const scoreB = b.importanceScore || 0;
      return scoreB - scoreA;
    });

    // Group articles by day
    const articlesByDay = {};
    sortedArticles.forEach(article => {
      const date = new Date(article.createdAt || article.postedAt || new Date());
      const dayKey = date.toISOString().split('T')[0];
      if (!articlesByDay[dayKey]) {
        articlesByDay[dayKey] = [];
      }
      articlesByDay[dayKey].push(article);
    });

    // Get the days in order
    const days = Object.keys(articlesByDay).sort();
    
    // Log articles per day
    days.forEach(day => {
      console.log(`📅 Found ${articlesByDay[day].length} articles for ${day}`);
    });
    
    // Select the top 10 articles overall (already sorted by importance)
    const selectedArticles = sortedArticles.slice(0, 10);
    
    console.log(`📚 Selected top 10 articles from ${days.length} days: ${days.join(', ')}`);
    return selectedArticles;
  } catch (error) {
    console.error('❌ Error fetching articles:', error);
    return [];
  }
}

/**
 * Generate diary content using OpenAI
 */
async function generateDiaryContent(articles) {
  try {
    console.log('🤖 Generating diary content using OpenAI...');
    
    // Prepare articles data for the prompt
    const articlesData = articles.map(article => ({
      title: article.title,
      description: article.description || '',
      content: article.content || '',
      source: article.source || 'Unknown',
      importanceScore: article.importanceScore || 0,
      date: article.postedAt || article.createdAt || new Date()
    }));
    
    // Create the prompt for diary generation with dynamic dates
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 2); // Go back 2 days
    
    const endDateStr = endDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const startDateStr = startDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    const prompt = `You are writing a personal crypto diary entry. You've been through the cycles — 2017, 2021, the collapses, the comebacks. You're not a hype man. You're someone who watches flows, reads between headlines, and connects dots others miss.

This is YOUR diary. You're writing to yourself at the end of a long couple of days, processing what you saw. It's not a report. It's not a summary. It's you thinking out loud on paper.

---

## 📅 Entry period: ${startDateStr} to ${endDateStr}

🛑 DO NOT introduce yourself. No "Hi, I'm..." or "As someone who...". Just start writing like you're mid-thought.

🛑 DO NOT just rephrase the articles below. Use them as raw material, but ADD:
- What the articles DON'T say but you noticed
- How these events connect to larger patterns you've seen before
- Your gut read on what this means (even if you're uncertain)
- What reminded you of past cycles or moments
- What made you pause or reconsider something

---

## 🎯 This should feel like:
- Late-night thoughts after watching the market all day
- Connecting dots between seemingly unrelated events
- Noticing something subtle that most people missed
- Honest uncertainty when you don't know
- Occasional sharp insights that just land

## ❌ This should NOT feel like:
- A news roundup or summary
- Going through articles one by one
- Corporate or polished writing
- Announcing sections or themes
- Teaching mode (save that for class)

---

## ✍️ Voice:
- Write like you think — direct, sometimes fragmented, occasionally poetic
- Use "I" naturally (e.g., "I keep coming back to...", "What struck me was...", "I've seen this before...")
- Let yourself speculate ("If this holds...", "My read is...", "Could be nothing, but...")
- Mix short punchy lines with longer reflective ones
- 3-5 emojis, placed naturally where they add tone
- One or two lines that hit hard — the kind you'd underline if this were a real journal

---

## 🔗 Connect the dots:
The articles below are separate news items. Your job is to find the thread between them — or notice when there isn't one. What's the story underneath the stories?

Think about:
- Who's moving money and why
- What infrastructure changed
- What shifted in how people talk about this space
- What feels different from 6 months ago

---

## ✅ Format:
- Markdown for web/Mastodon
- Max 1500 words
- Flowing paragraphs (no bullets, no headers in the output)
- Start mid-thought, end with something that lingers

---

## 📰 Raw material (news from ${startDateStr} to ${endDateStr}):

${JSON.stringify(articlesData, null, 2)}`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 3500,
      messages: [
        { role: "system", content: prompt }
      ]
    });
    
    // Extract the generated content
    const diaryContent = response.choices[0].message.content.trim();
    
    // Post-process to remove any date at the beginning if OpenAI added it despite instructions
    const processedContent = diaryContent
      .replace(/^(\*\*)?(\d{1,2}\/\d{1,2}\/\d{2,4})(\*\*)?(\n+)?/, '') // Remove date in **MM/DD/YYYY** format
      .replace(/^(\*\*)?[A-Z][a-z]+ \d{1,2}(st|nd|rd|th)?,? \d{4}(\*\*)?(\n+)?/, '') // Remove date in **Month DDth, YYYY** format
      .trim();
    
    console.log(`✅ Generated diary content (${processedContent.length} characters)`);
    console.log('\n--- Preview ---');
    console.log(processedContent.substring(0, 200) + '...');
    
    return processedContent;
  } catch (error) {
    console.error('❌ Error generating diary content with OpenAI:', error);
    return null;
  }
}

/**
 * Save the diary content to a file for website use
 */
function saveDiaryToFile(content) {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create crypto-diary directory if it doesn't exist
    const diaryDir = path.join(logsDir, 'crypto-diary');
    if (!fs.existsSync(diaryDir)) {
      fs.mkdirSync(diaryDir, { recursive: true });
    }
    
    // Generate filename with current date
    const date = new Date();
    const filename = `crypto-diary-${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.md`;
    const filePath = path.join(diaryDir, filename);
    
    // Write content to file
    fs.writeFileSync(filePath, content);
    
    console.log(`✅ Saved diary content to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('❌ Error saving diary to file:', error);
    return null;
  }
}

/**
 * Post the diary content to Mastodon
 */
async function postDiaryToMastodon(content) {
  if (!isMastodonConfigured || !mastodon) {
    console.log('❌ Mastodon not configured, skipping post');
    return null;
  }
  
  try {
    console.log(`🚀 Posting Crypto Diary to Mastodon using API URL: ${process.env.MASTODON_API_URL}`);
    
    // Prepare status with header
    const status = `📔 CRYPTO DIARY: ${new Date().toLocaleDateString()} 📔\n\n${content}`;
    
    // Post to Mastodon
    const response = await mastodon.post('statuses', {
      status: status,
      visibility: 'public'
    });
    
    if (!response || !response.data) {
      console.error('❌ Mastodon API returned invalid response structure:', response);
      return null;
    }
    
    console.log('✅ Posted Crypto Diary to Mastodon:', response.data.url);
    return response.data;
  } catch (error) {
    console.error('❌ Error posting diary to Mastodon:', error);
    return null;
  }
}

/**
 * Schedule the diary to run every 2 days at 8 PM
 */
function scheduleDailyCryptoDiary() {
  let dayCounter = 0;
  
  // Schedule for 8 PM local time every day, but only execute every 2 days
  cron.schedule('0 20 * * *', async () => {
    dayCounter++;
    
    if (dayCounter % 2 === 0) {
      console.log('⏰ Running scheduled Crypto Diary generation (every 2 days)...');
    await generateCryptoDiary();
    } else {
      console.log('⏸️ Skipping Crypto Diary today (runs every 2 days)');
    }
  });
  
  console.log('📅 Scheduled Crypto Diary generation for 8 PM every 2 days');
}

/**
 * Post diary content to Webflow CMS
 */
async function postDiaryToWebflow(diaryContent, articles) {
  try {
    console.log('📤 Posting Crypto Diary to Webflow CMS...');
    
    // Prepare metadata from articles
    const metadata = {
      'article-count': articles.length,
      'avg-importance': articles.length > 0 
        ? Math.round(articles.reduce((sum, a) => sum + (a.importanceScore || 0), 0) / articles.length * 10) / 10
        : 0,
      'top-sources': [...new Set(articles.map(a => a.source).filter(Boolean))].slice(0, 5).join(', '),
      'topics-covered': [...new Set(articles.map(a => a.topic).filter(Boolean))].slice(0, 5).join(', ')
    };
    
    // Post to Webflow
    const result = await webflowClient.createDiaryEntry(diaryContent, metadata);
    
    if (result) {
      console.log('✅ Crypto Diary posted to Webflow successfully');
      console.log(`📝 Entry ID: ${result._id}`);
      return result;
    } else {
      console.log('❌ Failed to post diary to Webflow');
      return null;
    }
  } catch (error) {
    console.error('❌ Error posting diary to Webflow:', error);
    return null;
  }
}

/**
 * Store diary entry in MongoDB for dashboard tracking
 */
async function storeDiaryInMongoDB(diaryContent, articles, mastodonPostData) {
  try {
    console.log('💾 Storing diary entry in MongoDB...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('❌ MongoDB URI not configured');
      return null;
    }
    
    // Connect to MongoDB
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db('TweetBot');
    const collection = db.collection('crypto_diary_entries');
    
    const diaryEntry = {
      content: diaryContent,
      articleCount: articles.length,
      articles: articles.map(a => ({
        title: a.title,
        source: a.source,
        url: a.url,
        importanceScore: a.importanceScore
      })),
      postedAt: new Date(),
      publishedAt: new Date(), // For consistency with API queries
      postUrl: mastodonPostData?.url || null,
      postId: mastodonPostData?.id || null,
      characterCount: diaryContent.length
    };
    
    const result = await collection.insertOne(diaryEntry);
    console.log('✅ Stored diary entry in MongoDB:', result.insertedId);
    
    await client.close();
    return result;
  } catch (error) {
    console.error('❌ Error storing diary in MongoDB:', error);
    return null;
  }
}

// Export functions
module.exports = {
  generateCryptoDiary,
  scheduleDailyCryptoDiary,
  setBotStateChecker
}; 