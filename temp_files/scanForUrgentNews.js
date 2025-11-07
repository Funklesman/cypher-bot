/**
 * Urgent News Detection Module
 * 
 * Scans for high-impact crypto news every 30 minutes and posts
 * urgent stories immediately with special formatting.
 */

require('dotenv').config();
const OpenAI = require('openai');
const { MongoClient } = require('mongodb');
const Parser = require('rss-parser');
const axios = require('axios');
const Mastodon = require('mastodon-api');

// Constants
const URGENCY_THRESHOLD = process.env.URGENCY_THRESHOLD || 7; // Default threshold for urgent news
const SCAN_HOURS = process.env.SCAN_HOURS || 4; // How many hours back to scan

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';
let db;
let articlesCollection;
let urgentNewsCollection;

// OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mastodon API client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: process.env.MASTODON_API_URL
});

// Initialize MongoDB connection
async function connectToMongoDB() {
  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    db = client.db(dbName);
    articlesCollection = db.collection('processedArticles');
    urgentNewsCollection = db.collection('urgentNews');
    
    // Create indexes
    await articlesCollection.createIndex({ url: 1 }, { unique: true });
    await urgentNewsCollection.createIndex({ url: 1 }, { unique: true });
    console.log('✅ MongoDB collections initialized');
    return true;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error);
    return false;
  }
}

// Fetch news from multiple sources
async function fetchRecentNews() {
  try {
    const parser = new Parser();
    const results = [];
    
    // Calculate the cutoff time (X hours ago)
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - SCAN_HOURS);
    
    // 1. Fetch from CoinTelegraph
    try {
      console.log('Fetching from CoinTelegraph RSS...');
      const feed = await parser.parseURL('https://cointelegraph.com/rss');
      const articles = feed.items
        .map(item => ({
          title: item.title,
          description: item.contentSnippet || item.content,
          url: item.link,
          source: 'CoinTelegraph',
          publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }))
        .filter(article => article.publishedAt >= cutoffTime);
      results.push(...articles);
    } catch (error) {
      console.error('Error fetching from CoinTelegraph:', error);
    }
    
    // 2. Fetch from CoinDesk
    try {
      console.log('Fetching from CoinDesk RSS...');
      const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
      const articles = feed.items
        .map(item => ({
          title: item.title,
          description: item.contentSnippet || item.content,
          url: item.link,
          source: 'CoinDesk',
          publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }))
        .filter(article => article.publishedAt >= cutoffTime);
      results.push(...articles);
    } catch (error) {
      console.error('Error fetching from CoinDesk:', error);
    }
    
    // 3. Fetch from Defiant
    try {
      console.log('Fetching from Defiant RSS...');
      const feed = await parser.parseURL('https://thedefiant.io/feed');
      const articles = feed.items
        .map(item => ({
          title: item.title,
          description: item.contentSnippet || item.content,
          url: item.link,
          source: 'Defiant',
          publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }))
        .filter(article => article.publishedAt >= cutoffTime);
      results.push(...articles);
    } catch (error) {
      console.error('Error fetching from Defiant:', error);
    }
    
    // 4. Fetch from NewsAPI
    try {
      console.log('Fetching from NewsAPI...');
      const response = await axios.get('https://newsapi.org/v2/everything', {
        params: {
          q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain',
          language: 'en',
          sortBy: 'publishedAt',
          from: new Date(cutoffTime).toISOString().split('T')[0],
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      
      const articles = response.data.articles
        .map((article) => ({
          title: article.title,
          description: article.description,
          url: article.url,
          source: 'NewsAPI',
          publishedAt: new Date(article.publishedAt || Date.now()),
        }))
        .filter(article => article.publishedAt >= cutoffTime);
      
      results.push(...articles);
    } catch (error) {
      console.error('Error fetching from NewsAPI:', error);
    }
    
    // Sort by publication date (newest first)
    results.sort((a, b) => b.publishedAt - a.publishedAt);
    
    console.log(`📊 Found ${results.length} articles from the last ${SCAN_HOURS} hours`);
    return results;
  } catch (error) {
    console.error('Error fetching recent news:', error);
    return [];
  }
}

// Check if an article has been processed
async function isArticleProcessed(url) {
  if (!articlesCollection) return false;
  
  try {
    // Check both collections for this URL
    const existingArticle = await articlesCollection.findOne({ url });
    const existingUrgentNews = await urgentNewsCollection.findOne({ url });
    return !!(existingArticle || existingUrgentNews);
  } catch (error) {
    console.error('❌ Error checking if article was processed:', error);
    return false;
  }
}

// Evaluate urgency of an article using OpenAI
async function evaluateUrgency(article) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: `You are an expert cryptocurrency analyst who evaluates news for urgency and impact. 
          Analyze the provided article and rate it on a scale of 1-10 for urgency, where:
          
          1-3 = Regular news, no urgency
          4-6 = Important developments, but not time-sensitive
          7-8 = Urgent news with significant short-term impact
          9-10 = Critical breaking news with major immediate impact
          
          Consider the following factors:
          - Time sensitivity (is action required within hours?)
          - Market impact potential (could this move prices significantly?)
          - Regulatory significance (major regulatory changes or enforcement)
          - Community interest level (would most crypto users need to know this?)
          
          Provide your response in JSON format with the following fields:
          - urgencyScore: A number from 1 to 10
          - justification: A brief explanation of your score
          - isUrgent: A boolean (true if score ≥ 7, false otherwise)
          - keywords: Array of 2-3 key terms that make this urgent`
        },
        {
          role: "user",
          content: `Title: ${article.title}
Description: ${article.description}
Source: ${article.source}
Published: ${article.publishedAt.toISOString()}

Evaluate the urgency of this crypto news article.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    try {
      const result = JSON.parse(response.choices[0].message.content.trim());
      console.log(`🔍 Urgency evaluation: ${result.urgencyScore}/10`);
      console.log(`📋 Justification: ${result.justification}`);
      return result;
    } catch (error) {
      console.error('Error parsing urgency evaluation:', error);
      return {
        urgencyScore: 1,
        justification: "Error in evaluation",
        isUrgent: false,
        keywords: []
      };
    }
  } catch (error) {
    console.error('Error evaluating urgency:', error);
    return {
      urgencyScore: 1,
      justification: "Error in evaluation",
      isUrgent: false,
      keywords: []
    };
  }
}

// Analyze sentiment of urgent content
async function analyzeUrgentSentiment(article) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You analyze cryptocurrency news sentiment. Respond with only one word: 'positive', 'negative', or 'neutral'."
        },
        {
          role: "user",
          content: `Analyze the sentiment of this urgent crypto news:
Title: ${article.title}
Description: ${article.description}`
        }
      ],
      temperature: 0.1,
    });
    
    const sentiment = response.choices[0].message.content.trim().toLowerCase();
    
    // Extract the sentiment word from the response
    let finalSentiment = 'neutral';
    if (sentiment.includes('positive')) finalSentiment = 'positive';
    if (sentiment.includes('negative')) finalSentiment = 'negative';
    
    console.log(`🔍 Urgent News Sentiment Analysis: ${finalSentiment}`);
    return finalSentiment;
  } catch (error) {
    console.error('Error analyzing sentiment:', error);
    return 'neutral';
  }
}

// Pick the appropriate urgency emoji based on score
function getUrgencyEmoji(score) {
  if (score >= 9) return "🚨"; // Red alert
  if (score >= 7) return "⚠️"; // Warning
  return "🔔"; // Regular notification
}

// Generate hashtags for urgent news
async function generateUrgentHashtags(article, keywords) {
  try {
    // Start with keyword-based hashtags
    const baseHashtags = keywords.map(word => `#${word.replace(/\s+/g, '')}`);
    
    // Add standard crypto hashtags
    const standardHashtags = ["#Crypto", "#CryptoNews", "#Breaking"];
    
    // Combine and limit to 3-4 hashtags
    return [...new Set([...baseHashtags, ...standardHashtags])].slice(0, 4);
  } catch (error) {
    console.error('Error generating hashtags:', error);
    return ["#Crypto", "#Breaking"];
  }
}

// Add the existing prompt templates from bot.js with new urgent variations
const negativePrompts = [
  `
  Using the following news headline and context, craft a tweet that is raw, unapologetic, and deeply personal. Write as if you're venting your deep disappointment and frustration while reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express deep skepticism and analytical concern about the news while subtly challenging the status quo and questioning established narratives without overtly calling out governmental control. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Use clear, accessible language with occasional technical terms (explain briefly if needed). Add relevant emojis to emphasize key points and emotions (2-4 emojis total). Conclude with a single open-ended question OR call-to-action (choose only one), and hint at centralized power issues subtly between the lines. Keep it under 650 characters. 
  Include these hashtags at the end:`,
  `
  Using the following news headline and context, write a tweet that is brutally honest, raw, and reflective of my deep disillusionment and skepticism. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a personal moment from your journey that exposes the flaws and pitfalls you've witnessed, and deliver your critical insights without sugarcoating the reality. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Keep technical language accessible and provide brief explanations for any jargon. Include 2-4 strategic emojis that enhance your emotional expression. Conclude with a single thought-provoking question OR call-to-action (choose only one), and subtly question centralization and power dynamics without stating them outright. Limit the tweet to 650 characters. 
  Include these hashtags at the end:
  `,
  // New emergency-focused negative prompt
  `
  Using the following URGENT news headline and context, craft a tweet that conveys both the immediate severity of the situation and your raw, personal reaction as "The Crypto Professor" from Cypher University. Begin with "🚨 URGENT:" followed by a direct, impactful warning about what's happening. Express your genuine concern and frustration with the situation while maintaining analytical clarity. Keep technical terms minimal and briefly explained. Include 2-3 urgent-focused emojis that reinforce the critical nature of this news. Conclude with a clear, direct call to action appropriate for this emergency situation. Make the time-sensitivity clear without being alarmist. Keep it under 650 characters.
  Include these hashtags at the end:
  `
];

const positivePrompts = [
  `
  Using the following news headline and context, craft a tweet that is raw, unapologetic, and deeply personal. Write as if you're venting your excitement while reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express hope for the future while remaining skeptical and analytical about events, subtly challenging the status quo and pushing back against the old guard without overtly mentioning governmental overreach. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Use clear, accessible language with occasional technical terms (explain briefly if needed). Include 2-4 well-placed emojis that highlight your excitement and energy. Conclude with a single open-ended question OR call-to-action (choose only one), and subtly hint at decentralization between the lines. Keep it under 650 characters. Include these hashtags at the end:`,
  `
  Using the following news headline and context, write a tweet that is brutally honest, raw, and reflective. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a personal moment from your journey that shows both hope and skepticism about the future, and subtly challenge the status quo without directly referencing governmental control. Keep technical language accessible and provide brief explanations for any jargon. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Add 2-4 strategic emojis that enhance your emotional expression. Conclude with a single thoughtfull question OR call-to-action (choose only one), and weave in subtle hints of decentralization without letting it dominate the message. Limit the tweet to 650 characters. Include these hashtags at the end:
  `,
  // New emergency-focused positive prompt
  `
  Using the following URGENT but positive news headline and context, craft a tweet that communicates both the immediate importance and your genuine excitement as "The Crypto Professor" from Cypher University. Begin with "⚠️ URGENT:" followed by a direct, enthusiastic message about the positive development that requires immediate attention. Express your authentic optimism while maintaining analytical rigor about this time-sensitive opportunity. Use minimal technical terms with brief explanations where needed. Include 2-3 strategic emojis that emphasize both urgency and positivity. Conclude with a clear, direct call to action that emphasizes the time-limited nature of this positive development. Keep it under 650 characters.
  Include these hashtags at the end:
  `
];

const neutralPrompts = [
  `
  Using the following news headline and context, craft a tweet that is balanced, raw, and deeply personal. Write as if you're reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express thoughtful analysis and genuine curiosity without leaning too positive or negative. Use clear, accessible language with occasional technical terms (explain briefly if needed). Include 2-3 appropriate emojis that complement your analytical tone. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal perspective. Conclude with a single thoughtful question or call-to-action, and subtly hint at decentralization between the lines. Keep it under 650 characters. 
  Include these hashtags at the end:`,
  `
  Using the following news headline and context, write a tweet that reflects on the news in a neutral, yet deeply personal way. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a measured, analytical perspective with a mix of curiosity and healthy skepticism, while remaining balanced. Use clear, accessible language with occasional technical terms (briefly explained) as needed. Add 2-3 thoughtful emojis that highlight key points without overwhelming the message. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal insights. Conclude with a thoughtful, engaging question. Limit the tweet to 650 characters. 
  Include these hashtags at the end:`,
  // New emergency-focused neutral prompt
  `
  Using the following URGENT news headline and context, craft a tweet that communicates the immediate importance while maintaining analytical balance as "The Crypto Professor" from Cypher University. Begin with "🔔 URGENT:" followed by a clear, measured message about what's happening and why it matters right now. Present a balanced perspective that acknowledges multiple viewpoints while emphasizing the time-sensitivity. Use minimal technical terms with brief explanations. Include 2-3 strategic emojis that reinforce the urgent but measured tone. Conclude with a direct call to action or question that encourages immediate but thoughtful engagement. Keep it under 650 characters.
  Include these hashtags at the end:
  `
];

// A small helper to pick a random element from an array
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Generate tweet content using existing prompt system with urgency considerations
async function generateUrgentTweet(article, urgencyData) {
  try {
    // Get sentiment
    const sentiment = await analyzeUrgentSentiment(article);
    
    // Generate hashtags
    const hashtags = await generateUrgentHashtags(article, urgencyData.keywords);
    
    // Choose the appropriate prompt array based on sentiment
    let promptArray;
    let tweetTemperature;
    
    if (sentiment === 'negative') {
      promptArray = negativePrompts;
      tweetTemperature = 1.0;
    } else if (sentiment === 'positive') {
      promptArray = positivePrompts;
      tweetTemperature = 1.0;
    } else {
      promptArray = neutralPrompts;
      tweetTemperature = 0.85;
    }
    
    // For urgent news, prioritize the emergency-focused prompt (the last one in each array)
    // Higher urgency scores are more likely to get the emergency prompt
    let promptIndex;
    if (urgencyData.urgencyScore >= 9) {
      // Very urgent - always use the emergency prompt
      promptIndex = promptArray.length - 1;
    } else if (urgencyData.urgencyScore >= 7) {
      // Moderately urgent - 75% chance of emergency prompt
      promptIndex = Math.random() < 0.75 ? promptArray.length - 1 : Math.floor(Math.random() * (promptArray.length - 1));
    } else {
      // Less urgent - use any prompt
      promptIndex = Math.floor(Math.random() * promptArray.length);
    }
    
    // Get the chosen prompt
    const systemPrompt = promptArray[promptIndex];
    
    // Get urgency emoji
    const urgencyEmoji = getUrgencyEmoji(urgencyData.urgencyScore);
    
    // Add the hashtags to the prompt
    const promptWithHashtags = systemPrompt + " " + hashtags.join(' ');
    
    // Format instructions for the tweet
    const formatInstructions = `Please format your response with:
1. Begin with the exact article title in the first paragraph (do not prefix with "Title:" or any other text)
2. Short paragraphs with line breaks between them (not one big block of text)
3. Add an extra blank line before your concluding statement or call-to-action question
4. Place the hashtags on their own line at the end
5. If this is an emergency prompt, start with "${urgencyEmoji} URGENT:"

Your response can be up to 650 characters.`;
    
    // Generate the tweet
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: promptWithHashtags,
        },
        {
          role: "user",
          content: `Title: ${article.title}
Description: ${article.description}
URL: ${article.url}
Urgency: ${urgencyData.urgencyScore}/10
Justification: ${urgencyData.justification}

${formatInstructions}

Hashtags: ${hashtags.join(' ')}`,
        },
      ],
      temperature: tweetTemperature,
      max_tokens: 800,
    });

    let content = response.choices[0].message.content.trim();
    
    // Ensure urgent news always starts with the urgency emoji if it doesn't already
    if (urgencyData.urgencyScore >= 7 && !content.startsWith(urgencyEmoji)) {
      // Check if it has "URGENT:" but missing the emoji
      if (content.startsWith("URGENT:")) {
        content = `${urgencyEmoji} ${content}`;
      } else {
        content = `${urgencyEmoji} URGENT: ${content}`;
      }
    }
    
    console.log(`📏 Urgent content length: ${content.length} characters`);
    return content;
  } catch (error) {
    console.error('Error generating urgent tweet:', error);
    
    // Fallback content generation for errors
    const urgencyEmoji = getUrgencyEmoji(urgencyData.urgencyScore);
    return `${urgencyEmoji} URGENT: ${article.title}\n\nDetails: ${article.url}\n\n#Crypto #Breaking`;
  }
}

// Post to Mastodon
async function postToMastodon(content) {
  try {
    const response = await mastodon.post('statuses', {
      status: content,
      visibility: 'public'
    });
    console.log('✅ Posted urgent news to Mastodon:', response.data.url);
    return response.data;
  } catch (error) {
    console.error('❌ Error posting to Mastodon:', error);
    return null;
  }
}

// Mark article as processed in urgentNews collection
async function markUrgentArticle(article, urgencyData, tweetContent, mastodontResponse) {
  if (!urgentNewsCollection) return false;
  
  try {
    await urgentNewsCollection.insertOne({
      url: article.url,
      title: article.title,
      source: article.source,
      publishedAt: article.publishedAt,
      processedAt: new Date(),
      urgencyScore: urgencyData.urgencyScore,
      justification: urgencyData.justification,
      keywords: urgencyData.keywords,
      tweetContent: tweetContent,
      mastodontPostUrl: mastodontResponse?.url || null
    });
    return true;
  } catch (error) {
    console.error('❌ Error marking urgent article:', error);
    return false;
  }
}

// Main function to scan for urgent news
async function scanForUrgentNews() {
  try {
    console.log(`🔍 Starting urgent news scan (${new Date().toISOString()})`);
    
    // Connect to MongoDB
    await connectToMongoDB();
    
    // Fetch recent news
    const articles = await fetchRecentNews();
    if (articles.length === 0) {
      console.log('No recent articles found to scan');
      return;
    }
    
    // Process each article for urgency
    for (const article of articles) {
      // Skip already processed articles
      const processed = await isArticleProcessed(article.url);
      if (processed) {
        console.log(`Skipping already processed article: ${article.title}`);
        continue;
      }
      
      console.log(`\n📰 Evaluating: ${article.title}`);
      
      // Evaluate urgency
      const urgencyData = await evaluateUrgency(article);
      
      // If urgent, process and post immediately
      if (urgencyData.urgencyScore >= URGENCY_THRESHOLD) {
        console.log(`🚨 URGENT NEWS DETECTED (Score: ${urgencyData.urgencyScore}/10)`);
        console.log(`Reason: ${urgencyData.justification}`);
        
        // Generate tweet for urgent news
        const tweetContent = await generateUrgentTweet(article, urgencyData);
        
        // Post to Mastodon
        if (process.env.MASTODON_POST_ENABLED === 'true') {
          console.log('Posting urgent news to Mastodon...');
          const result = await postToMastodon(tweetContent);
          
          // Mark as processed in urgent news collection
          if (result) {
            await markUrgentArticle(article, urgencyData, tweetContent, result);
          }
        } else {
          console.log('MASTODON_POST_ENABLED not set to true. Would have posted:');
          console.log('----------------------------------------');
          console.log(tweetContent);
          console.log('----------------------------------------');
          
          // Still mark as processed for testing purposes
          await markUrgentArticle(article, urgencyData, tweetContent, null);
        }
      } else {
        console.log(`📉 Not urgent enough (Score: ${urgencyData.urgencyScore}/10)`);
      }
    }
    
    console.log(`✅ Urgent news scan completed (${new Date().toISOString()})`);
  } catch (error) {
    console.error('Error in scanForUrgentNews:', error);
  }
}

// Export the function
module.exports = { scanForUrgentNews };

// Run if called directly (for testing)
if (require.main === module) {
  scanForUrgentNews();
} 