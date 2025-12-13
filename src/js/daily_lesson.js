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
      keywords: ['support', 'resistance', 'breakout', 'breakdown', 'trend', 'momentum', 'reversal', 'pattern', 'chart', 'indicator'],
      courses: [
        { slug: 'read-charts-like-a-map-trade-with-a-plan-not-a-guess', name: 'Read Charts Like a Map', url: 'https://www.kodex.academy/courses/read-charts-like-a-map-trade-with-a-plan-not-a-guess' }
      ],
      articles: [
        { slug: 'macd', name: 'MACD', url: 'https://www.kodex.academy/uplink/macd', summary: 'Momentum tells the truth before price does.' },
        { slug: 'trendlines', name: 'Trendlines', url: 'https://www.kodex.academy/uplink/trendlines', summary: 'Highlights direction, support, and when momentum may shift.' }
      ],
      tools: [
        { slug: 'market-tools', name: 'Market Tools - Advanced TA Analysis', url: 'https://www.kodex.academy/market-tools', summary: 'Run your own technical analysis with RSI, MACD, Bollinger Bands, Elliott Wave, and 14 more professional indicators.' }
      ]
    },
    
    // Trading/Execution Events
    trading: {
      keywords: ['order', 'market order', 'limit order', 'short', 'shorting', 'long', 'leverage', 'position', 'entry', 'exit', 'stop loss', 'take profit'],
      tools: [
        { slug: 'market-simulator', name: 'Market Simulator - Learn to Trade', url: 'https://www.kodex.academy/market-simulator', summary: 'Practice market orders, shorts, staking, and pattern analysis with real market data — no risk, real learning.' }
      ],
      articles: [
        { slug: 'risk1', name: 'Crypto Risk Part 1', url: 'https://www.kodex.academy/uplink/risk1', summary: 'Most traders don\'t blow up from bad picks—they blow up from bad risk.' }
      ]
    },
    
    // Pattern/Wave Events
    patterns: {
      keywords: ['elliott', 'wave', 'fibonacci', 'fib', 'golden', 'retracement', 'ichimoku', 'cloud', 'pivot'],
      tools: [
        { slug: 'market-tools', name: 'Market Tools - Pattern Analysis', url: 'https://www.kodex.academy/market-tools', summary: 'Analyze Elliott Waves, Fibonacci retracements, Ichimoku clouds, and more with our professional TA toolkit.' }
      ],
      articles: [
        { slug: 'elliot-wave-theory', name: 'Elliott Wave Theory', url: 'https://www.kodex.academy/uplink/elliot-wave-theory', summary: 'Markets move in waves — not straight lines. Recognize cycles and prepare for what comes next.' },
        { slug: 'fibonacci-retracement', name: 'Fibonacci Retracement', url: 'https://www.kodex.academy/uplink/fibonacci-retracement', summary: 'Use after strong price moves to spot likely pullbacks.' }
      ]
    },
    
    // Learning/Education Events
    education: {
      keywords: ['learn', 'beginner', 'newbie', 'start', 'getting started', 'basics', 'fundamentals', 'course'],
      pages: [
        { slug: 'courses', name: 'Kodex Academy Courses', url: 'https://www.kodex.academy/courses', summary: 'Structured courses from blockchain basics to advanced trading strategies.' },
        { slug: 'learning-paths', name: 'Learning Paths', url: 'https://www.kodex.academy/learning-paths', summary: 'Guided paths for beginners, traders, and DeFi explorers.' },
        { slug: 'insights', name: 'Insights & Articles', url: 'https://www.kodex.academy/insights', summary: 'Deep-dive articles on every crypto topic — read or listen.' }
      ]
    },
    
    // Community/Competition Events
    community: {
      keywords: ['leaderboard', 'ranking', 'competition', 'trader', 'top trader', 'performance', 'track record'],
      pages: [
        { slug: 'leaderboards', name: 'Trader Leaderboards', url: 'https://www.kodex.academy/leaderboards', summary: 'See how you stack up against other traders. Track your progress and climb the ranks.' },
        { slug: 'market-simulator', name: 'Market Simulator', url: 'https://www.kodex.academy/market-simulator', summary: 'Practice trading, build your track record, and compete with others.' }
      ]
    },
    
    // Platform/Security Events
    platform: {
      keywords: ['safe', 'secure', 'trusted', 'where to', 'exchange', 'wallet', 'hardware', 'vpn', 'security'],
      pages: [
        { slug: 'verified-platforms', name: 'Verified Platforms', url: 'https://www.kodex.academy/verified-platforms', summary: 'Vetted exchanges, wallets, and security tools. Know where it\'s safe to trade and store.' }
      ],
      articles: [
        { slug: 'wallets1', name: 'Take Control of Your Crypto', url: 'https://www.kodex.academy/uplink/wallets1', summary: 'Skip this path, and you\'ll keep paying tuition to mistakes.' }
      ]
    },
    
    // Market Reflection Events
    reflection: {
      keywords: ['market today', 'what happened', 'daily', 'weekly', 'recap', 'summary', 'digest'],
      pages: [
        { slug: 'crypto-diary', name: 'Crypto Diary', url: 'https://www.kodex.academy/crypto-diary', summary: 'Daily reflections on what\'s moving the market — patterns, signals, and what to watch.' }
      ]
    }
  },
  
  // Default fallback content
  fallback: {
    articles: [
      { slug: 'trade-with-precision', name: 'How the Market Really Works', url: 'https://www.kodex.academy/uplink/trade-with-precision', summary: 'Crypto markets are not random. Learn the structures that govern motion.' },
      { slug: 'risk1', name: 'Crypto Risk Part 1', url: 'https://www.kodex.academy/uplink/risk1', summary: 'Most traders don\'t blow up from bad picks—they blow up from bad risk.' }
    ],
    pages: [
      { slug: 'insights', name: 'Kodex Academy Insights', url: 'https://www.kodex.academy/insights', summary: 'Explore our library of crypto education — from basics to advanced strategies.' },
      { slug: 'courses', name: 'Kodex Academy Courses', url: 'https://www.kodex.academy/courses', summary: 'Structured learning paths for every level.' }
    ]
  }
};

// ============================================================================
// DAILY LESSON PROMPT
// ============================================================================

function buildDailyLessonPrompt(eventType, content, articles) {
  return `You are writing a reflective teaching moment. You've been through the cycles, you've seen the patterns repeat, and you understand what actually matters for someone learning this space. You're not a textbook — you're a thoughtful mentor sharing what today's news reminded you about.

Pick ONE thing from today's news that connects to a fundamental concept. Your job is to help the reader actually UNDERSTAND something — not just know what happened, but see why it matters and how it connects to principles they can use.

---

🛑 DO NOT lecture or moralize. No "You should..." or "Always remember to..."

🛑 DO NOT be generic. Tie it specifically to what happened today.

🛑 DO NOT sound like a textbook or course description.

🛑 DO NOT use AI-cliché words: tectonic, paradigm, landscape, pivotal, cornerstone, crucial, imperative, ecosystem (unless literal), leverage (unless about actual leverage)

🛑 DO NOT be cynical. Be curious, helpful, genuinely interested in teaching.

---

## 🎯 This should feel like:
- A mentor explaining why today's news matters for your education
- "Here's what this actually teaches us..." energy
- Connecting a current event to a timeless principle
- Practical insight the reader can use going forward
- Curious exploration, not confident pronouncements

## ❌ This should NOT feel like:
- A textbook or course sales pitch
- Lecturing or moralizing
- Generic crypto advice
- A news summary with "learn more" tacked on
- Promotional or salesy

---

## ✍️ Voice:
- Write like you think — direct, curious, helpful
- Use "I" naturally ("What strikes me here...", "This is why I always come back to...", "The thing people miss is...")
- Balance explanation with insight
- 2-3 emojis max, placed naturally
- Let the teaching emerge from the story, not the other way around

---

## 🎓 Make it educational:
- What does this event reveal about how crypto actually works?
- What principle does this illustrate?
- How does understanding this help someone navigate the space?
- What would a beginner miss that experience would teach?

---

## 📚 CONTENT TO CONNECT TO:
Topic: ${content.name}
Summary: ${content.summary || 'Educational content on this topic'}
URL: ${content.url}

## 📰 TODAY'S NEWS (pick ONE connection):
${JSON.stringify(articles.map(a => ({ title: a.title, source: a.source })), null, 2)}

---

## ✅ Format:
- 2-3 flowing paragraphs
- Around 1500-2000 characters (give it room to actually teach)
- Start mid-thought, connected to the news
- Weave in the educational link naturally (not as a forced CTA)
- End with the link: "Dig deeper → ${content.url}" or "More on this → ${content.url}"
- NO hashtags

The link should feel like a natural invitation to learn more, not a sales pitch.`;
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
    // Mix articles and pages for fallback
    const fallbackOptions = [
      ...(CONTENT_LIBRARY.fallback.articles || []),
      ...(CONTENT_LIBRARY.fallback.pages || [])
    ];
    return fallbackOptions[Math.floor(Math.random() * fallbackOptions.length)];
  }
  
  const eventConfig = CONTENT_LIBRARY.eventMappings[eventType];
  
  // Collect all available content types
  const allContent = [
    ...(eventConfig.articles || []),
    ...(eventConfig.tools || []),
    ...(eventConfig.pages || []),
    ...(eventConfig.courses || [])
  ];
  
  if (allContent.length > 0) {
    // Randomly select from all available content
    return allContent[Math.floor(Math.random() * allContent.length)];
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
      model: "gpt-5.1",
      max_completion_tokens: 1500,
      messages: [
        { role: "system", content: prompt }
      ]
    });
    
    let lessonContent = response.choices[0].message.content.trim();
    
    // Ensure the URL is included somewhere
    if (!lessonContent.includes('kodex.academy')) {
      lessonContent = lessonContent + `\n\nDig deeper → ${content.url}`;
    }
    
    // Log length
    console.log(`📏 Lesson length: ${lessonContent.length} chars`);
    
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

