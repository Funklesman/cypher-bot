/**
 * Daily Lesson Generator
 * 
 * Creates an educational tweet triggered by recent crypto events.
 * Maps news events to relevant Kodex Academy content.
 * Runs daily at 10 AM, posts to Mastodon and cross-posts to X.
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
  console.log('✅ Cross-posting module loaded for Daily Lesson');
} catch (e) {
  console.log('⚠️ Cross-posting module not available for Daily Lesson');
}

// Import bot state checker
let getBotRunningState = null;
function setBotStateChecker(checker) {
  getBotRunningState = checker;
}

// Track next lesson time
let nextDailyLesson = null;

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
  console.log('✅ Connected to Mastodon API for Daily Lesson');
}

// ============================================================================
// CONTENT LIBRARY - Courses and Articles Mapping
// ============================================================================

const CONTENT_LIBRARY = {
  // Event keywords → Content mapping
  eventMappings: {
    // Security Events
    hack: {
      keywords: ['hack', 'exploit', 'vulnerability', 'breach', 'attack', 'stolen', 'drained'],
      courses: [
        { slug: 'blockchain-governance', name: 'The Survival Framework - Scams', url: 'https://www.kodex.academy/courses/blockchain-governance' },
        { slug: 'secure-wallets-trading', name: 'Safe Wallets and First Steps', url: 'https://www.kodex.academy/courses/secure-wallets-trading' }
      ],
      articles: [
        { slug: 'scams1', name: 'Crypto Scams Part 1 — How They Take Your Keys', url: 'https://www.kodex.academy/uplink/scams1', summary: 'The blunt traps: fake apps, bad links, and dashboards built to empty your wallet.' },
        { slug: 'scams2', name: 'Crypto Scams Part 2 — How They Make You Hand It Over', url: 'https://www.kodex.academy/uplink/scams2', summary: 'The polished traps: livestreams, referrals, and deepfakes.' }
      ]
    },
    
    scam: {
      keywords: ['scam', 'rug pull', 'fraud', 'ponzi', 'phishing', 'fake'],
      courses: [
        { slug: 'blockchain-governance', name: 'The Survival Framework - Scams', url: 'https://www.kodex.academy/courses/blockchain-governance' }
      ],
      articles: [
        { slug: 'scams1', name: 'Crypto Scams Part 1', url: 'https://www.kodex.academy/uplink/scams1', summary: 'The blunt traps: fake apps, bad links, dashboards built to drain you.' },
        { slug: 'scams2', name: 'Crypto Scams Part 2', url: 'https://www.kodex.academy/uplink/scams2', summary: 'The polished traps: livestreams, referrals, deepfakes.' }
      ]
    },
    
    // Market Events
    pump: {
      keywords: ['pump', 'surge', 'rally', 'spike', 'moon', 'ath', 'all-time high', 'breakout'],
      courses: [
        { slug: 'read-charts-like-a-map-trade-with-a-plan-not-a-guess', name: 'Read Charts Like a Map', url: 'https://www.kodex.academy/courses/read-charts-like-a-map-trade-with-a-plan-not-a-guess' }
      ],
      articles: [
        { slug: 'relative-strength-index', name: 'RSI - Know When Markets Run Hot', url: 'https://www.kodex.academy/uplink/relative-strength-index', summary: 'Tracks how strong — or tired — a move really is.' },
        { slug: 'volume-patterns', name: 'Volume Patterns', url: 'https://www.kodex.academy/uplink/volume-patterns', summary: 'Tracks the force behind the move.' }
      ]
    },
    
    crash: {
      keywords: ['crash', 'dump', 'plunge', 'collapse', 'tank', 'capitulation', 'blood'],
      courses: [
        { slug: 'the-survival-framework-risk-rules-that-hold', name: 'Risk Rules That Hold', url: 'https://www.kodex.academy/courses/the-survival-framework-risk-rules-that-hold' }
      ],
      articles: [
        { slug: 'risk1', name: 'Crypto Risk Part 1: What Breaks Traders First', url: 'https://www.kodex.academy/uplink/risk1', summary: 'Most traders don\'t blow up from bad picks—they blow up from bad risk.' },
        { slug: 'risk2', name: 'Crypto Risk Part 2: How to Survive', url: 'https://www.kodex.academy/uplink/risk2', summary: 'What separates survivors from casualties.' }
      ]
    },
    
    volatility: {
      keywords: ['volatility', 'volatile', 'whipsaw', 'swing', 'turbulent'],
      courses: [
        { slug: 'the-survival-framework-risk-rules-that-hold', name: 'Risk Rules That Hold', url: 'https://www.kodex.academy/courses/the-survival-framework-risk-rules-that-hold' }
      ],
      articles: [
        { slug: 'average-true-range', name: 'ATR - Volatility Measured', url: 'https://www.kodex.academy/uplink/average-true-range', summary: 'ATR shows how wide the swings are, so you can set smarter stops.' },
        { slug: 'bollinger-bands', name: 'Bollinger Bands', url: 'https://www.kodex.academy/uplink/bollinger-bands', summary: 'This tool shows when the market\'s stretched — or ready to release.' }
      ]
    },
    
    // Liquidity Events
    liquidity: {
      keywords: ['liquidity', 'illiquid', 'thin', 'depth', 'slippage', 'whale'],
      courses: [
        { slug: 'market-architect', name: 'Market Architect', url: 'https://www.kodex.academy/courses/market-architect' }
      ],
      articles: [
        { slug: 'liquidity-what-holds-what-breaks', name: 'Liquidity - What Holds and What Breaks', url: 'https://www.kodex.academy/uplink/liquidity-what-holds-what-breaks', summary: 'Learn how to tell if a market can handle your trade.' },
        { slug: 'slippage-and-the-friction-of-execution', name: 'Slippage and Execution', url: 'https://www.kodex.academy/uplink/slippage-and-the-friction-of-execution', summary: 'Slippage is how the market tells you what it can\'t hold.' }
      ]
    },
    
    // Stablecoin Events
    stablecoin: {
      keywords: ['stablecoin', 'usdt', 'usdc', 'dai', 'depeg', 'peg', 'tether', 'circle'],
      courses: [
        { slug: 'intro-to-blockchain', name: 'Blockchain & Value', url: 'https://www.kodex.academy/courses/intro-to-blockchain' }
      ],
      articles: [
        { slug: 'stable1', name: 'Stablecoins Part 1: The Hidden Machine', url: 'https://www.kodex.academy/uplink/stable1', summary: 'This guide lifts the panel and shows the hidden machinery that makes $1 hold.' },
        { slug: 'stable2', name: 'Stablecoins Part 2: When $1 Moves the World', url: 'https://www.kodex.academy/uplink/stable2', summary: 'Stablecoins move rent, remittances, art, and votes.' }
      ]
    },
    
    // Regulatory Events
    regulation: {
      keywords: ['sec', 'cftc', 'regulation', 'regulatory', 'lawsuit', 'legal', 'compliance', 'enforcement', 'ban', 'approved'],
      courses: [
        { slug: 'intro-to-blockchain', name: 'Blockchain & Value', url: 'https://www.kodex.academy/courses/intro-to-blockchain' }
      ],
      articles: [
        { slug: 'cbdc1', name: 'CBDC Part 1 - The New Stage of Money', url: 'https://www.kodex.academy/uplink/cbdc1', summary: 'How central bank digital currencies are reshaping payments, privacy, and stability.' },
        { slug: 'the-fight-for-financial-freedom', name: 'The Fight for Financial Freedom', url: 'https://www.kodex.academy/uplink/the-fight-for-financial-freedom', summary: 'Who really controls your money — and why it matters.' }
      ]
    },
    
    // ETF Events
    etf: {
      keywords: ['etf', 'spot etf', 'bitcoin etf', 'eth etf', 'institutional', 'blackrock', 'fidelity', 'grayscale'],
      courses: [
        { slug: 'what-a-token-really-is', name: 'What a Token Really Is', url: 'https://www.kodex.academy/courses/what-a-token-really-is' }
      ],
      articles: [
        { slug: 'what-is-a-token', name: 'What is a Token', url: 'https://www.kodex.academy/uplink/what-is-a-token', summary: 'Understand what a token really is - not the hype, but the mechanics.' },
        { slug: 'what-is-a-token-part-2', name: 'What is a Token Part 2', url: 'https://www.kodex.academy/uplink/what-is-a-token-part-2', summary: 'Learn who truly controls tokens: code, creators, governments, or markets.' }
      ]
    },
    
    // Exchange Events  
    exchange: {
      keywords: ['exchange', 'binance', 'coinbase', 'kraken', 'withdrawal', 'deposit', 'trading halt', 'delist'],
      courses: [
        { slug: 'secure-wallets-trading', name: 'Safe Wallets and First Steps', url: 'https://www.kodex.academy/courses/secure-wallets-trading' }
      ],
      articles: [
        { slug: 'wallets1', name: 'Take Control of Your Crypto', url: 'https://www.kodex.academy/uplink/wallets1', summary: 'Skip this path, and you\'ll keep paying tuition to mistakes.' },
        { slug: 'wallets2', name: 'Move Crypto Safely', url: 'https://www.kodex.academy/uplink/wallets2', summary: 'Build this base, and nothing the market does can shake you.' }
      ]
    },
    
    // DeFi Events
    defi: {
      keywords: ['defi', 'yield', 'apy', 'tvl', 'liquidity pool', 'lp', 'farming', 'staking', 'impermanent loss'],
      courses: [
        { slug: 'intro-to-blockchain', name: 'Blockchain & Value', url: 'https://www.kodex.academy/courses/intro-to-blockchain' }
      ],
      articles: [
        { slug: 'impermanent-loss-what-you-must-know-first', name: 'Impermanent Loss Part 1', url: 'https://www.kodex.academy/uplink/impermanent-loss-what-you-must-know-first', summary: 'Learn why your pool balance shifts and where value slips.' },
        { slug: 'impermanent-loss-what-happens-when-markets-move', name: 'Impermanent Loss Part 2', url: 'https://www.kodex.academy/uplink/impermanent-loss-what-happens-when-markets-move', summary: 'See how real pumps, dumps, and fees affect your outcome.' }
      ]
    },
    
    // Psychology/FOMO Events
    fomo: {
      keywords: ['fomo', 'fud', 'panic', 'euphoria', 'greed', 'fear', 'sentiment'],
      courses: [
        { slug: 'the-survival-framework-risk-rules-that-hold', name: 'Risk Rules That Hold', url: 'https://www.kodex.academy/courses/the-survival-framework-risk-rules-that-hold' }
      ],
      articles: [
        { slug: 'mastering-the-psyche-of-the-cryptonauts-cryptopsyche-1', name: 'Cryptopsyche Part 1: Mastering Impulse', url: 'https://www.kodex.academy/uplink/mastering-the-psyche-of-the-cryptonauts-cryptopsyche-1', summary: 'Learn to pause, name the state, and keep your plan trading—not your mood.' },
        { slug: 'cryptopsyche', name: 'Cryptopsyche Part 2: Discipline over Impulse', url: 'https://www.kodex.academy/uplink/cryptopsyche', summary: 'Outlast boredom, resist mood swings, let repetition turn into strength.' }
      ]
    },
    
    // Technical Analysis Events
    technical: {
      keywords: ['support', 'resistance', 'breakout', 'breakdown', 'trend', 'momentum', 'reversal', 'pattern'],
      courses: [
        { slug: 'read-charts-like-a-map-trade-with-a-plan-not-a-guess', name: 'Read Charts Like a Map', url: 'https://www.kodex.academy/courses/read-charts-like-a-map-trade-with-a-plan-not-a-guess' }
      ],
      articles: [
        { slug: 'macd', name: 'MACD', url: 'https://www.kodex.academy/uplink/macd', summary: 'Momentum tells the truth before price does.' },
        { slug: 'trendlines', name: 'Trendlines', url: 'https://www.kodex.academy/uplink/trendlines', summary: 'Highlights direction, support, and when momentum may shift.' }
      ]
    }
  },
  
  // Default fallback content
  fallback: {
    articles: [
      { slug: 'trade-with-precision', name: 'How the Market Really Works', url: 'https://www.kodex.academy/uplink/trade-with-precision', summary: 'Crypto markets are not random. Learn the structures that govern motion.' },
      { slug: 'risk1', name: 'Crypto Risk Part 1', url: 'https://www.kodex.academy/uplink/risk1', summary: 'Most traders don\'t blow up from bad picks—they blow up from bad risk.' }
    ]
  }
};

// ============================================================================
// DAILY LESSON PROMPT
// ============================================================================

function buildDailyLessonPrompt(eventType, content, articles) {
  return `You are the educational voice of Kodex Academy. You turn current events into learning moments.

## YOUR TASK
Yesterday, something happened in crypto. Today, you teach from it.

Look at the recent news and connect it to the educational content provided. Create ONE educational tweet that:
1. References what happened (briefly)
2. Extracts the timeless lesson
3. Points to where they can learn more

## EVENT TYPE DETECTED: ${eventType}

## RELEVANT KODEX CONTENT:
${JSON.stringify(content, null, 2)}

## FORMAT
- One to two flowing paragraphs
- Under 1500 characters (room to develop the lesson)
- Start with the event/lesson connection
- Develop the principle with context or example
- Include one quotable insight
- 2-4 emojis placed naturally
- End with: "Learn more → [URL] 🎓"
- Add 2 relevant hashtags

## VOICE
- Mentor, not lecturer
- "Here's what this teaches us..." not "You should..."
- Connect current event to timeless principle
- Practical, not preachy

## DON'T
- Lecture or moralize
- Use "Quietly" as an opener
- Summarize multiple stories
- Sound like a textbook
- Be generic — tie it to the specific event

## RECENT NEWS CONTEXT:
${JSON.stringify(articles.map(a => ({ title: a.title, source: a.source })), null, 2)}

## EXAMPLE OUTPUT:
That 40% pump just got rejected at RSI 85 📊. When everyone's chasing, the chart is already stretched. Overbought signals matter more in low-liquidity tokens—momentum exhausts faster when there's no depth to absorb it. Learn more → https://www.kodex.academy/uplink/relative-strength-index 🎓 #CryptoEducation #RSI`;
}

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Detect event type from articles
 */
function detectEventType(articles) {
  const allText = articles
    .map(a => `${a.title} ${a.description || ''} ${a.content || ''}`.toLowerCase())
    .join(' ');
  
  // Check each event type for keyword matches
  for (const [eventType, config] of Object.entries(CONTENT_LIBRARY.eventMappings)) {
    const matchCount = config.keywords.filter(keyword => allText.includes(keyword)).length;
    if (matchCount >= 2) {
      console.log(`🎯 Detected event type: ${eventType} (${matchCount} keyword matches)`);
      return eventType;
    }
  }
  
  // Check for single strong matches
  for (const [eventType, config] of Object.entries(CONTENT_LIBRARY.eventMappings)) {
    const hasMatch = config.keywords.some(keyword => allText.includes(keyword));
    if (hasMatch) {
      console.log(`🎯 Detected event type: ${eventType} (single match)`);
      return eventType;
    }
  }
  
  console.log('⚠️ No specific event type detected, using fallback');
  return 'fallback';
}

/**
 * Get relevant content for event type
 */
function getRelevantContent(eventType) {
  if (eventType === 'fallback' || !CONTENT_LIBRARY.eventMappings[eventType]) {
    return CONTENT_LIBRARY.fallback.articles[Math.floor(Math.random() * CONTENT_LIBRARY.fallback.articles.length)];
  }
  
  const eventConfig = CONTENT_LIBRARY.eventMappings[eventType];
  
  // Prefer articles over courses for tweets (more specific)
  if (eventConfig.articles && eventConfig.articles.length > 0) {
    return eventConfig.articles[Math.floor(Math.random() * eventConfig.articles.length)];
  }
  
  if (eventConfig.courses && eventConfig.courses.length > 0) {
    return eventConfig.courses[0];
  }
  
  return CONTENT_LIBRARY.fallback.articles[0];
}

/**
 * Generate and publish the Daily Lesson
 */
async function generateDailyLesson() {
  console.log('📚 Generating Daily Lesson for ' + new Date().toLocaleDateString());
  
  if (getBotRunningState && !getBotRunningState()) {
    console.log('🛑 Bot is stopped, aborting Daily Lesson generation');
    return null;
  }
  
  try {
    // 1. Get yesterday's articles
    const articles = await getYesterdaysArticles();
    
    if (!articles || articles.length === 0) {
      console.log('❌ No articles found for Daily Lesson');
      return null;
    }
    
    console.log(`📚 Found ${articles.length} articles for Daily Lesson`);
    
    // 2. Detect event type
    const eventType = detectEventType(articles);
    
    // 3. Get relevant content
    const relevantContent = getRelevantContent(eventType);
    console.log(`📖 Selected content: ${relevantContent.name}`);
    
    // 4. Generate the lesson content
    const lessonContent = await generateLessonContent(eventType, relevantContent, articles);
    
    if (!lessonContent) {
      console.log('❌ Failed to generate Daily Lesson content');
      return null;
    }
    
    // 5. Post to Mastodon
    let mastodonPostData = null;
    if (process.env.MASTODON_POST_ENABLED === 'true') {
      mastodonPostData = await postLessonToMastodon(lessonContent);
      
      // 6. Cross-post to X if enabled
      if (mastodonPostData && crossPostToSocialMedia && process.env.X_POST_ENABLED === 'true') {
        try {
          await crossPostToSocialMedia(mastodonPostData, {
            includeMedia: false,
            noHashtags: process.env.X_POST_NOHASHTAGS === 'true',
            maxRetries: 3
          });
        } catch (crossPostError) {
          console.error('⚠️ Cross-posting Daily Lesson failed:', crossPostError.message);
        }
      }
    }
    
    // 7. Store in MongoDB
    await storeLessonInMongoDB(lessonContent, eventType, relevantContent, articles, mastodonPostData);
    
    return lessonContent;
  } catch (error) {
    console.error('❌ Error generating Daily Lesson:', error);
    return null;
  }
}

/**
 * Get articles from yesterday
 */
async function getYesterdaysArticles() {
  try {
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0); // Start of today
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1); // Yesterday
    
    console.log(`Looking for articles from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const articles = await dbClient.getPostHistoryBetweenDates(startDate, endDate);
    
    if (!articles || articles.length === 0) {
      // Fallback to last 24 hours if no yesterday articles
      const now = new Date();
      const dayAgo = new Date(now);
      dayAgo.setDate(dayAgo.getDate() - 1);
      return await dbClient.getPostHistoryBetweenDates(dayAgo, now);
    }
    
    // Sort by importance and take top 5
    return articles
      .sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0))
      .slice(0, 5);
  } catch (error) {
    console.error('❌ Error fetching yesterday\'s articles:', error);
    return [];
  }
}

/**
 * Generate lesson content using OpenAI
 */
async function generateLessonContent(eventType, content, articles) {
  try {
    console.log('🤖 Generating Daily Lesson content...');
    
    const prompt = buildDailyLessonPrompt(eventType, content, articles);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        { role: "system", content: prompt }
      ]
    });
    
    let lessonContent = response.choices[0].message.content.trim();
    
    // Ensure the URL is included
    if (!lessonContent.includes('kodex.academy')) {
      lessonContent = lessonContent.replace(/🎓\s*$/, '') + ` Learn more → ${content.url} 🎓`;
    }
    
    // Validate length
    if (lessonContent.length > 1600) {
      console.log(`⚠️ Lesson too long (${lessonContent.length} chars), regenerating...`);
      const retryResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 700,
        messages: [
          { role: "system", content: prompt + "\n\n⚠️ CRITICAL: Keep under 1400 characters. Be more concise." }
        ]
      });
      lessonContent = retryResponse.choices[0].message.content.trim();
      if (!lessonContent.includes('kodex.academy')) {
        lessonContent = lessonContent.replace(/🎓\s*$/, '') + ` Learn more → ${content.url} 🎓`;
      }
    }
    
    console.log(`✅ Generated Daily Lesson (${lessonContent.length} characters)`);
    console.log('\n--- Preview ---');
    console.log(lessonContent);
    
    return lessonContent;
  } catch (error) {
    console.error('❌ Error generating lesson content:', error);
    return null;
  }
}

/**
 * Post lesson to Mastodon
 */
async function postLessonToMastodon(content) {
  if (!isMastodonConfigured || !mastodon) {
    console.log('❌ Mastodon not configured, skipping post');
    return null;
  }
  
  try {
    console.log('🚀 Posting Daily Lesson to Mastodon...');
    
    const status = `📚 TODAY'S LESSON\n\n${content}`;
    
    const response = await mastodon.post('statuses', {
      status: status,
      visibility: 'public'
    });
    
    if (!response || !response.data) {
      console.error('❌ Mastodon API returned invalid response');
      return null;
    }
    
    console.log('✅ Posted Daily Lesson to Mastodon:', response.data.url);
    return response.data;
  } catch (error) {
    console.error('❌ Error posting to Mastodon:', error);
    return null;
  }
}

/**
 * Store lesson in MongoDB
 */
async function storeLessonInMongoDB(content, eventType, relevantContent, articles, mastodonPostData) {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) return null;
    
    const client = new MongoClient(mongoUri);
    await client.connect();
    
    const db = client.db('TweetBot');
    const collection = db.collection('daily_lessons');
    
    const lessonEntry = {
      type: 'daily_lesson',
      content: content,
      eventType: eventType,
      linkedContent: {
        name: relevantContent.name,
        slug: relevantContent.slug,
        url: relevantContent.url
      },
      articleCount: articles.length,
      articles: articles.map(a => ({
        title: a.title,
        source: a.source
      })),
      postedAt: new Date(),
      postUrl: mastodonPostData?.url || null,
      postId: mastodonPostData?.id || null,
      characterCount: content.length
    };
    
    const result = await collection.insertOne(lessonEntry);
    console.log('✅ Stored Daily Lesson in MongoDB:', result.insertedId);
    
    await client.close();
    return result;
  } catch (error) {
    console.error('❌ Error storing lesson in MongoDB:', error);
    return null;
  }
}

// ============================================================================
// SCHEDULING
// ============================================================================

/**
 * Calculate next lesson time
 */
function calculateNextLessonTime() {
  const now = new Date();
  const next = new Date();
  
  // Set to 10 AM today
  next.setHours(10, 0, 0, 0);
  
  // If it's already past 10 AM today, move to tomorrow
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

/**
 * Schedule the Daily Lesson to run at 10 AM
 */
function scheduleDailyLesson() {
  nextDailyLesson = calculateNextLessonTime();
  console.log(`📅 Next Daily Lesson scheduled for: ${nextDailyLesson.toLocaleString()}`);
  
  // Schedule for 10 AM local time every day
  cron.schedule('0 10 * * *', async () => {
    console.log('⏰ Running scheduled Daily Lesson...');
    await generateDailyLesson();
    nextDailyLesson = calculateNextLessonTime();
    console.log(`📅 Next Daily Lesson scheduled for: ${nextDailyLesson.toLocaleString()}`);
  });
  
  console.log('📅 Scheduled Daily Lesson for 10 AM daily');
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  generateDailyLesson,
  scheduleDailyLesson,
  setBotStateChecker,
  detectEventType,
  getRelevantContent,
  CONTENT_LIBRARY,
  get nextDailyLesson() { return nextDailyLesson; }
};

