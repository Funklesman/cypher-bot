/**
 * Kodex Academy TweetBot - Main Module
 * 
 * This file brings together all the bot's functionality and
 * exports a clean interface for the scripts to use.
 */

const axios = require('axios');
const OpenAI = require('openai');
const cron = require('node-cron');
const Parser = require('rss-parser');
const fs = require('fs');
const { crossPostToSocialMedia } = require('./crosspost/integrated-cross-poster');
let Mastodon;

try {
    Mastodon = require('mastodon-api');
} catch (error) {
    console.log('Mastodon API not available, will run in content generation mode only');
}

require('dotenv').config();

// Import MongoDB client factory
const DBClientFactory = require('./db_client_factory');
const dbClient = DBClientFactory.createClient();

// OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Mastodon API client (if configured)
let mastodon;
const isMastodonConfigured = process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_API_URL;

if (isMastodonConfigured && Mastodon) {
    mastodon = new Mastodon({
        access_token: process.env.MASTODON_ACCESS_TOKEN,
        api_url: process.env.MASTODON_API_URL,
        // TEMPORARY: Bypass SSL certificate verification for expired cert
        rejectUnauthorized: false
    });
    console.log('✅ Connected to Mastodon API (SSL bypass enabled)');
} else {
    console.log('⚠️ Mastodon integration not configured, running in content generation mode only');
}

// Initialize RSS parser
const parser = new Parser();

// Add this variable at the top of the file, near other global variables
const processingArticles = new Map(); // Track articles currently being processed

// Import ContentDeduplicator
const ContentDeduplicator = require('./content_deduplicator');

// Import V2 prompt system
const promptsV2 = require('./tweet_prompts_v2');
const contentDeduplicator = new ContentDeduplicator();

// Validate environment variables
function validateEnvVariables() {
    const required = [
        'OPENAI_API_KEY',
        'NEWS_API_KEY'
    ];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// Add delay utility function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Import improved RSS-based news sources
const { fetchNews: fetchNewsFromRSS, clearCache: clearRSSCache, getCacheStats: getRSSCacheStats } = require('./improved_news_sources');

// Old RSS functions removed - replaced with improved_news_sources.js

// Fetch news from CoinDesk RSS
async function fetchCoinDeskRSS() {
    try {
        const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
        return feed.items.slice(0, 3).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'CoinDesk',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from CoinDesk:', error);
        return [];
    }
}

// Fetch news from Decrypt RSS
async function fetchDecryptRSS() {
    try {
        const feed = await parser.parseURL('https://decrypt.co/feed');
        return feed.items.slice(0, 3).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'Decrypt',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from Decrypt:', error);
        return [];
    }
}

// Fetch news from CryptoPotato RSS
async function fetchCryptoPotatoRSS() {
    try {
        const feed = await parser.parseURL('https://cryptopotato.com/feed/');
        return feed.items.slice(0, 2).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'CryptoPotato',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from CryptoPotato:', error);
        return [];
    }
}

// Fetch news from Bitcoin Magazine RSS
async function fetchBitcoinMagazineRSS() {
    try {
        const feed = await parser.parseURL('https://bitcoinmagazine.com/.rss/full/');
        return feed.items.slice(0, 2).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'BitcoinMagazine',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from Bitcoin Magazine:', error);
        return [];
    }
}

// Check if content is crypto-relevant using keywords (fallback method)
function isCryptoRelevantByKeywords(title, description) {
    const cryptoKeywords = [
        // Cryptocurrencies
        'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'blockchain', 'token', 'coinbase', 'binance',
        'defi', 'nft', 'wallet', 'mining', 'altcoin', 'stablecoin', 'dapp', 'dao', 'web3',
        'decentralized', 'smart contract', 'cryptocurrency', 'satoshi', 'nakamoto', 'hodl',
        'exchange', 'ledger', 'tether', 'usdt', 'usdc', 'ripple', 'xrp', 'cardano', 'ada',
        'solana', 'sol', 'polkadot', 'dogecoin', 'shiba inu', 'avalanche', 'avax', 'metaverse',
        
        // Companies and Institutions
        'blackrock', 'coindesk', 'theblock', 'decrypt', 'binance', 'fidelity', 'grayscale',
        'kraken', 'gemini', 'bitfinex', 'bitstamp', 'bitpay', 'blockfi', 'circle', 'bnb',
        'consensys', 'chainlink', 'metamask', 'opensea', 'uniswap', 'aave', 'compound',
        
        // Concepts and tech
        'cbdc', 'digital asset', 'tokenization', 'hashrate', 'proof of stake', 'pos', 'proof of work',
        'pow', 'fork', 'halving', 'merkle', 'node', 'public key', 'private key', 'seed phrase',
        'cold storage', 'hot wallet', 'layer 2', 'l2', 'mainnet', 'testnet', 'gas fee',
        'protocol', 'yield', 'staking', 'liquidity', 'amm', 'dex', 'cex', 'ico', 'ido', 'ieo',
        
        // Regulations and institutions
        'sec', 'cftc', 'otc', 'etf', 'etp', 'spot etf', 'futures etf', 'custody', 
        'kyc', 'aml', 'regulation', 'compliance'
    ];
    
    // Convert to lowercase for case-insensitive matching
    const content = (title + ' ' + (description || '')).toLowerCase();
    
    // Count matches for debugging
    const matches = cryptoKeywords.filter(keyword => {
        // For multi-word keywords, check exact match
        if (keyword.includes(' ')) {
            return content.includes(keyword.toLowerCase());
        } 
        // For single words, check for word boundaries to avoid partial matches
        // (e.g., "coin" shouldn't match "bitcoin")
        else {
            const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`);
            return regex.test(content);
        }
    });
    
    // If matches found, log them for debugging
    if (matches.length > 0) {
        console.log(`📌 Crypto keywords detected: ${matches.join(', ')}`);
        return true;
    }
    
    return false;
}

// Determine sentiment and relevance based on content using OpenAI
async function analyzeArticleContent(title, description, source) {
    // List of crypto-specific sources that should always be considered relevant
    const cryptoSpecificSources = ['CoinDesk', 'TheBlock', 'Decrypt', 'CryptoPotato', 'BitcoinMagazine', 'Defiant'];
    
    // If it's from a crypto-specific source, it's automatically crypto-related
    if (cryptoSpecificSources.includes(source)) {
        console.log(`🔍 Article from ${source} - Automatically considered crypto-relevant`);
        
        // For The Defiant, still analyze sentiment
        if (source === 'Defiant') {
            try {
                const sentimentResponse = await openai.chat.completions.create({
                    model: "gpt-5.1",
                    messages: [
                        {
                            role: "system",
                            content: `You analyze sentiment in cryptocurrency news from a decentralization-first perspective. Classify each article as 'positive', 'neutral', or 'negative' based on the content. Slight skepticism toward centralization is appropriate.

**Positive**:
- Tech that improves decentralization
- Community-led progress
- Open-source & protocol upgrades
- Security improvements
- Education & retail growth
- User-focused infrastructure

**Neutral**:
- Routine updates or announcements with no institutional impact
- Price moves without broader impact or institutional involvement
- Balanced regulatory discussions without overreach
- Minor institutional involvement without market dominance
- Technical updates without centralization implications

**Negative**:
- Centralization efforts
- Regulatory uncertainty or hostility
- Hacks, scams, manipulation
- Project collapse or abandonment
- Institutional involvement with potential centralization risks
- Regulatory discussions with potential overreach
- Major institutional expansion into crypto
- Regulatory changes that could impact decentralization
- Corporate control or consolidation of power
- Institutional market dominance

IMPORTANT: Be generous in considering articles as relevant to crypto. 
If the article mentions any of these topics, even briefly, it should be marked as relevant:
- Bitcoin, Ethereum, or any cryptocurrency
- Blockchain technology or applications
- Web3, DeFi, NFTs, DAOs
- Crypto exchanges or trading platforms
- Digital assets or tokenization
- Crypto regulation or legal developments
- Central bank digital currencies (CBDCs)
- Companies investing in or using crypto/blockchain

Respond with a JSON object containing:
{
    "sentiment": "positive", "negative", or "neutral",
    "isRelevant": true/false,
    "explanation": "Brief explanation of your decision"
}`
                        },
                        {
                            role: "user",
                            content: `Analyze the sentiment of this crypto news:\nTitle: ${title}\nDescription: ${description}`
                        }
                    ],
                    response_format: { type: "json_object" }
                });
                
                const result = JSON.parse(sentimentResponse.choices[0].message.content.trim());
                
                let finalSentiment = 'neutral';
                if (result.sentiment === 'positive') finalSentiment = 'positive';
                if (result.sentiment === 'negative') finalSentiment = 'negative';
                
                console.log(`🔍 Defiant Article - Sentiment Analysis: ${finalSentiment}`);
                return {
                    sentiment: finalSentiment,
                    isRelevant: true,
                    hasOpportunity: false // Always false, regardless of sentiment
                };
            } catch (error) {
                console.error('Error analyzing Defiant content sentiment:', error);
                return {
                    sentiment: determineSentimentByKeywords(title, description),
                    isRelevant: true,
                    hasOpportunity: false // Always false
                };
            }
        }
        
        // For other crypto-specific sources, analyze sentiment and opportunity
        try {
            const sentimentResponse = await openai.chat.completions.create({
                model: "gpt-5.1",
                messages: [
                    {
                        role: "system",
                        content: `You analyze sentiment in cryptocurrency news from a decentralization-first perspective. Classify each article as 'positive', 'neutral', or 'negative' based on the content. Slight skepticism toward centralization is appropriate.

**Positive**:
- Tech that improves decentralization
- Community-led progress
- Open-source & protocol upgrades
- Security improvements
- Education & retail growth
- User-focused infrastructure

**Neutral**:
- Routine updates or announcements with no institutional impact
- Price moves without broader impact or institutional involvement
- Balanced regulatory discussions without overreach
- Minor institutional involvement without market dominance
- Technical updates without centralization implications

**Negative**:
- Centralization efforts
- Regulatory uncertainty or hostility
- Hacks, scams, manipulation
- Project collapse or abandonment
- Institutional involvement with potential centralization risks
- Regulatory discussions with potential overreach
- Major institutional expansion into crypto
- Regulatory changes that could impact decentralization
- Corporate control or consolidation of power
- Institutional market dominance

IMPORTANT: Be generous in considering articles as relevant to crypto. 
If the article mentions any of these topics, even briefly, it should be marked as relevant:
- Bitcoin, Ethereum, or any cryptocurrency
- Blockchain technology or applications
- Web3, DeFi, NFTs, DAOs
- Crypto exchanges or trading platforms
- Digital assets or tokenization
- Crypto regulation or legal developments
- Central bank digital currencies (CBDCs)
- Companies investing in or using crypto/blockchain

Respond with a JSON object containing:
{
    "sentiment": "positive", "negative", or "neutral",
    "isRelevant": true/false,
    "explanation": "Brief explanation of your decision"
}`
                    },
                    {
                        role: "user",
                        content: `Analyze this crypto news:
Title: ${title}
Description: ${description}`
                    }
                ],
                response_format: { type: "json_object" }
            });
            
            const result = JSON.parse(sentimentResponse.choices[0].message.content.trim());
            
            return {
                sentiment: result.sentiment || 'neutral',
                isRelevant: true, // Always relevant for crypto-specific sources
                hasOpportunity: false // Always false, ignoring result.hasOpportunity
            };
        } catch (error) {
            console.error(`Error analyzing ${source} article sentiment:`, error);
            return {
                sentiment: determineSentimentByKeywords(title, description),
                isRelevant: true, // Always relevant for crypto-specific sources
                hasOpportunity: false // Always false
            };
        }
    }
    
    // For non-crypto-specific sources (like NewsAPI), first check keywords
    const keywordRelevant = isCryptoRelevantByKeywords(title, description);
    
    // If it's clearly relevant by keywords, just analyze sentiment
    if (keywordRelevant) {
        console.log('🔍 Article found relevant by keyword detection');
        try {
                    const sentimentResponse = await openai.chat.completions.create({
            model: "gpt-5.1",
                messages: [
                    {
                        role: "system",
                        content: "You analyze cryptocurrency news sentiment from a decentralization-first perspective. Classify articles based on whether they support or hinder decentralization principles. Show moderate skepticism toward centralization, corporate control, and institutional dominance. Favor community governance over centralized authority. Respond with a JSON object containing 'sentiment' (positive/negative/neutral) field."
                    },
                    {
                        role: "user",
                        content: `Analyze this crypto news:
Title: ${title}
Description: ${description}`
                    }
                ],
                response_format: { type: "json_object" }
            });
            
            const result = JSON.parse(sentimentResponse.choices[0].message.content.trim());
            
            return {
                sentiment: result.sentiment || 'neutral',
                isRelevant: true,
                hasOpportunity: false // Always false, ignoring result.hasOpportunity
            };
        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            return {
                sentiment: determineSentimentByKeywords(title, description),
                isRelevant: true,
                hasOpportunity: false // Always false
            };
        }
    }
    
    // For all other non-obvious cases, use full AI analysis
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: `You analyze sentiment in cryptocurrency news from a decentralization-first perspective. Classify each article as 'positive', 'neutral', or 'negative' based on the content. Moderate skepticism toward centralization and institutional control is appropriate.

**Positive**:
- Tech that improves decentralization
- Community-led progress and grassroots initiatives 
- Open-source & protocol upgrades
- Security improvements that preserve user autonomy
- Education & retail adoption (not institutional)
- User-focused infrastructure that reduces dependencies

**Neutral**:
- Routine updates or announcements
- Price moves without broader impact
- Balanced regulatory discussions without overreach
- Minor institutional involvement without market dominance

**Negative**:
- Centralization efforts or consolidation of power
- Corporate control that limits user autonomy
- Regulatory overreach or surveillance potential
- Institutions with dominant market influence
- Hacks, scams, manipulation
- Project collapse or abandonment
- Developments that could lead to centralized control

IMPORTANT: Be generous in considering articles as relevant to crypto. 
If the article mentions any of these topics, even briefly, it should be marked as relevant:
- Bitcoin, Ethereum, or any cryptocurrency
- Blockchain technology or applications
- Web3, DeFi, NFTs, DAOs
- Crypto exchanges or trading platforms
- Digital assets or tokenization
- Crypto regulation or legal developments
- Central bank digital currencies (CBDCs)
- Companies investing in or using crypto/blockchain

Respond with a JSON object containing:
{
    "sentiment": "positive", "negative", or "neutral",
    "isRelevant": true/false,
    "explanation": "Brief explanation of your decision"
}`
                },
                {
                    role: "user",
                    content: `Analyze this news article:
Title: ${title}
Description: ${description || "No description available"}
Source: ${source}`
                }
            ],
            response_format: { type: "json_object" }
        });
        
        try {
            const result = JSON.parse(response.choices[0].message.content.trim());
            console.log(`🔍 AI Analysis: Sentiment=${result.sentiment}, Relevant=${result.isRelevant}, Opportunity=${result.hasOpportunity}`);
            if (result.explanation) {
                console.log(`🔍 Explanation: ${result.explanation}`);
            }
            
            // Double-check with keywords if AI says not relevant
            if (result.isRelevant !== true) {
                // Check keywords one more time as a safeguard
                const keywordCheck = isCryptoRelevantByKeywords(title, description);
                if (keywordCheck) {
                    console.log('🔄 AI marked as not relevant, but keyword check says it is relevant - overriding');
                    result.isRelevant = true;
                }
            }
            
            return {
                sentiment: result.sentiment || 'neutral',
                isRelevant: result.isRelevant === true,
                hasOpportunity: false // Always false, ignoring result.hasOpportunity
            };
        } catch (parseError) {
            console.error('Error parsing JSON from OpenAI:', parseError);
            
            // Fallback to basic keyword matching
            return {
                sentiment: determineSentimentByKeywords(title, description),
                isRelevant: isCryptoRelevantByKeywords(title, description),
                hasOpportunity: false // Already false in original
            };
        }
    } catch (error) {
        console.error('Error analyzing content with AI:', error);
        
        // Fallback to basic keyword matching
        return {
            sentiment: determineSentimentByKeywords(title, description),
            isRelevant: isCryptoRelevantByKeywords(title, description),
            hasOpportunity: false // Already false in original
        };
    }
}

// Determine sentiment using keywords (fallback method)
function determineSentimentByKeywords(title, description) {
    const content = (title + ' ' + (description || '')).toLowerCase();
    
    const positiveWords = ['gain', 'rally', 'surge', 'adoption', 'bullish', 'success', 'breakthrough', 'partnership', 'growth', 'milestone', 'launch', 'opportunity', 'solution', 'innovation', 'advance', 'progress', 'profit', 'win', 'positive', 'upward', 'beneficial'];
    const negativeWords = ['hack', 'scam', 'crash', 'loss', 'bearish', 'risk', 'fraud', 'collapse', 'investigation', 'ban', 'stolen', 'exploit', 'vulnerability', 'concern', 'warning', 'downturn', 'decline', 'threat', 'problem', 'fail', 'danger'];
    
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    
    if (positiveCount > negativeCount) {
        return 'positive';
    } else if (negativeCount > positiveCount) {
        return 'negative';
    } else {
        return 'neutral';
    }
}

// Combined fetch news function
async function fetchNews(maxAgeHours = 12) {
    try {
        // Use improved RSS-based news fetching (already filtered and sorted)
        console.log('🔄 Using improved RSS-based news sources...');
        const recentArticles = await fetchNewsFromRSS(maxAgeHours);
        
        console.log(`📊 Retrieved ${recentArticles.length} articles from RSS sources (last ${maxAgeHours} hours)`);
        
        // Log the relevant articles
        recentArticles.forEach(article => {
            console.log(`📆 Article: ${article.title} | Source: ${article.source} | Published: ${article.publishedAt.toISOString()}`);
        });
        
        // NEW: Perform early duplicate detection across sources
        const uniqueArticles = [];
        for (const article of recentArticles) {
            // Quickly check title similarity with already added articles
            let isDuplicate = false;
            for (const existingArticle of uniqueArticles) {
                // Check if this article might be about the same story from a different source
                // First extract project names from both articles
                const projectNames1 = contentDeduplicator.extractProjectNames(article.title + ' ' + (article.description || ''));
                const projectNames2 = contentDeduplicator.extractProjectNames(existingArticle.title + ' ' + (existingArticle.description || ''));
                
                // If they mention the same projects
                const projectOverlap = projectNames1.filter(name => projectNames2.includes(name)).length;
                
                // And have similar event keywords
                const events1 = contentDeduplicator.extractEventKeywords(article.title + ' ' + (article.description || ''));
                const events2 = contentDeduplicator.extractEventKeywords(existingArticle.title + ' ' + (existingArticle.description || ''));
                
                const hasEventOverlap = events1.some(event => events2.includes(event));
                
                // Calculate title similarity
                const titleSimilarity = contentDeduplicator.calculateTitleSimilarity(article.title, existingArticle.title);
                
                // If all indicators point to the same story, mark as duplicate
                if ((projectOverlap > 0 && hasEventOverlap) || 
                    (projectOverlap >= 2) || 
                    (titleSimilarity > 0.6)) {
                    
                    // Log the duplicate detection
                    console.log(`🔄 Possible cross-source duplicate detected:`);
                    console.log(`  - Original: "${existingArticle.title}" (${existingArticle.source})`);
                    console.log(`  - Duplicate: "${article.title}" (${article.source})`);
                    console.log(`  - Project overlap: ${projectOverlap}, Event overlap: ${hasEventOverlap}, Title similarity: ${Math.round(titleSimilarity * 100)}%`);
                    
                    // Important: Keep the article from the higher priority source
                    const sourcePriority1 = contentDeduplicator.sourcePriority[article.source] || 999;
                    const sourcePriority2 = contentDeduplicator.sourcePriority[existingArticle.source] || 999;
                    
                    if (sourcePriority1 < sourcePriority2) {
                        // The new article is from a higher priority source, replace the existing one
                        console.log(`  - Keeping article from ${article.source} (higher priority source)`);
                        const index = uniqueArticles.indexOf(existingArticle);
                        uniqueArticles[index] = article;
                    } else {
                        // Keep existing article from higher priority source
                        console.log(`  - Keeping article from ${existingArticle.source} (higher priority source)`);
                    }
                    
                    isDuplicate = true;
                    break;
                }
            }
            
            // Add to unique articles list if not a duplicate
            if (!isDuplicate) {
                uniqueArticles.push(article);
            }
        }
        
        console.log(`📊 After cross-source duplicate removal: ${uniqueArticles.length} unique articles (removed ${recentArticles.length - uniqueArticles.length} duplicates)`);
        
        // Filter out already processed articles using Python DB client
        const filteredArticles = [];
        for (const article of uniqueArticles) {
            const processed = await dbClient.isArticleProcessed(article.url);
            if (!processed) {
                filteredArticles.push(article);
            } else {
                console.log(`Skipping already processed article: ${article.title}`);
            }
        }
        
        // ALSO check Redis for similar past content
        const dedupFilteredArticles = [];
        for (const article of filteredArticles) {
            // Check if similar to previously posted content
            const isSimilar = await contentDeduplicator.isSimilarToCached(article, article.title);
            if (!isSimilar) {
                dedupFilteredArticles.push(article);
            } else {
                console.log(`Skipping article similar to previously posted content: ${article.title}`);
            }
        }
        
        // Apply advanced article selection (AI analysis, clustering, and diversity)
        const enhancedArticles = await enhanceArticleSelection(dedupFilteredArticles);
        
        // Log article scores for debugging
        console.log('\n📊 Article scores:');
        for (const article of enhancedArticles) {
            console.log(`- "${article.title.substring(0, 50)}..." | Raw Score: ${article.score || 'N/A'} | Importance: ${article.importanceScore || 'N/A'}/10 | Source: ${article.source}`);
        }
        
        // Sort articles by importance score (highest first)
        enhancedArticles.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));
        
        // Print the top article that will be selected
        if (enhancedArticles.length > 0) {
            console.log(`\n📝 Selected top article: "${enhancedArticles[0].title}" | Raw Score: ${enhancedArticles[0].score || 'N/A'} | Importance: ${enhancedArticles[0].importanceScore || 'N/A'}/10`);
        }
        
        return enhancedArticles;
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
}

// Store recent topics to ensure diversity
const recentTopics = [];
const MAX_RECENT_TOPICS = 10;

// Score an article based on various factors
function scoreArticle(article) {
    let score = 0;
     
    // Score based on description length (better content)
    if (article.description) {
        score += Math.min(10, article.description.length / 30);
    }
     
    // Score based on recency
    const ageInHours = (Date.now() - article.publishedAt) / (1000 * 60 * 60);
    score += Math.max(0, 10 - ageInHours);
     
    // Bonus for trusted sources
    if (['Decrypt', 'CoinDesk', 'TheBlock'].includes(article.source)) {
        score += 5;
    }
     
    // Bonus for important keywords
    const importantKeywords = ['regulation', 'adoption', 'launch', 'partnership', 'breakthrough', 'SEC', 'ETF', 'update'];
    importantKeywords.forEach(keyword => {
        if (article.title.toLowerCase().includes(keyword.toLowerCase())) {
            score += 3;
        }
    });
     
    return score;
}

// Phase 2: Combined AI analysis for importance, urgency, and categorization
async function analyzeArticleComprehensive(article) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: `You are an expert cryptocurrency analyst. Evaluate this crypto news article for importance, urgency, and categorization.
                    Respond with a JSON object containing:
                    1. "importanceScore": number from 1-10 (10 being extremely important to crypto community)
                    2. "urgencyScore": number from 1-10 (10 being requires immediate attention)
                    3. "topic": main topic (one of: "Bitcoin", "Ethereum", "Altcoins", "DeFi", "NFT", "Regulation", "Adoption", "Security", "Technology", "Market")
                    4. "keywords": array of 3-5 keywords extracted from the article
                    5. "justification": brief explanation of importance and urgency scores
                    6. "urgencyKeywords": array of urgent-related keywords if urgency > 7
                    
                    Urgency factors: Security incidents (9-10), market crashes (8-9), regulatory actions (7-9), major launches (6-8), breaking news (5-7)`
                },
                {
                    role: "user",
                    content: `Title: ${article.title}
                    Description: ${article.description || "No description available"}
                    Source: ${article.source}
                    Published: ${article.publishedAt.toISOString()}
                    
                    Analyze this article's importance, urgency, and categorization.`
                }
            ],
            response_format: { type: "json_object" }
        });
        
        const result = JSON.parse(response.choices[0].message.content.trim());
        console.log(`🧠 Phase 2 Analysis for "${article.title.substring(0, 40)}...": Importance: ${result.importanceScore}/10, Urgency: ${result.urgencyScore}/10, Topic: ${result.topic}`);
        
        // Calculate a base score (0-100) from the importance score (1-10)
        const baseScore = result.importanceScore * 10;
        
        // Add bonus for trusted sources
        let finalScore = baseScore;
        if (['Decrypt', 'CoinDesk', 'TheBlock'].includes(article.source)) {
            finalScore += 5;
        }
        
        // Add recency bonus (newer articles get slight preference)
        const ageInHours = (Date.now() - article.publishedAt) / (1000 * 60 * 60);
        const recencyBonus = Math.max(0, 5 - ageInHours);
        finalScore += recencyBonus;
        
        return {
            ...article,
            importanceScore: result.importanceScore,
            urgencyScore: result.urgencyScore,
            score: finalScore,
            topic: result.topic,
            keywords: result.keywords,
            justification: result.justification,
            urgencyJustification: result.justification,
            urgencyKeywords: result.urgencyKeywords || []
        };
    } catch (error) {
        console.error('Error in comprehensive article analysis:', error);
        // Fallback scoring if AI fails
        const fallbackScore = scoreArticle(article);
        return {
            ...article,
            importanceScore: Math.round(fallbackScore / 10),
            urgencyScore: 5, // Default mid-level urgency
            score: fallbackScore,
            topic: detectTopic(article),
            keywords: extractKeywords(article.title),
            justification: "Generated by fallback system",
            urgencyJustification: "Fallback scoring",
            urgencyKeywords: []
        };
    }
}

// Fallback topic detection (used if AI fails)
function detectTopic(article) {
    const title = article.title.toLowerCase();
    const topics = {
        "Bitcoin": ["bitcoin", "btc", "satoshi", "nakamoto"],
        "Ethereum": ["ethereum", "eth", "vitalik", "buterin", "gas fee"],
        "Altcoins": ["altcoin", "dogecoin", "cardano", "solana", "ripple", "xrp"],
        "DeFi": ["defi", "yield", "farming", "staking", "liquidity", "swap"],
        "NFT": ["nft", "non-fungible", "collectible", "art", "auction"],
        "Regulation": ["regulation", "sec", "cftc", "law", "compliance", "government"],
        "Adoption": ["adoption", "mainstream", "institution", "company", "bank", "corporate"],
        "Security": ["security", "hack", "exploit", "vulnerability", "stolen", "theft"],
        "Technology": ["blockchain", "protocol", "update", "upgrade", "fork", "layer"],
        "Market": ["price", "market", "rally", "crash", "bull", "bear", "trend"]
    };
    
    // Find which topic has the most keyword matches
    let bestTopic = "Market"; // default
    let maxMatches = 0;
    
    for (const [topic, keywords] of Object.entries(topics)) {
        const matches = keywords.filter(keyword => title.includes(keyword)).length;
        if (matches > maxMatches) {
            maxMatches = matches;
            bestTopic = topic;
        }
    }
    
    return bestTopic;
}

// Extract keywords from text
function extractKeywords(text) {
    if (!text) return [];
    
    // Remove special characters and convert to lowercase
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    
    // Split into words
    const words = cleanText.split(/\s+/).filter(word => word.length > 3);
    
    // Remove common stopwords
    const stopwords = ['the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'has', 'been', 'were', 'are', 'they', 'their', 'said', 'says', 'will', 'over', 'more', 'what', 'when', 'where', 'which', 'than', 'your', 'about'];
    
    return words.filter(word => !stopwords.includes(word));
}

// Check if we've recently covered this topic
function isRecentTopic(topic) {
    return recentTopics.includes(topic);
}

// Add a topic to recent topics list
function addToRecentTopics(topic) {
    recentTopics.unshift(topic);
    if (recentTopics.length > MAX_RECENT_TOPICS) {
        recentTopics.pop();
    }
}

// Advanced article selection process (Phase 1: Optimized for 2 posts/day + diary data)
async function enhanceArticleSelection(articles) {
    try {
        console.log(`🔍 Phase 1 Processing: Analyzing ${articles.length} articles...`);
        
        // Limit to top 20 articles before AI analysis to reduce costs
        const candidates = articles.slice(0, 20);
        console.log(`📊 Selected top ${candidates.length} candidates for AI analysis`);
        
        // Use AI to analyze importance for each candidate article
        const analyzedArticles = [];
        for (const article of candidates) {
            try {
                // Add topic and keywords
                article.topic = detectTopic(article);
                article.keywords = extractKeywords(article.title + ' ' + article.description);
                
                // Phase 2: Use comprehensive AI analysis (combines importance + urgency in 1 call)
                const analyzedArticle = await analyzeArticleComprehensive(article);
                
                analyzedArticles.push(analyzedArticle);
                
                // Log the AI analysis for each article - include both scores
                console.log(`✅ AI analyzed "${article.title.substring(0, 40)}..." - Importance: ${analyzedArticle.importanceScore}/10, Urgency: ${analyzedArticle.urgencyScore}/10`);
            } catch (error) {
                // Fallback to basic scoring if AI analysis fails
                console.error(`Error analyzing article "${article.title.substring(0, 40)}...": ${error.message}`);
                article.score = scoreArticle(article);
                article.importanceScore = Math.round(article.score / 10);
                article.urgencyScore = 5; // Default mid-level urgency
                article.topic = article.topic || detectTopic(article);
                article.keywords = article.keywords || extractKeywords(article.title);
                article.justification = "Scored using fallback algorithm";
                analyzedArticles.push(article);
                
                // Log the fallback scoring
                console.log(`🔄 Fallback scoring for "${article.title.substring(0, 40)}..." - Importance: ${article.importanceScore}/10`);
            }
        }

        // Use ContentDeduplicator to cluster articles and check for duplicates
        const clusters = await contentDeduplicator.clusterArticles(analyzedArticles);
        
        // Select the highest scoring article from each cluster
        const selectedArticles = clusters.map(cluster => 
            cluster.reduce((best, current) => 
                (current.importanceScore || 0) > (best.importanceScore || 0) ? current : best
            )
        );

        // Sort by importanceScore for better article selection
        const sortedArticles = selectedArticles.sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));
        
        // Return top 15 articles for diary data (instead of limiting to fewer)
        const finalSelection = sortedArticles.slice(0, 15);
        
        // Log article scores for debugging
        console.log('\n📊 Phase 1 Final Results:');
        for (const article of finalSelection) {
            console.log(`- "${article.title.substring(0, 50)}..." | Importance: ${article.importanceScore}/10, Source: ${article.source}`);
        }
        
        console.log(`🎯 Phase 1 Complete: Selected ${finalSelection.length} articles (top 1 for posting, all ${finalSelection.length} for diary)`);
        return finalSelection;
    } catch (error) {
        console.error('Error in enhanceArticleSelection:', error);
        return articles;
    }
}

// Generate dynamic, relevant hashtags for the content
async function generateDynamicHashtags(title, description) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an AI that generates relevant crypto hashtags for social media posts. Analyze the given news content and generate hashtags that:
1. Are highly relevant to the specific news content.
2. Include a mix of general crypto terms and specific news-related terms.
3. Consider trending topics in the crypto space.
4. Include specific cryptocurrency names if mentioned.
5. Are formatted properly with a # symbol.
6. Do not duplicate concepts.

IMPORTANT: Return ONLY a valid JSON object with a 'hashtags' property containing an array of strings. Format your response as: {"hashtags": ["#hashtag1", "#hashtag2", ...]}
Do not include code blocks, markdown, or any other text in your response.`
                },
                {
                    role: "user",
                    content: `Generate relevant crypto hashtags for this news:
Title: ${title}
Description: ${description || "No description available"}

Your response must be a valid JSON object with a hashtags array.`
                }
            ],
            response_format: { type: "json_object" }
        });
        
        let hashtagArray;
        
        try {
            // First try direct JSON parsing
            const content = response.choices[0].message.content.trim();
            console.log(`Raw hashtag response: ${content.substring(0, 50)}...`);
            
            // Try to parse the response as JSON directly
            try {
                const parsed = JSON.parse(content);
                console.log('Successfully parsed hashtag response');
                
                // Handle both array and object responses
                if (Array.isArray(parsed)) {
                    // It's already an array, use it directly
                    hashtagArray = parsed;
                } else if (typeof parsed === 'object') {
                    // Check for a hashtags property (most likely case based on our prompt)
                    if (parsed.hashtags && Array.isArray(parsed.hashtags)) {
                        hashtagArray = parsed.hashtags;
                        console.log('Found hashtags array property');
                    } 
                    // Otherwise extract values that look like hashtags
                    else {
                        console.log('Object without hashtags property, extracting values');
                        // First try to find any array property
                        const arrayProps = Object.values(parsed).filter(val => Array.isArray(val));
                        if (arrayProps.length > 0) {
                            hashtagArray = arrayProps[0];
                        } else {
                            // Otherwise extract string values that might be hashtags
                            hashtagArray = Object.values(parsed)
                                .filter(val => typeof val === 'string')
                                .filter(val => val.includes('#') || !val.includes(' '));
                        }
                    }
                } else {
                    throw new Error("Response is not an array or object");
                }
            } catch (parseError) {
                // If direct parsing fails, try to extract JSON from the text
                console.log("Direct JSON parsing failed, trying to extract JSON...");
                
                // Last resort: extract hashtags using regex
                const hashtagRegex = /#\w+/g;
                const matches = content.match(hashtagRegex);
                if (matches && matches.length > 0) {
                    console.log('Extracting hashtags using regex');
                    hashtagArray = matches;
                } else {
                    console.log('No hashtags found, using defaults');
                    hashtagArray = ["#Crypto", "#Blockchain"];
                }
            }
            
            // Ensure we have a valid array
            if (!Array.isArray(hashtagArray)) {
                console.log('Invalid hashtagArray, using fallback');
                hashtagArray = ["#Crypto", "#Blockchain"];
            }
            
            // Format all hashtags properly and remove duplicates
            hashtagArray = [...new Set(hashtagArray)]
                .filter(tag => tag && typeof tag === 'string')
                .map(tag => {
                    tag = tag.trim();
                    // Remove any quotes or special characters
                    tag = tag.replace(/["'`]/g, '');
                    // Ensure it has a hashtag
                    return tag.startsWith('#') ? tag : `#${tag}`;
                });
            
            console.log(`Processed ${hashtagArray.length} hashtags:`, hashtagArray);
            
            // Ensure we have at least 2 hashtags, or use fallbacks
            if (hashtagArray.length < 2) {
                console.log("Not enough valid hashtags, using fallbacks");
                const fallbacks = ["#Crypto", "#Blockchain", "#Bitcoin", "#Ethereum", "#Web3"];
                while (hashtagArray.length < 2) {
                    hashtagArray.push(fallbacks[hashtagArray.length % fallbacks.length]);
                }
            }
            
            // Return the top 2 most relevant hashtags
            return hashtagArray.slice(0, 2);
        } catch (error) {
            console.error('Error parsing hashtag response:', error);
            console.log('Response content:', response.choices[0].message.content);
            return ["#Crypto", "#Blockchain"];
        }
    } catch (error) {
        console.error('Error generating dynamic hashtags:', error);
        return ["#Crypto", "#Blockchain"];
    }
}

// A small helper to pick a random element from an array
function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================================
// V2 PROMPT SYSTEM - MODE SELECTION
// ============================================================================

/**
 * Select tweet mode based on sentiment and urgency
 * Now includes TONE ROTATION to prevent all-negative feeds
 * 
 * @param {string} sentiment - 'positive', 'negative', or 'neutral'
 * @param {number} urgencyScore - 1-10 urgency score from article analysis
 * @returns {string} Mode name: 'negative'|'positive'|'neutral'|'breaking'|'opportunity'
 */
function selectTweetMode(sentiment, urgencyScore = 0) {
    // Breaking news takes priority (urgency >= 9)
    if (urgencyScore >= 9) {
        console.log(`🚨 High urgency (${urgencyScore}/10) → Breaking mode`);
        return 'breaking';
    }
    
    // TONE ROTATION: Even negative news can be framed constructively
    // 30% chance to flip negative → opportunity (find the silver lining)
    // 20% chance to flip negative → neutral (just observe, no doom)
    if (sentiment === 'negative') {
        const roll = Math.random();
        if (roll < 0.30) {
            console.log('📉 Negative sentiment BUT flipping → Opportunity mode (find the upside)');
            return 'opportunity';
        } else if (roll < 0.50) {
            console.log('📉 Negative sentiment BUT flipping → Neutral mode (just observe)');
            return 'neutral';
        }
        console.log('📉 Negative sentiment → Negative mode');
        return 'negative';
    }
    
    // Positive stays positive, but occasionally flip to opportunity for variety
    if (sentiment === 'positive') {
        if (Math.random() < 0.30) {
            console.log('📈 Positive sentiment → Opportunity mode (emphasize the door opening)');
            return 'opportunity';
        }
        console.log('📈 Positive sentiment → Positive mode');
        return 'positive';
    }
    
    // Neutral: sometimes flip to opportunity to add energy
    if (Math.random() < 0.25) {
        console.log('📊 Neutral sentiment → Opportunity mode (find something interesting)');
        return 'opportunity';
    }
    console.log('📊 Neutral sentiment → Neutral mode');
    return 'neutral';
}

// ============================================================================
// OLD PROMPT SYSTEM (V1) - DEPRECATED
// Kept for reference during transition, will be removed after V2 testing
// ============================================================================
// Lines 1077-1335 removed: negativePrompts, positivePrompts, neutralPrompts,
// opportunityPrompt, generateDynamicSystemPrompt(), getPromptVariation()
// Replaced by V2 system using tweet_prompts_v2.js

// Generate tweet content using OpenAI with dynamic components (V2 System)
async function generateTweet(event, retryCount = 0) {
    try {
        // 1. Generate relevant hashtags
        const hashtags = await generateDynamicHashtags(event.title, event.description);
        console.log('Generated hashtags:', hashtags);
        
        // 2. Analyze sentiment and relevance
        const analysis = await analyzeArticleContent(event.title, event.description, event.source);
        const sentiment = analysis.sentiment;
        console.log('Content sentiment:', sentiment);
        
        // Exit early if content is not crypto-relevant
        if (!analysis.isRelevant) {
            console.log('⏭️ Skipping non-crypto article');
            return null;
        }
        
        // 3. Select tweet mode based on sentiment and urgency (V2 System)
        const urgencyScore = event.urgencyScore || 0;
        const selectedMode = selectTweetMode(sentiment, urgencyScore);
        
        // 4. Build V2 system prompt for selected mode
        let systemPrompt = promptsV2.buildSystemPrompt(selectedMode);
        const promptType = `v2-${selectedMode}`;
        console.log(`✅ Using V2 prompt system: ${promptType}`);
        
        // 4b. Get last tweet opener to enforce variety
        const lastTweetOpener = await dbClient.getLastTweetOpener();
        if (lastTweetOpener) {
            const varietyInstruction = `

🚨 VARIETY ENFORCEMENT — YOUR LAST TWEET STARTED WITH:
"${lastTweetOpener.firstWords}..."
Category: ${lastTweetOpener.category}

THIS TWEET MUST:
- Start with a COMPLETELY DIFFERENT first word (not "${lastTweetOpener.firstWord}")
- Use a DIFFERENT opener category (not ${lastTweetOpener.category})
- Have a DIFFERENT sentence structure

If your last tweet started with a ${lastTweetOpener.category}, pick from: ${
    lastTweetOpener.category === 'NAME' ? 'NUMBER, TIME, ACTION, THING, or OBSERVATION' :
    lastTweetOpener.category === 'NUMBER' ? 'NAME, TIME, ACTION, THING, or OBSERVATION' :
    lastTweetOpener.category === 'TIME' ? 'NAME, NUMBER, ACTION, THING, or OBSERVATION' :
    lastTweetOpener.category === 'ACTION' ? 'NAME, NUMBER, TIME, THING, or OBSERVATION' :
    lastTweetOpener.category === 'THING' ? 'NAME, NUMBER, TIME, ACTION, or OBSERVATION' :
    'NAME, NUMBER, TIME, ACTION, or THING'
}`;
            systemPrompt += varietyInstruction;
            console.log(`🔄 Variety enforcement: Last tweet was ${lastTweetOpener.category}, must use different category`);
        }
        
        // 5. Build minimal user prompt (let system prompt lead)
        const userPrompt = `Article Title: ${event.title}

Context: ${event.description}

${event.content ? `Additional context: ${event.content.substring(0, 500)}` : ''}

Source: ${event.source}

Hashtags to include: ${hashtags.join(' ')}`;
        
        // 6. Generate the tweet content
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: userPrompt,
                },
            ],
            max_completion_tokens: 4000,
        });
        
        let content = response.choices[0].message.content.trim();
        console.log(`📏 Content length: ${content.length} characters`);
        
        // 7. SERVER-SIDE VALIDATION: Check for banned patterns (V2 System)
        
        // Primary check: Colon-labels (e.g., "What happened:", "Pattern:")
        const colonLabelRegex = /^(?:[A-Za-z][A-Za-z ]{0,24}|Who|What|Why|Pattern|Translation|Observation)\s*:\s/m;
        const midSentenceRegex = /(?:^|\.\s)([A-Za-z ]{2,24}):\s/g;
        
        // Secondary check: Soft meta-phrases (e.g., "The tell is", "Follow the money")
        const metaPhraseRegex = /\b(the tell is|follow the money|watch for|the point is|here's the thing|key insight|one observation|one insight|my take|the real story|bottom line|takeaway|net effect|in short|tl;dr)\b/gi;
        
        const hasColonLabel = colonLabelRegex.test(content) || midSentenceRegex.test(content);
        const hasMetaPhrase = metaPhraseRegex.test(content);
        const hasAnyViolation = hasColonLabel || hasMetaPhrase;
        
        if (hasAnyViolation && retryCount === 0) {
            // Determine what type of violation occurred
            let violationType = [];
            let correctionPrompt = 'CRITICAL: Your previous output contained banned patterns.\n\n';
            
            if (hasColonLabel) {
                violationType.push('colon-labels');
                const colonMatches = content.match(colonLabelRegex) || [];
                const midMatches = content.match(midSentenceRegex) || [];
                console.log('⚠️ Colon-labels detected:', [...colonMatches, ...midMatches].join(', '));
                correctionPrompt += 'NO colon-labels: Remove phrases like "What happened:", "Pattern:", "Translation:" at line start or after periods.\n';
            }
            
            if (hasMetaPhrase) {
                violationType.push('meta-phrases');
                const metaMatches = content.match(metaPhraseRegex) || [];
                console.log('⚠️ Meta-phrases detected:', metaMatches.join(', '));
                correctionPrompt += 'NO meta-phrases: Remove analytical scaffolding like "The tell is", "Follow the money", "Watch for", "Here\'s the thing".\n';
            }
            
            console.log(`⚠️ Violations found: ${violationType.join(' + ')} - triggering rewrite...`);
            
            // Retry with explicit correction
            correctionPrompt += '\nRewrite the tweet with natural flowing sentences. Just explain what happened and why it matters, without analytical framing.';
            
            const retryResponse = await openai.chat.completions.create({
                model: "gpt-5.1",
                messages: [
                    {
                        role: "system",
                        content: systemPrompt + "\n\n" + correctionPrompt,
                    },
                    {
                        role: "user",
                        content: userPrompt,
                    },
                ],
                max_completion_tokens: 4000,
            });
            
            content = retryResponse.choices[0].message.content.trim();
            console.log(`🔄 Rewrite complete. New length: ${content.length} characters`);
            
            // Check again after rewrite
            const stillHasColonLabel = colonLabelRegex.test(content) || midSentenceRegex.test(content);
            const stillHasMetaPhrase = metaPhraseRegex.test(content);
            const stillHasViolation = stillHasColonLabel || stillHasMetaPhrase;
            
            if (stillHasViolation) {
                console.log('❌ Rewrite still contains violations. Discarding this article.');
                if (stillHasColonLabel) {
                    console.log('🔍 Remaining colon-labels:', content.match(colonLabelRegex) || content.match(midSentenceRegex));
                }
                if (stillHasMetaPhrase) {
                    console.log('🔍 Remaining meta-phrases:', content.match(metaPhraseRegex));
                }
                return null; // Article will be skipped
            }
            
            console.log('✅ Rewrite successful - no violations detected');
        } else if (hasAnyViolation && retryCount > 0) {
            console.log('❌ Violations persist after retry. Discarding article.');
            return null;
        } else if (!hasAnyViolation) {
            console.log('✅ No violations detected - content passes validation');
        }
        
        // 8. Additional validation checks
        const emojiCount = (content.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        if (emojiCount < 2 || emojiCount > 4) {
            console.log(`⚠️ Emoji count: ${emojiCount} (expected 2-4)`);
        }
        
        if (content.length > 650) {
            console.log(`⚠️ Content exceeds 650 chars: ${content.length}`);
        }
        
        // Check if urgent
        await dbClient.checkUrgentNews(event);
        
        // Return both the content and the prompt type
        return {
            content: content,
            promptType: promptType
        };
    } catch (error) {
        console.error('Error generating tweet:', error);
        return null;
    }
}

// Post to Mastodon and store post history with prompt type info
async function postToMastodonAndStoreHistory(article, contentObj, skipDuplicateCheck = false) {
    // Extract content and promptType
    const content = contentObj.content;
    const promptType = contentObj.promptType || 'unknown';
    
    try {
        // Post to Mastodon - pass the skipDuplicateCheck parameter
        const result = await postToMastodon(content, article, skipDuplicateCheck);
        
        // Store the post history with prompt type information
        await dbClient.storePostHistory(article, content, result, promptType);
        
        return result;
    } catch (error) {
        console.error('Error posting to Mastodon:', error);
        
        // Store the failed post attempt
        await dbClient.storePostHistory(article, content, null, promptType);
        
        return null;
    }
}

// Function to post content to Mastodon
async function postToMastodon(content, article, skipDuplicateCheck = false) {
    if (!isMastodonConfigured || !mastodon) {
        console.log('⚠️ Mastodon not configured, skipping post');
        return null;
    }

    try {
        // Only check for duplicates if we haven't explicitly skipped this step
        // This is useful when we've already checked or just stored the content
        if (!skipDuplicateCheck) {
            // Check if content is similar to recently posted content
            const isSimilar = await contentDeduplicator.isSimilarToCached(article, content);
            if (isSimilar) {
                console.log('⚠️ Similar content recently posted, skipping...');
                return null;
            }

            // Check topic similarity
            const topicSimilarity = await contentDeduplicator.calculateTopicSimilarity(article);
            if (topicSimilarity > 0.7) {
                console.log('⚠️ Similar topic recently covered, skipping...');
                return null;
            }
        } else {
            console.log('📝 Skipping duplicate check since content was just stored');
        }

        // Post to Mastodon
        const response = await mastodon.post('statuses', {
            status: content,
            visibility: 'public'
        });
        
        // Check for error
        if (response?.data?.error) {
            console.error('❌ Mastodon API Error:', response.data.error);
            return null;
        }

        // Only store content if we didn't already do it
        if (!skipDuplicateCheck) {
            // Store content in deduplication cache
            await contentDeduplicator.storeContent(article, content);
        }

        console.log('✅ Posted to Mastodon successfully');
        
        // Cross-post to X and Bluesky if enabled
        if (process.env.X_POST_ENABLED === 'true' || process.env.BLUESKY_POST_ENABLED === 'true') {
            try {
                console.log('📱 Cross-posting to other social media platforms...');
                
                // Use the Mastodon post data for cross-posting
                const crossPostResults = await crossPostToSocialMedia(response.data, {
                    includeMedia: true,
                    noHashtags: process.env.X_POST_NOHASHTAGS === 'true',
                    removeEmojis: process.env.BLUESKY_REMOVE_EMOJIS === 'true',
                    maxRetries: 3
                });
                
                // Log cross-posting results
                if (crossPostResults.x.attempted) {
                    console.log(`X Cross-posting: ${crossPostResults.x.success ? '✅ Success' : '❌ Failed'}`);
                }
                
                if (crossPostResults.bluesky.attempted) {
                    console.log(`Bluesky Cross-posting: ${crossPostResults.bluesky.success ? '✅ Success' : '❌ Failed'}`);
                }
            } catch (crossPostError) {
                // Log error but don't fail the whole function
                console.error('Error cross-posting:', crossPostError);
            }
        }
        
        return response.data;
    } catch (error) {
        console.error('Error posting to Mastodon:', error);
        return null;
    }
}

// Save content to file as fallback
async function saveToFile(content) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `./logs/generated_content_${timestamp}.txt`;
    
    // Ensure logs directory exists
    if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs');
    }
    
    try {
        fs.appendFileSync(fileName, content + '\n\n---\n\n');
        console.log(`✅ Content saved to ${fileName}`);
    } catch (error) {
        console.error('❌ Error saving content to file:', error);
    }
}

// Function to post a single item
async function postSingleItem(maxAgeHours = 12) {
    try {
        // Check if bot is running
        if (!botIsRunning) {
            console.log('🛑 Bot is stopped, aborting post generation');
            return;
        }
        
        // Check MongoDB connectivity first
        const isHealthy = await dbClient.isHealthy();
        if (!isHealthy) {
            console.error('❌ Cannot connect to MongoDB. Please ensure MongoDB is running and accessible.');
            return;
        }
        
        console.log('🤖 Generating a single post...\n');
        const news = await fetchNews(maxAgeHours);
        if (news.length === 0) {
            console.log(`❌ No recent news found (last ${maxAgeHours} hours) or all articles already processed.`);
            return;
        }
        
        // Phase 2: Check for urgent articles first (urgency >= 9), then use highest scored
        let event = news.find(article => article.urgencyScore >= 9);
        if (event) {
            console.log(`🚨 URGENT NEWS DETECTED: "${event.title}" (Urgency: ${event.urgencyScore}/10)`);
        } else {
            // Use the highest importance scored article as normal
            event = news[0];
        }
        
        // ENHANCED CHECK: Check if article is already being processed
        if (processingArticles.has(event.url)) {
            console.log(`⚠️ Article "${event.title}" is currently being processed by another flow. Skipping.`);
            return;
        }
        
        // ENHANCED CHECK: Mark as being processed in memory
        processingArticles.set(event.url, Date.now());
        
        try {
            // ENHANCED CHECK: Double-check it hasn't been processed
            const processed = await dbClient.isArticleProcessed(event.url);
            if (processed) {
                console.log(`⚠️ Article "${event.title}" was marked as processed while preparing. Skipping.`);
                processingArticles.delete(event.url);
                return;
            }
            
            // NEW: Check if similar content is already in Redis
            const isSimilar = await contentDeduplicator.isSimilarToCached(event, event.title);
            if (isSimilar) {
                console.log(`⚠️ Article "${event.title}" is similar to previously cached content. Skipping.`);
                processingArticles.delete(event.url);
                // Article will be marked as processed when stored in post_history during normal flow
                return;
            }
            
            // NEW: Mark article with intent to process in database
            const intentResult = await dbClient.markArticleIntentToProcess(event.url, 'regular');
            if (!intentResult) {
                console.log(`⚠️ Article "${event.title}" is already being processed by another workflow. Skipping.`);
                processingArticles.delete(event.url);
                return;
            }
            
            console.log('=====================================');
            console.log(`🔍 SOURCE: ${event.source}`);
            console.log(`📝 TITLE: ${event.title}`);
            console.log(`📅 PUBLISHED: ${event.publishedAt.toISOString()}`);
            console.log(`🔗 URL: ${event.url}`);
            console.log(`📊 IMPORTANCE SCORE: ${event.importanceScore}/10`);
            
            const contentObj = await generateTweet(event);
            
            // Handle non-crypto-relevant content
            if (contentObj === null) {
                console.log('\n⏭️ This article is not crypto-relevant and will be skipped.');
                processingArticles.delete(event.url); // ENHANCED CHECK: Remove from processing
                // NEW: Clear processing intent since we're skipping
                await dbClient.clearArticleProcessingIntent(event.url);
                return;
            }
            
            const content = contentObj.content;
            
            // Ensure the post isn't truncated in display
            console.log('\n🐦 GENERATED CONTENT:');
            const contentLines = content.split('\n');
            for (const line of contentLines) {
                console.log(line);
            }
            console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
            console.log(`🔖 USING PROMPT TYPE: ${contentObj.promptType}`);
            
            // Check if the content is complete (doesn't end with a partial word)
            if (content.length > 480 && !content.endsWith('.') && !content.endsWith('?') && !content.endsWith('!')) {
                console.log(`\n⚠️ Warning: Post may be incomplete. Consider regenerating.`);
            }
            
            // IMPORTANT: Store in Redis regardless of whether we post to Mastodon
            // This ensures the content deduplication works even if posting fails
            console.log('\n📋 Storing article in deduplication cache...');
            await contentDeduplicator.storeContent(event, content);
            
            if (process.env.MASTODON_POST_ENABLED === 'true') {
                console.log('🚀 Posting to Mastodon...');
                // Pass skipDuplicateCheck=true since we just stored the content in Redis
                const result = await postToMastodonAndStoreHistory(event, contentObj, true);
                if (result) {
                    console.log(`✅ Posted to Mastodon: ${result.url}`);
                    console.log(`📱 View your post at: ${result.url}`);
                    
                    // Make sure the article has the scores explicitly set (this ensures they get passed to MongoDB)
                    if (event.importanceScore) {
                        console.log(`📊 Storing importance score: ${event.importanceScore}/10`);
                    }
                    if (event.urgencyScore) {
                        console.log(`🚨 Storing urgency score: ${event.urgencyScore}/10`);
                    }
                }
            } else {
                // Store post history with null result when not posting
                await dbClient.storePostHistory(event, content, null, contentObj.promptType);
            }
            
            // Article is automatically marked as processed by being stored in post_history above
            // No need for separate markArticleAsProcessed call
            
            // Phase 2: Store ALL analyzed articles for diary data (already have scores, no need for content generation)
            console.log(`📚 Phase 2: Storing ${news.length - 1} additional articles for diary data...`);
            for (let i = 1; i < news.length; i++) {
                const diaryArticle = news[i];
                try {
                    // Store article data directly for diary (no content generation needed for diary)
                    await dbClient.storePostHistory(diaryArticle, `Diary candidate: ${diaryArticle.title}`, null, 'diary-candidate');
                    console.log(`✅ Stored diary article: "${diaryArticle.title.substring(0, 40)}..." (Importance: ${diaryArticle.importanceScore}/10)`);
                } catch (error) {
                    console.error(`Error storing diary article: ${error.message}`);
                }
            }
            
            // ENHANCED CHECK: Remove from processing when done
            processingArticles.delete(event.url);
            // NEW: Clear processing intent regardless of result
            await dbClient.clearArticleProcessingIntent(event.url);
            
            console.log('=====================================\n');
        } catch (error) {
            console.error('❌ Error processing article:', error.message);
            // ENHANCED CHECK: Remove from processing on error
            processingArticles.delete(event.url);
            // NEW: Clear processing intent on error
            await dbClient.clearArticleProcessingIntent(event.url);
        }
    } catch (error) {
        console.error('❌ Error in postSingleItem:', error.message);
        // ENHANCED CHECK: Remove from processing on error
        if (error.event && error.event.url) {
            processingArticles.delete(error.event.url);
            // NEW: Clear processing intent on error
            await dbClient.clearArticleProcessingIntent(error.event.url);
        }
    }
}

// Helper function to get appropriate urgency emoji based on score
function getUrgencyEmoji(score) {
    if (score >= 9) return '🚨'; // High urgency
    return ''; // No emoji for lower urgency
}

// Special function to generate tweets for urgent news
async function generateUrgentTweet(article, urgencyScore = 9, urgencyData = null) {
    try {
        // Check if this urgent news has been posted recently
        const isSimilar = await contentDeduplicator.isSimilarToCached(article, article.title);
        if (isSimilar) {
            console.log('⚠️ Similar urgent news recently posted, skipping...');
            return null;
        }

        // Check topic similarity for urgent news
        const topicSimilarity = await contentDeduplicator.calculateTopicSimilarity(article);
        if (topicSimilarity > 0.8) { // Higher threshold for urgent news
            console.log('⚠️ Similar urgent topic recently covered, skipping...');
            return null;
        }

        // Generate hashtags
        const hashtags = await generateDynamicHashtags(article.title, article.description);
        
        // Get urgency emoji
        const urgencyEmoji = getUrgencyEmoji(urgencyScore);
        
        // Format the tweet
        let tweet = `${urgencyEmoji} URGENT: ${article.title}\n\n`;
        
        // Add urgency data if available
        if (urgencyData && urgencyData.reason) {
            tweet += `${urgencyData.reason}\n\n`;
        }
        
        // Add source and link
        tweet += `Source: ${article.source}\n${article.url}\n\n`;
        
        // Add hashtags
        tweet += hashtags.slice(0, 3).join(' ');

        // Store in deduplication cache
        await contentDeduplicator.storeContent(article, tweet);
        
        return tweet;
    } catch (error) {
        console.error('Error generating urgent tweet:', error);
        return null;
    }
}

// Phase 2: Removed analyzeUrgencyLevel - now integrated into analyzeArticleComprehensive

// Check if MongoDB is healthy
async function checkMongoHealth() {
    try {
        return await dbClient.isHealthy();
    } catch (error) {
        console.error('❌ Error checking MongoDB health:', error);
        return false;
    }
}

// Phase 2: Removed scanUrgentNews - urgent detection now integrated into regular posting cycle

// Add this function to clean Redis cache on startup
async function cleanupRedisCache() {
    console.log('🧹 Cleaning up Redis cache...');
    try {
        await contentDeduplicator.cleanup();
        console.log('✅ Redis cache cleaned successfully');
        
        // Also clear RSS cache for fresh data
        clearRSSCache();
        console.log('🗑️ RSS cache cleared for fresh data');
    } catch (error) {
        console.error('❌ Error cleaning Redis cache:', error);
    }
}

// Start the bot in testing mode (posts every 6 hours for faster testing)
function startTestingMode() {
    console.log('🚀 Starting TweetBot in TESTING mode');
    console.log('📅 Tweets will be posted EVERY 6 HOURS (faster than production for testing)');
    console.log('🎯 Optimized for testing - no urgent scanning');
    
    // Clean Redis cache on startup
    cleanupRedisCache();
    
    // Schedule posts every 6 hours for testing (faster than 12-hour production)
    cron.schedule('0 */6 * * *', async () => {
        console.log('⏰ Running scheduled 6-hour test post...');
        process.env.MASTODON_POST_ENABLED = 'true';
        await postSingleItem(12); // Use 12-hour news window
    });
    
    // Urgent scanning removed - integrated into regular posting cycle
    
    // Run initial post immediately
    console.log('\n===================================================');
    console.log('🚀 Running initial post immediately...');
    console.log('===================================================\n');
    process.env.MASTODON_POST_ENABLED = 'true';
    postSingleItem(12);
}

// Wisdom topics for educational tweets (rotated)
const wisdomTopics = [
    "Trading psychology: Most crypto losses come from buying good tech at bad prices during FOMO. The pattern repeats every cycle.",
    "Risk management: Position sizing matters more than entry timing. You can be right about the asset and still lose everything.",
    "Market cycles: Bull markets teach you what's possible. Bear markets teach you what's real. Learn to tell the difference.",
    "Pattern recognition: Every cycle looks different on the surface but rhymes underneath. The narrative changes, human behavior doesn't.",
    "Long-term thinking: The best crypto trades had 18 months of waiting. The worst had 18 minutes of thinking.",
    "Emotional discipline: The market rewards patience and punishes urgency. Your biggest edge is staying calm when everyone else panics.",
    "Information filtering: More crypto news doesn't make you smarter. Learning to ignore noise and focus on structural shifts does.",
    "Portfolio construction: Diversification in crypto isn't about owning 20 coins. It's about exposing yourself to different risk factors.",
    "Entry and exit strategy: Entering is easy. Exiting at the right time—before euphoria or after capitulation—separates winners from losers.",
    "Narrative vs fundamentals: Narratives drive price in the short term. Fundamentals determine survival in the long term.",
    "Contrarian thinking: When everyone agrees crypto is dead, that's when it rebuilds. When everyone thinks it's going to the moon, distribution starts.",
    "Volatility management: Volatility isn't your enemy—it's your opportunity. But only if you sized correctly and have dry powder left.",
    "Network effects: The most underrated metric in crypto is sticky users, not just active wallets. Real adoption shows up in retention.",
    "Leverage lessons: Leverage amplifies returns and wipes out accounts. The traders who survived learned to use it sparingly, not constantly.",
    "Timing mistakes: You can't time tops and bottoms perfectly. But you can avoid the obvious extremes by watching behavior, not just charts.",
    "Due diligence: Reading whitepapers isn't enough. Watch how teams react when things break—that's when character shows.",
    "Community signals: Strong communities survive bear markets. Hype communities evaporate. Learn to spot the difference early.",
    "Regulatory awareness: Regulatory clarity doesn't kill crypto—regulatory uncertainty does. Position accordingly.",
    "Technical vs fundamental: Technical analysis tells you what traders are doing. Fundamental analysis tells you what should happen. You need both.",
    "Opportunity cost: The worst crypto mistake isn't losing on a bad trade. It's holding through a full cycle and ending up with less than you started.",
    "Conviction building: True conviction comes from understanding the mechanism, not just believing the story. Can you explain how it works?",
    "Exit liquidity: In DeFi, you're not just buying an asset—you're trusting there will be liquidity when you want out. Check exit doors first.",
    "Builder signals: Watch what serious builders are working on quietly. That's where the next cycle's narrative starts.",
    "Incentive alignment: Follow the incentives. If founders, VCs, and users don't all win together, someone's getting rugged.",
    "Time preference: Crypto rewards low time preference. The longer you can wait without selling, the bigger the asymmetric bet pays off.",
    "Learning from losses: Every blown trade teaches you something. Write it down. Most traders repeat mistakes because they never documented them.",
    "Protocol economics: Token price doesn't mean protocol health. Revenue, retention, and real usage do. Learn to read the difference.",
    "Scaling trade-offs: Every blockchain makes trade-offs between decentralization, security, and speed. There's no free lunch—just different costs.",
    "Smart money moves: Institutional money moves slowly and telegraphs early. Learn to read the signals before the headlines confirm.",
    "Bear market building: The best projects ship in bear markets when attention is low and competition is gone. That's when foundations get built."
];

let lastWisdomTweetTime = 0;
let lastNewsTweetTime = 0;
let wisdomTopicIndex = 0;

// State for API access
let nextScheduledPost = null;
let nextWisdomPost = null;

// Wisdom tweet prompt
const wisdomPrompt = `You are writing crypto educational content with deep insights for Kodex Academy.

Take the following wisdom topic and expand it into a thoughtful, mentor-like tweet that:
- Opens with a sharp, memorable insight (1-2 sentences)
- Add a blank line
- Elaborates with 2-3 sentences that add depth and context
- Add a blank line
- Includes a closing wisdom line that lands hard (1 sentence)
- Add a blank line
- Ends with a subtle call-to-learn at Kodex Academy (format: "Learn more → https://kodex.academy 🎓" or similar - MUST include https:// to make it clickable)
- Add a blank line
- Include 2 relevant hashtags at the end (e.g., #CryptoWisdom #TradingPsychology)

CRITICAL: Use blank lines to separate each section for readability. The format should be:

Opening insight

Elaboration paragraph

Closing wisdom line

Learn more → https://kodex.academy 🎓

#Hashtag1 #Hashtag2

Additional rules:
- Uses 1-2 strategic emojis (not decorative)
- Never introduces yourself by name
- Feels like advice from someone who has seen multiple cycles
- Stays under 650 characters

Make it philosophical but practical. This should feel like mentorship, not marketing.

Wisdom topic to expand:`;

// Generate and post a wisdom tweet
async function postWisdomTweet() {
    try {
        // Check if bot is running
        if (!botIsRunning) {
            console.log('🛑 Bot is stopped, aborting wisdom tweet generation');
            return;
        }
        
        console.log('🎓 Generating wisdom tweet for Kodex Academy...');
        
        // Get next topic (rotate through the list)
        const topic = wisdomTopics[wisdomTopicIndex];
        wisdomTopicIndex = (wisdomTopicIndex + 1) % wisdomTopics.length;
        
        console.log(`📚 Topic: ${topic.substring(0, 80)}...`);
        
        // Generate the wisdom tweet
        const response = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: wisdomPrompt
                },
                {
                    role: "user",
                    content: topic
                }
            ],
            max_completion_tokens: 4000,
        });
        
        const content = response.choices[0].message.content.trim();
        console.log(`📏 Wisdom tweet length: ${content.length} characters`);
        
        // Post to Mastodon
        if (process.env.MASTODON_POST_ENABLED === 'true' && isMastodonConfigured && mastodon) {
            const result = await mastodon.post('statuses', {
                status: content,
                visibility: 'public'
            });
            
            const postUrl = result.data.url || `https://social.kodex.academy/@funkle/${result.data.id}`;
            console.log(`✅ Posted wisdom tweet to Mastodon: ${postUrl}`);
            lastWisdomTweetTime = Date.now();
            
            // Store in database with special marker
            await dbClient.storePostHistory({
                title: 'Kodex Academy Wisdom',
                description: topic,
                url: 'https://kodex.academy',
                source: 'Kodex Academy',
                publishedAt: new Date()
            }, content, result.data, 'wisdom-tweet');
            
            return result;
        } else {
            console.log('⚠️ Mastodon posting disabled or not configured');
            return null;
        }
    } catch (error) {
        console.error('❌ Error posting wisdom tweet:', error);
        return null;
    }
}

// Store active timeouts for bot control
let activeTimeouts = {
    newsPost: null,
    wisdomPost: null
};
let botIsRunning = false;

// Schedule wisdom tweets with smart timing to avoid collision with news tweets
function scheduleNextWisdomTweet() {
    // Random time in next 18-30 hours (to ensure once per day but varied)
    const minHours = 18;
    const maxHours = 30;
    const randomHours = Math.random() * (maxHours - minHours) + minHours;
    let wisdomDelay = randomHours * 60 * 60 * 1000;
    
    // Add buffer to avoid collision with news tweets (minimum 2 hours after last news tweet)
    const timeSinceLastNews = Date.now() - lastNewsTweetTime;
    const minimumBuffer = 2 * 60 * 60 * 1000; // 2 hours
    
    if (timeSinceLastNews < minimumBuffer) {
        const additionalWait = minimumBuffer - timeSinceLastNews;
        wisdomDelay += additionalWait;
        console.log(`⏰ Adding ${(additionalWait / 1000 / 60 / 60).toFixed(1)} hour buffer to avoid collision with news tweet`);
    }
    
    const nextWisdomTime = new Date(Date.now() + wisdomDelay);
    nextWisdomPost = nextWisdomTime; // Store for API access
    console.log(`🎓 Next wisdom tweet scheduled for: ${nextWisdomTime.toLocaleString()} (${(wisdomDelay / 1000 / 60 / 60).toFixed(1)} hours from now)`);
    
    activeTimeouts.wisdomPost = setTimeout(async () => {
        console.log('🎓 Running scheduled wisdom tweet...');
        await postWisdomTweet();
        
        // Schedule the next wisdom tweet
        if (botIsRunning) {
            scheduleNextWisdomTweet();
        }
    }, wisdomDelay);
}

// Start the bot in production mode (posts every 6-8 hours with randomization)
function startProductionMode() {
    console.log('🚀 Starting TweetBot in PRODUCTION mode');
    console.log('📅 Tweets will be posted every 8-12 HOURS (randomized for organic feel)');
    console.log('🎓 Wisdom tweets will be posted once per day (randomized timing)');
    console.log('📔 Crypto Diary will be generated EVERY 2 DAYS at 8 PM');
    console.log('🎯 Optimized for 2-3 news posts/day + 1 wisdom tweet/day + diary every 2 days');
    
    // Clean Redis cache on startup
    cleanupRedisCache();
    
    // Set bot as running
    botIsRunning = true;
    
    // Schedule next post with organic timing
    function scheduleNextPost() {
        // Random interval between 8-12 hours for 2-3 posts per day
        const minHours = 8;
        const maxHours = 12;
        const randomHours = Math.random() * (maxHours - minHours) + minHours;
        const nextPostDelay = randomHours * 60 * 60 * 1000; // Convert to milliseconds
        
        const nextPostTime = new Date(Date.now() + nextPostDelay);
        nextScheduledPost = nextPostTime; // Store for API access
        console.log(`⏰ Next post scheduled for: ${nextPostTime.toLocaleString()} (${randomHours.toFixed(1)} hours from now)`);
        
        activeTimeouts.newsPost = setTimeout(async () => {
            console.log('⏰ Running scheduled organic post...');
            process.env.MASTODON_POST_ENABLED = 'true';
            await postSingleItem(12);
            lastNewsTweetTime = Date.now(); // Track timing for wisdom tweet collision avoidance
            
            // Schedule the next post
            if (botIsRunning) {
                scheduleNextPost();
            }
        }, nextPostDelay);
    }
    
    // Schedule crypto diary generation every 2 days at 8 PM
    const { scheduleDailyCryptoDiary, setBotStateChecker } = require('./crypto_diary');
    setBotStateChecker(() => botIsRunning); // Pass bot running state checker to diary module
    scheduleDailyCryptoDiary();
    console.log('📅 Scheduled crypto diary for 8 PM every 2 days');
    
    // Urgent scanning removed - integrated into regular posting cycle
    
    // Run initial post immediately
    console.log('🚀 Running initial post...');
    process.env.MASTODON_POST_ENABLED = 'true';
    postSingleItem(12);
    lastNewsTweetTime = Date.now(); // Track initial post timing
    
    // Start organic scheduling after initial post
    scheduleNextPost();
    
    // Start wisdom tweet scheduler
    console.log('🎓 Starting wisdom tweet scheduler (once daily, randomized timing)');
    scheduleNextWisdomTweet();
}

// Make sure environment variables are valid
validateEnvVariables();

// Export public API
// Function for API to trigger news post
async function runNewsPost() {
    console.log('📡 API triggered news post generation');
    process.env.MASTODON_POST_ENABLED = 'true';
    await postSingleItem(12);
    lastNewsTweetTime = Date.now();
}

// Function to stop the bot
function stopBot() {
    console.log('🛑 Stopping TweetBot...');
    botIsRunning = false;
    
    // Clear all active timeouts
    if (activeTimeouts.newsPost) {
        clearTimeout(activeTimeouts.newsPost);
        activeTimeouts.newsPost = null;
        console.log('✅ Cleared news post scheduler');
    }
    
    if (activeTimeouts.wisdomPost) {
        clearTimeout(activeTimeouts.wisdomPost);
        activeTimeouts.wisdomPost = null;
        console.log('✅ Cleared wisdom post scheduler');
    }
    
    console.log('✅ TweetBot stopped');
    return { success: true, message: 'Bot stopped successfully' };
}

// Function to start the bot (uses production mode by default)
function startBot() {
    console.log('▶️ Starting TweetBot...');
    
    if (botIsRunning) {
        console.log('⚠️ Bot is already running');
        return { success: false, message: 'Bot is already running' };
    }
    
    startProductionMode();
    return { success: true, message: 'Bot started successfully' };
}

module.exports = {
    // Runner functions
    startTestingMode,
    startProductionMode,
    postSingleItem,
    postWisdomTweet,
    runNewsPost,
    stopBot,
    startBot,
    
    // Helper functions
    generateTweet,
    postToMastodon,
    fetchNews,
    generateUrgentTweet,
    analyzeArticleContent,
    
    // API constants
    DEFAULT_MAX_AGE_DAYS: 6,
    EXTENDED_MAX_AGE_DAYS: 12,
    
    // State for API access
    get nextScheduledPost() { return nextScheduledPost; },
    get nextWisdomPost() { return nextWisdomPost; },
    get lastNewsPostTime() { return lastNewsTweetTime; },
    get isBotRunning() { return botIsRunning; }
};


