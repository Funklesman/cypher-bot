/**
 * Content Deduplication Service
 * 
 * Unified service for managing content freshness and topic deduplication
 * across all content generation modules (Signal Report, Daily Lesson, etc.)
 * 
 * Single source of truth for:
 * - Topic definitions and keywords
 * - Topic detection from articles
 * - Recent content queries
 * - Cross-module deduplication
 * - Content freshness scoring
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // MongoDB settings
  database: 'TweetBot',
  collections: {
    dailyLessons: 'daily_lessons',
    signalReports: 'signal_reports',
    cryptoDiary: 'crypto_diary_entries'
  },
  
  // Deduplication settings
  defaults: {
    topicCooldownDays: 3,      // Don't repeat same topic within 3 days
    contentCooldownDays: 7,    // Don't link same content URL within 7 days
    sameDayBlockSameTopic: true // Block same topic between Signal/Lesson on same day
  }
};

// ============================================================================
// TOPIC DEFINITIONS (Single Source of Truth)
// ============================================================================

const TOPIC_DEFINITIONS = {
  // Security Events
  hack: {
    keywords: ['hack', 'exploit', 'vulnerability', 'breach', 'attack', 'stolen', 'drained', 'compromised'],
    category: 'security',
    priority: 'high'
  },
  scam: {
    keywords: ['scam', 'rug pull', 'fraud', 'ponzi', 'phishing', 'fake', 'rug', 'rugpull'],
    category: 'security',
    priority: 'high'
  },
  
  // Market Events
  pump: {
    keywords: ['pump', 'surge', 'rally', 'spike', 'moon', 'ath', 'all-time high', 'breakout', 'soar', 'jump'],
    category: 'market',
    priority: 'medium'
  },
  crash: {
    keywords: ['crash', 'dump', 'plunge', 'collapse', 'tank', 'capitulation', 'blood', 'plummet', 'tumble'],
    category: 'market',
    priority: 'high'
  },
  volatility: {
    keywords: ['volatility', 'volatile', 'whipsaw', 'swing', 'turbulent', 'choppy', 'wild'],
    category: 'market',
    priority: 'medium'
  },
  
  // Liquidity & Trading
  liquidity: {
    keywords: ['liquidity', 'illiquid', 'thin', 'depth', 'slippage', 'whale', 'market maker'],
    category: 'trading',
    priority: 'medium'
  },
  trading: {
    keywords: ['order', 'market order', 'limit order', 'short', 'shorting', 'long', 'leverage', 'position', 'entry', 'exit', 'stop loss', 'take profit'],
    category: 'trading',
    priority: 'medium'
  },
  
  // Stablecoin Events
  stablecoin: {
    keywords: ['stablecoin', 'usdt', 'usdc', 'dai', 'depeg', 'peg', 'tether', 'circle', 'pyusd', 'busd'],
    category: 'stablecoin',
    priority: 'medium'
  },
  
  // Regulatory Events
  regulation: {
    keywords: ['sec', 'cftc', 'regulation', 'regulatory', 'lawsuit', 'legal', 'compliance', 'enforcement', 'ban', 'approved', 'occ', 'trust bank', 'license', 'charter'],
    category: 'regulation',
    priority: 'high'
  },
  
  // ETF & Institutional
  etf: {
    keywords: ['etf', 'spot etf', 'bitcoin etf', 'eth etf', 'institutional', 'blackrock', 'fidelity', 'grayscale', 'fund', 'inflow', 'outflow'],
    category: 'institutional',
    priority: 'high'
  },
  
  // Exchange Events
  exchange: {
    keywords: ['exchange', 'binance', 'coinbase', 'kraken', 'withdrawal', 'deposit', 'trading halt', 'delist', 'listing', 'bybit', 'okx'],
    category: 'exchange',
    priority: 'medium'
  },
  
  // DeFi Events
  defi: {
    keywords: ['defi', 'yield', 'apy', 'tvl', 'liquidity pool', 'lp', 'farming', 'staking', 'impermanent loss', 'protocol', 'dex'],
    category: 'defi',
    priority: 'medium'
  },
  
  // Psychology/Sentiment
  sentiment: {
    keywords: ['fomo', 'fud', 'panic', 'euphoria', 'greed', 'fear', 'sentiment', 'bullish', 'bearish'],
    category: 'psychology',
    priority: 'low'
  },
  
  // Technical Analysis
  technical: {
    keywords: ['support', 'resistance', 'breakout', 'breakdown', 'trend', 'momentum', 'reversal', 'pattern', 'chart', 'indicator', 'rsi', 'macd', 'fibonacci'],
    category: 'technical',
    priority: 'medium'
  },
  
  // Pattern Analysis
  patterns: {
    keywords: ['elliott', 'wave', 'fibonacci', 'fib', 'golden', 'retracement', 'ichimoku', 'cloud', 'pivot', 'head and shoulders', 'double top', 'double bottom'],
    category: 'technical',
    priority: 'medium'
  },
  
  // Bitcoin Specific
  bitcoin: {
    keywords: ['bitcoin', 'btc', 'halving', 'satoshi', 'lightning', 'mining', 'hash rate', 'difficulty'],
    category: 'bitcoin',
    priority: 'medium'
  },
  
  // Ethereum Specific
  ethereum: {
    keywords: ['ethereum', 'eth', 'gas', 'layer 2', 'l2', 'rollup', 'blob', 'eip', 'merge', 'staking'],
    category: 'ethereum',
    priority: 'medium'
  },
  
  // NFT/Digital Ownership
  nft: {
    keywords: ['nft', 'opensea', 'blur', 'digital art', 'collectible', 'pfp', 'ordinals', 'inscriptions'],
    category: 'nft',
    priority: 'low'
  },
  
  // AI & Crypto
  ai: {
    keywords: ['ai', 'artificial intelligence', 'machine learning', 'agent', 'bot', 'gpt', 'llm'],
    category: 'technology',
    priority: 'medium'
  }
};

// ============================================================================
// TOPIC DETECTION
// ============================================================================

/**
 * Get all topic definitions
 */
function getTopicDefinitions() {
  return TOPIC_DEFINITIONS;
}

/**
 * Get keywords for a specific topic
 */
function getTopicKeywords(topic) {
  return TOPIC_DEFINITIONS[topic]?.keywords || [];
}

/**
 * Detect topics from articles with scoring
 * Returns array of { topic, score, category, priority }
 */
function detectTopics(articles) {
  if (!articles || articles.length === 0) return [];
  
  // Combine all article text
  const allText = articles.map(a => 
    `${a.title || ''} ${a.description || ''} ${a.summary || ''} ${a.content || ''}`
  ).join(' ').toLowerCase();
  
  // Score each topic
  const scores = [];
  
  for (const [topic, config] of Object.entries(TOPIC_DEFINITIONS)) {
    const matchCount = config.keywords.filter(keyword => 
      allText.includes(keyword.toLowerCase())
    ).length;
    
    if (matchCount > 0) {
      scores.push({
        topic,
        score: matchCount,
        category: config.category,
        priority: config.priority,
        // Weighted score: multiply by priority factor
        weightedScore: matchCount * (config.priority === 'high' ? 1.5 : config.priority === 'medium' ? 1.0 : 0.7)
      });
    }
  }
  
  // Sort by weighted score
  return scores.sort((a, b) => b.weightedScore - a.weightedScore);
}

/**
 * Get the primary topic from articles
 */
function detectPrimaryTopic(articles) {
  const topics = detectTopics(articles);
  return topics.length > 0 ? topics[0].topic : 'general';
}

/**
 * Get top N topics from articles
 */
function detectTopTopics(articles, n = 3) {
  const topics = detectTopics(articles);
  return topics.slice(0, n).map(t => t.topic);
}

// ============================================================================
// MONGODB QUERIES (Unified)
// ============================================================================

/**
 * Get MongoDB connection
 */
async function getMongoConnection() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not configured');
    return null;
  }
  
  const client = new MongoClient(mongoUri);
  await client.connect();
  return client;
}

/**
 * Get recent content from specified collections
 * 
 * @param {Object} options
 * @param {string[]} options.collections - Which collections to query ['dailyLessons', 'signalReports']
 * @param {number} options.daysBack - How many days to look back
 * @param {boolean} options.todayOnly - Only get today's content
 */
async function getRecentContent(options = {}) {
  const {
    collections = ['dailyLessons', 'signalReports'],
    daysBack = 7,
    todayOnly = false
  } = options;
  
  let client;
  try {
    client = await getMongoConnection();
    if (!client) return { topics: [], contentUrls: [], entries: [] };
    
    const db = client.db(CONFIG.database);
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (todayOnly) {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - daysBack);
    }
    
    const allEntries = [];
    
    // Query each requested collection
    for (const collectionKey of collections) {
      const collectionName = CONFIG.collections[collectionKey];
      if (!collectionName) continue;
      
      const collection = db.collection(collectionName);
      const entries = await collection.find({
        postedAt: { $gte: startDate, $lte: endDate }
      }).sort({ postedAt: -1 }).toArray();
      
      // Normalize entry format
      entries.forEach(entry => {
        allEntries.push({
          source: collectionKey,
          topic: entry.eventType || entry.topic || null,
          contentUrl: entry.linkedContent?.url || null,
          postedAt: entry.postedAt,
          content: entry.content
        });
      });
    }
    
    // Extract unique topics and URLs
    const topics = [...new Set(allEntries.map(e => e.topic).filter(Boolean))];
    const contentUrls = [...new Set(allEntries.map(e => e.contentUrl).filter(Boolean))];
    
    return {
      topics,
      contentUrls,
      entries: allEntries,
      queriedCollections: collections,
      dateRange: { start: startDate, end: endDate }
    };
    
  } catch (error) {
    console.error('❌ Error querying recent content:', error.message);
    return { topics: [], contentUrls: [], entries: [] };
  } finally {
    if (client) await client.close();
  }
}

/**
 * Get today's covered topics across all content types
 */
async function getTodaysCoveredTopics() {
  const result = await getRecentContent({
    collections: ['dailyLessons', 'signalReports'],
    todayOnly: true
  });
  
  return {
    topics: result.topics,
    bySource: {
      dailyLessons: result.entries.filter(e => e.source === 'dailyLessons').map(e => e.topic).filter(Boolean),
      signalReports: result.entries.filter(e => e.source === 'signalReports').map(e => e.topic).filter(Boolean)
    }
  };
}

/**
 * Check if a topic is fresh (not recently used)
 */
async function isTopicFresh(topic, options = {}) {
  const {
    daysBack = CONFIG.defaults.topicCooldownDays,
    excludeToday = false
  } = options;
  
  const result = await getRecentContent({
    collections: ['dailyLessons', 'signalReports'],
    daysBack,
    todayOnly: false
  });
  
  let topicsToCheck = result.topics;
  
  if (excludeToday) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    topicsToCheck = result.entries
      .filter(e => e.postedAt < todayStart)
      .map(e => e.topic)
      .filter(Boolean);
  }
  
  return !topicsToCheck.includes(topic);
}

/**
 * Check if a content URL is fresh (not recently linked)
 */
async function isContentUrlFresh(url, daysBack = CONFIG.defaults.contentCooldownDays) {
  const result = await getRecentContent({
    collections: ['dailyLessons'],
    daysBack
  });
  
  return !result.contentUrls.includes(url);
}

// ============================================================================
// SMART TOPIC SELECTION
// ============================================================================

/**
 * Suggest the best topic to use, considering freshness and deduplication
 * 
 * @param {Array} articles - Articles to analyze
 * @param {Object} options
 * @param {string[]} options.avoidTopics - Topics to explicitly avoid
 * @param {string} options.callerType - 'dailyLesson' or 'signalReport'
 * @param {boolean} options.checkSameDayConflict - Check if other module used this topic today
 */
async function suggestTopic(articles, options = {}) {
  const {
    avoidTopics = [],
    callerType = null,
    checkSameDayConflict = true
  } = options;
  
  // 1. Detect all topics from articles
  const detectedTopics = detectTopics(articles);
  
  if (detectedTopics.length === 0) {
    return { topic: 'general', reason: 'no_topics_detected', alternatives: [] };
  }
  
  // 2. Get what's been covered recently
  const recentContent = await getRecentContent({
    collections: ['dailyLessons', 'signalReports'],
    daysBack: CONFIG.defaults.topicCooldownDays
  });
  
  // 3. Get today's topics (for same-day conflict check)
  let todaysTopics = [];
  if (checkSameDayConflict && callerType) {
    const todayCovered = await getTodaysCoveredTopics();
    // Get topics from the OTHER module
    if (callerType === 'dailyLesson') {
      todaysTopics = todayCovered.bySource.signalReports;
    } else if (callerType === 'signalReport') {
      todaysTopics = todayCovered.bySource.dailyLessons;
    }
  }
  
  // 4. Build avoid list
  const fullAvoidList = [
    ...avoidTopics,
    ...todaysTopics, // Same-day conflict
    ...recentContent.topics.filter(t => !todaysTopics.includes(t)) // Recent topics (excluding today which is already checked)
  ];
  
  // 5. Find best available topic
  for (const topicData of detectedTopics) {
    if (!fullAvoidList.includes(topicData.topic)) {
      return {
        topic: topicData.topic,
        score: topicData.weightedScore,
        reason: 'fresh_topic',
        alternatives: detectedTopics.slice(1, 4).map(t => t.topic),
        avoided: fullAvoidList
      };
    }
  }
  
  // 6. If all detected topics are in avoid list, return primary with warning
  const primaryTopic = detectedTopics[0].topic;
  const sameDayConflict = todaysTopics.includes(primaryTopic);
  
  return {
    topic: primaryTopic,
    score: detectedTopics[0].weightedScore,
    reason: sameDayConflict ? 'same_day_conflict' : 'all_topics_recent',
    warning: sameDayConflict 
      ? `Topic "${primaryTopic}" was already covered today by another module`
      : `Topic "${primaryTopic}" was recently covered`,
    alternatives: detectedTopics.slice(1, 4).map(t => t.topic),
    avoided: fullAvoidList
  };
}

/**
 * Filter content options by freshness
 * 
 * @param {Array} contentOptions - Array of { url, name, ... } objects
 * @param {number} daysBack - Days to check for recent usage
 */
async function filterFreshContent(contentOptions, daysBack = CONFIG.defaults.contentCooldownDays) {
  if (!contentOptions || contentOptions.length === 0) return [];
  
  const recentContent = await getRecentContent({
    collections: ['dailyLessons'],
    daysBack
  });
  
  const freshContent = contentOptions.filter(c => 
    !recentContent.contentUrls.includes(c.url)
  );
  
  console.log(`📊 Content freshness: ${freshContent.length}/${contentOptions.length} options are fresh`);
  
  return freshContent.length > 0 ? freshContent : contentOptions;
}

// ============================================================================
// LOGGING & DEBUGGING
// ============================================================================

/**
 * Log deduplication status for debugging
 */
async function logDeduplicationStatus() {
  console.log('\n📊 === DEDUPLICATION STATUS ===');
  
  const todayCovered = await getTodaysCoveredTopics();
  console.log(`Today's topics: ${todayCovered.topics.join(', ') || 'none'}`);
  console.log(`  - Daily Lessons: ${todayCovered.bySource.dailyLessons.join(', ') || 'none'}`);
  console.log(`  - Signal Reports: ${todayCovered.bySource.signalReports.join(', ') || 'none'}`);
  
  const recentContent = await getRecentContent({
    daysBack: CONFIG.defaults.topicCooldownDays
  });
  console.log(`\nRecent topics (${CONFIG.defaults.topicCooldownDays} days): ${recentContent.topics.join(', ') || 'none'}`);
  console.log(`Recent content URLs: ${recentContent.contentUrls.length} unique`);
  
  console.log('=================================\n');
  
  return { todayCovered, recentContent };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Configuration
  CONFIG,
  TOPIC_DEFINITIONS,
  getTopicDefinitions,
  getTopicKeywords,
  
  // Topic Detection
  detectTopics,
  detectPrimaryTopic,
  detectTopTopics,
  
  // Database Queries
  getRecentContent,
  getTodaysCoveredTopics,
  isTopicFresh,
  isContentUrlFresh,
  
  // Smart Selection
  suggestTopic,
  filterFreshContent,
  
  // Debugging
  logDeduplicationStatus
};

