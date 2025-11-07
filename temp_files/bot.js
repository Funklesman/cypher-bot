/*****************************************************************
 * Crypto News Bot
 * Updated to use more personal, varied system prompts.
 *****************************************************************/

const axios = require('axios');
const OpenAI = require('openai');
const cron = require('node-cron');
const Parser = require('rss-parser');
const fs = require('fs');
const { MongoClient } = require('mongodb');
let Mastodon;
try {
    Mastodon = require('mastodon-api');
} catch (error) {
    console.log('Mastodon API not available, will run in content generation mode only');
}
require('dotenv').config();

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';
let db;
let articlesCollection;

// Initialize MongoDB connection
async function connectToMongoDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        db = client.db(dbName);
        articlesCollection = db.collection('processedArticles');
        
        // Create a unique index on the url field to prevent duplicate entries
        await articlesCollection.createIndex({ url: 1 }, { unique: true });
        console.log('✅ Articles collection initialized with unique url index');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        return false;
    }
}

// Check if an article has been processed already
async function isArticleProcessed(url) {
    if (!articlesCollection) return false;
    
    try {
        const existingArticle = await articlesCollection.findOne({ url });
        return !!existingArticle;
    } catch (error) {
        console.error('❌ Error checking if article was processed:', error);
        return false;
    }
}

// Mark an article as processed
async function markArticleAsProcessed(article) {
    if (!articlesCollection) return false;
    
    try {
        await articlesCollection.insertOne({
            url: article.url,
            title: article.title,
            source: article.source,
            publishedAt: article.publishedAt || new Date(),
            processedAt: new Date()
        });
        return true;
    } catch (error) {
        // If the error is a duplicate key error, the article is already processed
        if (error.code === 11000) {
            console.log(`Article already processed: ${article.title}`);
            return true;
        }
        console.error('❌ Error marking article as processed:', error);
        return false;
    }
}

// Initialize RSS parser
const parser = new Parser();

// Check if Mastodon is configured
const isMastodonConfigured = process.env.MASTODON_ACCESS_TOKEN && process.env.MASTODON_API_URL;

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
    if (isMastodonConfigured) {
        console.log('✅ Mastodon integration configured');
    } else {
        console.log('⚠️ Mastodon integration not configured, running in content generation mode only');
    }
}
validateEnvVariables();

// OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Mastodon API client (if configured)
let mastodon;
if (isMastodonConfigured && Mastodon) {
    mastodon = new Mastodon({
        access_token: process.env.MASTODON_ACCESS_TOKEN,
        api_url: process.env.MASTODON_API_URL
    });
    console.log('✅ Connected to Mastodon API');
}

// Fetch news from NewsAPI
async function fetchNewsAPI() {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain OR "web3"',  // More targeted crypto query
                language: 'en',
                sortBy: 'publishedAt',
                from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                apiKey: process.env.NEWS_API_KEY,
            },
        });
        return response.data.articles.slice(0, 5).map((article) => ({  // Increased to 5 articles for better filtering later
            title: article.title,
            description: article.description,
            url: article.url,
            source: 'NewsAPI',
            publishedAt: new Date(article.publishedAt || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from NewsAPI:', error);
        return [];
    }
}

// Fetch news from Defiant RSS
async function fetchDefiantRSS() {
    try {
        const feed = await parser.parseURL('https://thedefiant.io/feed');
        return feed.items.slice(0, 2).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'Defiant',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from Defiant:', error);
        return [];
    }
}

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

// Fetch news from CoinTelegraph RSS
async function fetchCoinTelegraphRSS() {
    try {
        const feed = await parser.parseURL('https://cointelegraph.com/rss');
        return feed.items.slice(0, 3).map(item => ({
            title: item.title,
            description: item.contentSnippet || item.content,
            url: item.link,
            source: 'CoinTelegraph',
            publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
        }));
    } catch (error) {
        console.error('Error fetching news from CoinTelegraph:', error);
        return [];
    }
}

// Check if content is crypto-relevant using keywords (fallback method)
function isCryptoRelevantByKeywords(title, description) {
    // Crypto keywords to check for in title and description
    const cryptoKeywords = [
        'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'blockchain', 'token', 'coinbase', 'binance',
        'defi', 'nft', 'wallet', 'mining', 'altcoin', 'stablecoin', 'dapp', 'dao', 'web3',
        'decentralized', 'smart contract', 'cryptocurrency', 'satoshi', 'nakamoto', 'hodl',
        'exchange', 'ledger', 'tether', 'usdt', 'usdc', 'ripple', 'xrp', 'cardano', 'ada',
        'solana', 'sol', 'polkadot', 'dogecoin', 'shiba inu', 'avalanche', 'avax', 'metaverse'
    ];
    
    // Combine title and description for checking
    const content = (title + ' ' + (description || '')).toLowerCase();
    
    // Check if content contains any crypto keywords
    return cryptoKeywords.some(keyword => content.includes(keyword.toLowerCase()));
}

// Determine sentiment and relevance based on content using OpenAI
async function analyzeArticleContent(title, description, source) {
    // If it's from The Defiant, it's automatically crypto-related
    if (source === 'Defiant') {
        // For Defiant articles, we still need to determine sentiment
        try {
            const sentimentResponse = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are a cryptocurrency and blockchain news sentiment analyzer. Use this framework to analyze news:

POSITIVE FACTORS (weight: 1.0 each):
- Decentralized solutions & community governance
  * Community-driven initiatives
  * Decentralized protocols
  * Open source development
  * Grassroots adoption
- Privacy & security enhancements
  * End-to-end encryption
  * Zero-knowledge proofs
  * Privacy-preserving protocols
  * Secure data handling
- Individual empowerment & financial freedom
  * Self-custody solutions
  * Financial sovereignty
  * User control over data
  * Direct peer-to-peer interactions
- Open source & transparency
  * Public code repositories
  * Transparent governance
  * Community audits
  * Public documentation
- Organic adoption & grassroots growth
  * Community-driven growth
  * Natural market adoption
  * User-led initiatives
  * Independent development

NEGATIVE FACTORS (weight: 1.5 each):
- Centralization & corporate control
  * Corporate/government initiatives
  * Centralized infrastructure
  * Controlled access
  * Monopolistic practices
- Privacy risks & surveillance
  * Data collection
  * Tracking capabilities
  * Surveillance features
  * Centralized storage
- Market manipulation & exploitation
  * Price manipulation
  * Pump and dump schemes
  * Insider trading
  * Market exploitation
- Regulatory pressure & restrictions
  * Heavy regulation
  * Compliance burdens
  * Restricted access
  * Controlled usage

NEUTRAL FACTORS (weight: 0.8 each):
- Technical updates & protocol changes
  * Standard upgrades
  * Routine maintenance
  * Performance improvements
  * Bug fixes
- Market data & statistics
  * Price movements
  * Trading volumes
  * Market metrics
  * Industry statistics
- Industry development & infrastructure
  * Standard infrastructure
  * Common tools
  * Basic services
  * Regular updates
- Educational content & documentation
  * Tutorials
  * Guides
  * Documentation
  * Learning materials

SCORING RULES:
1. Calculate weighted scores for each category
2. If no category exceeds 30% of total possible score, classify as neutral
3. Corporate/government initiatives are weighted towards neutral unless they explicitly promote decentralization
4. Consider both technical implementation and centralization implications
5. Higher weight (1.5) for negative factors to reflect community concerns
6. Lower weight (0.8) for neutral factors to avoid over-neutralization

Respond with a JSON object containing:
{
    "sentiment": "positive", "negative", or "neutral",
    "isRelevant": true/false,
    "reasoning": "Detailed explanation of scoring and factors considered"
}`
                    },
                    {
                        role: "user",
                        content: `Analyze this cryptocurrency news article for sentiment and relevance. Consider both technical implementation and centralization implications:

Title: ${title}
Description: ${description}

Respond with a JSON object containing sentiment, isRelevant, and reasoning.`
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });
            
            const result = JSON.parse(sentimentResponse.choices[0].message.content.trim());
            console.log(`🔍 AI Analysis: Sentiment=${result.sentiment}, Relevant=${result.isRelevant}`);
            return {
                sentiment: result.sentiment || 'neutral',
                isRelevant: result.isRelevant === true
            };
        } catch (error) {
            console.error('Error analyzing Defiant content sentiment:', error);
            return {
                sentiment: determineSentimentByKeywords(title, description),
                isRelevant: true
            };
        }
    }
    
    // For all other sources, use the combined AI analysis
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
                {
                    role: "system",
                    content: "You analyze news articles. Respond with a JSON object containing two fields: 'sentiment' (either 'positive', 'negative', or 'neutral') and 'isRelevant' (boolean true or false indicating if the content is relevant to cryptocurrency, blockchain, or web3)."
                },
                {
                    role: "user",
                    content: `Analyze this news:\nTitle: ${title}\nDescription: ${description}\n\nDetermine both the sentiment and whether it's relevant to cryptocurrency/blockchain.`
                }
            ],
            temperature: 0.1,
            response_format: { type: "json_object" }
        });
        
        try {
            const result = JSON.parse(response.choices[0].message.content.trim());
            console.log(`🔍 AI Analysis: Sentiment=${result.sentiment}, Relevant=${result.isRelevant}`);
            return {
                sentiment: result.sentiment || 'neutral',
                isRelevant: result.isRelevant === true
            };
        } catch (parseError) {
            console.error('Error parsing JSON from OpenAI:', parseError);
            
            // Fallback to basic keyword matching
            return {
                sentiment: determineSentimentByKeywords(title, description),
                isRelevant: isCryptoRelevantByKeywords(title, description)
            };
        }
    } catch (error) {
        console.error('Error analyzing content with AI:', error);
        
        // Fallback to basic keyword matching
        return {
            sentiment: determineSentimentByKeywords(title, description),
            isRelevant: isCryptoRelevantByKeywords(title, description)
        };
    }
}

// Determine sentiment using keywords (fallback method)
function determineSentimentByKeywords(title, description) {
    // Combine title and description for checking
    const content = (title + ' ' + (description || '')).toLowerCase();
    
    // Positive sentiment keywords
    const positiveWords = ['gain', 'rally', 'surge', 'adoption', 'bullish', 'success', 'breakthrough', 'partnership', 'growth', 'milestone', 'launch', 'opportunity', 'solution', 'innovation', 'advance', 'progress', 'profit', 'win', 'positive', 'upward', 'beneficial'];
    
    // Negative sentiment keywords
    const negativeWords = ['hack', 'scam', 'crash', 'loss', 'bearish', 'risk', 'fraud', 'collapse', 'investigation', 'ban', 'stolen', 'exploit', 'vulnerability', 'concern', 'warning', 'downturn', 'decline', 'threat', 'problem', 'fail', 'danger'];
    
    // Count matches
    const positiveCount = positiveWords.filter(word => content.includes(word)).length;
    const negativeCount = negativeWords.filter(word => content.includes(word)).length;
    
    // Determine sentiment
    if (positiveCount > negativeCount) {
        return 'positive';
    } else if (negativeCount > positiveCount) {
        return 'negative';
    } else {
        return 'neutral';
    }
}

// Combined fetch news function
async function fetchNews(maxAgeDays = 2) {
    try {
        const [newsApiArticles, defiantArticles, coinDeskArticles, coinTelegraphArticles] = await Promise.all([
            fetchNewsAPI(),
            fetchDefiantRSS(),
            fetchCoinDeskRSS(),
            fetchCoinTelegraphRSS()
        ]);
        // Combine all articles
        const allArticles = [...newsApiArticles, ...defiantArticles, ...coinDeskArticles, ...coinTelegraphArticles];
        
        // Sort by publication date (newest first)
        allArticles.sort((a, b) => b.publishedAt - a.publishedAt);
        
        // Filter out articles older than maxAgeDays
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);
        
        const recentArticles = allArticles.filter(article => article.publishedAt >= cutoffDate);
        console.log(`📊 Found ${recentArticles.length} articles from the last ${maxAgeDays} days (out of ${allArticles.length} total)`);
        
        // Log the relevant articles
        recentArticles.forEach(article => {
            console.log(`📆 Article: ${article.title} | Published: ${article.publishedAt.toISOString()}`);
        });
        
        // Filter out already processed articles if MongoDB is connected
        if (articlesCollection) {
            const filteredArticles = [];
            for (const article of recentArticles) {
                const processed = await isArticleProcessed(article.url);
                if (!processed) {
                    filteredArticles.push(article);
                } else {
                    console.log(`Skipping already processed article: ${article.title}`);
                }
            }
            return filteredArticles;
        }
        
        return recentArticles;
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
}

// Add delay utility function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate dynamic, relevant hashtags for the content
async function generateDynamicHashtags(title, description) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5",
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
Return exactly 10 hashtags as a JavaScript array of strings.`
                },
                {
                    role: "user",
                    content: `Generate relevant crypto hashtags for this news:
Title: ${title}
Description: ${description}
Return ONLY a valid JavaScript array of strings with 10 hashtags. Choose hashtags that are most relevant to this specific news story.`
                }
            ],
            temperature: 0.7,
        });
        
        let hashtagArray;
        try {
            const cleanedResponse = response.choices[0].message.content.trim()
                .replace(/```javascript|```js|```|`/g, '')
                .trim();
            hashtagArray = JSON.parse(cleanedResponse);
            
            // Format all hashtags properly and remove duplicates
            hashtagArray = [...new Set(hashtagArray)].map(tag => 
                tag.startsWith('#') ? tag : `#${tag}`
            );
            
            // Return the top 2 most relevant hashtags
            return hashtagArray.slice(0, 2);
        } catch (error) {
            console.error('Error parsing hashtag response:', error);
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

/**************************************************************
 * New explicit prompt templates for each sentiment.
 * These are designed to be raw, personal, and reflective.
 **************************************************************/
const negativePrompts = [
    `
  Using the following news headline and context, craft a tweet that is raw, unapologetic, and deeply personal. Write as if you're venting your deep disappointment and frustration while reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express deep skepticism and analytical concern about the news while subtly challenging the status quo and questioning established narratives without overtly calling out governmental control. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Use clear, accessible language with occasional technical terms (explain briefly if needed). Add relevant emojis to emphasize key points and emotions (2-4 emojis total). Conclude with a single open-ended question OR call-to-action (choose only one), and hint at centralized power issues subtly between the lines. Keep it under 650 characters. 
  Include these hashtags at the end:`,
    `
  Using the following news headline and context, write a tweet that is brutally honest, raw, and reflective of my deep disillusionment and skepticism. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a personal moment from your journey that exposes the flaws and pitfalls you've witnessed, and deliver your critical insights without sugarcoating the reality. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Keep technical language accessible and provide brief explanations for any jargon. Include 2-4 strategic emojis that enhance your emotional expression. Conclude with a single thought-provoking question OR call-to-action (choose only one), and subtly question centralization and power dynamics without stating them outright. Limit the tweet to 650 characters. 
  Include these hashtags at the end:
  `
  ];
  

const positivePrompts = [
    `
  Using the following news headline and context, craft a tweet that is raw, unapologetic, and deeply personal. Write as if you're venting your excitement while reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express hope for the future while remaining skeptical and analytical about events, subtly challenging the status quo and pushing back against the old guard without overtly mentioning governmental overreach. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Use clear, accessible language with occasional technical terms (explain briefly if needed). Include 2-4 well-placed emojis that highlight your excitement and energy. Conclude with a single open-ended question OR call-to-action (choose only one), and subtly hint at decentralization between the lines. Keep it under 650 characters. Include these hashtags at the end:`,
    `
  Using the following news headline and context, write a tweet that is brutally honest, raw, and reflective. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a personal moment from your journey that shows both hope and skepticism about the future, and subtly challenge the status quo without directly referencing governmental control. Keep technical language accessible and provide brief explanations for any jargon. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal experience. Add 2-4 strategic emojis that enhance your emotional expression. Conclude with a single thoughtfull question OR call-to-action (choose only one), and weave in subtle hints of decentralization without letting it dominate the message. Limit the tweet to 650 characters. Include these hashtags at the end:
  `
  ];
  

  const neutralPrompts = [
    `
  Using the following news headline and context, craft a tweet that is balanced, raw, and deeply personal. Write as if you're reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express thoughtful analysis and genuine curiosity without leaning too positive or negative. Use clear, accessible language with occasional technical terms (explain briefly if needed). Include 2-3 appropriate emojis that complement your analytical tone. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal perspective. Conclude with a single thoughtful question or call-to-action, and subtly hint at decentralization between the lines. Keep it under 650 characters. 
  Include these hashtags at the end:`,
    `
  Using the following news headline and context, write a tweet that reflects on the news in a neutral, yet deeply personal way. Channel your inner "Crypto Professor" from Cypher University—a crypto learning platform known for its raw, cyberpunk-inspired tone. Share a measured, analytical perspective with a mix of curiosity and healthy skepticism, while remaining balanced. Use clear, accessible language with occasional technical terms (briefly explained) as needed. Add 2-3 thoughtful emojis that highlight key points without overwhelming the message. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal insights. Conclude with a thoughtful, engaging question. Limit the tweet to 650 characters. 
  Include these hashtags at the end:`
  ];
  

/**************************************************************
 * Generate a dynamic system prompt based on sentiment.
 * Randomly pick from the arrays above for variety.
 **************************************************************/
async function generateDynamicSystemPrompt(hashtags, title, description, sentiment) {
    try {
        let chosenPrompt = '';
        if (sentiment === 'negative') {
            chosenPrompt = pickRandom(negativePrompts);
        } else if (sentiment === 'positive') {
            chosenPrompt = pickRandom(positivePrompts);
        } else {
            chosenPrompt = pickRandom(neutralPrompts);
        }
        // Return only the prompt without adding hashtags
        return chosenPrompt;
    } catch (error) {
        console.error('Error generating dynamic system prompt:', error);
        return "You are \"The Crypto Professor\" from Cypher University. Write a thoughtful, raw, first-person reflection on this news. Keep it under 650 characters.";
    }
}

// Generate tweet content using OpenAI with dynamic components
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
        
        // 3. Generate a dynamic system prompt using the sentiment
        const systemPrompt = await generateDynamicSystemPrompt(hashtags, event.title, event.description, sentiment);
        
        // 4. Set temperature based on sentiment
        const tweetTemperature = sentiment === 'neutral' ? 0.85 : 1.0;
        
        // 5. Generate the tweet content - with formatting instructions
        const formatInstructions = `Please format your response with:
1. Short paragraphs with line breaks between them (not one big block of text)
2. Add an extra blank line before your concluding statement or call-to-action question
3. Place the hashtags on their own line at the end

Your response can be up to 650 characters.`;
        
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [
                {
                    role: "system",
                    content: systemPrompt,
                },
                {
                    role: "user",
                    content: `Title: ${event.title}
Description: ${event.description}
URL: ${event.url}

${formatInstructions}

Hashtags: ${hashtags.join(' ')}`,
                },
            ],
            temperature: tweetTemperature,
            max_tokens: 800, // For 650 character limit
        });

        let content = response.choices[0].message.content.trim();
        console.log(`📏 Content length: ${content.length} characters`);
        return content;
    } catch (error) {
        console.error('Error generating tweet:', error);
        throw error;
    }
}

// Post content to Mastodon
async function postToMastodon(content) {
    if (!isMastodonConfigured || !mastodon) {
        console.log('❌ Mastodon not configured, skipping post');
        await saveToFile(content);
        return null;
    }
    try {
        console.log(`🚀 Posting to Mastodon using API URL: ${process.env.MASTODON_API_URL}`);
        console.log(`📏 Content length: ${content.length} characters`);
        
        const response = await mastodon.post('statuses', {
            status: content,
            visibility: 'public'
        });
        
        if (!response.data || !response.data.url) {
            console.error('❌ Mastodon API returned invalid response structure:', response);
            await saveToFile(content);
            return null;
        }
        
        console.log('✅ Posted to Mastodon:', response.data.url);
        return response.data;
    } catch (error) {
        console.error('❌ Error posting to Mastodon:', error);
        await saveToFile(content);
        return null;
    }
}

// Save content to file as fallback
async function saveToFile(content) {
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `./generated_content_${timestamp}.txt`;
    try {
        fs.appendFileSync(fileName, content + '\n\n---\n\n');
        console.log(`✅ Content saved to ${fileName}`);
    } catch (error) {
        console.error('❌ Error saving content to file:', error);
    }
}

// Run the bot
async function runBot(maxAgeDays = 1) {
    try {
        console.log(`🤖 Starting bot with ${maxAgeDays} day lookback period...`);
        console.log(`🔐 Mastodon configured: ${isMastodonConfigured ? '✅' : '❌'}`);
        if (isMastodonConfigured) {
            console.log(`🌐 Using Mastodon API URL: ${process.env.MASTODON_API_URL}`);
        }
        
        // Ensure MongoDB connection
        await connectToMongoDB();
        
        const news = await fetchNews(maxAgeDays);
        if (news.length === 0) {
            console.log(`No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        
        console.log(`✅ Found ${news.length} recent articles (last ${maxAgeDays} days) to process.`);
        
        for (const event of news) {
            try {
                console.log(`\n🔄 Processing: ${event.title}`);
                console.log(`📅 Published: ${event.publishedAt.toISOString()}`);
                
                const content = await generateTweet(event);
                
                // Skip if the content is null (not crypto-relevant)
                if (content === null) {
                    console.log(`⏭️ Skipping article as it's not crypto-relevant: ${event.title}`);
                    continue;
                }
                
                console.log('Generated Content:', content);
                
                if (process.env.MASTODON_POST_ENABLED === 'true') {
                    console.log('🚀 Posting to Mastodon (MASTODON_POST_ENABLED=true)');
                    const result = await postToMastodon(content);
                    
                    // Mark article as processed if posted successfully or saved to file
                    if (result || !isMastodonConfigured) {
                        await markArticleAsProcessed(event);
                    }
                } else {
                    console.log('⚠️ Skipping Mastodon post (MASTODON_POST_ENABLED not set to true)');
                    console.log('💾 Content will be saved to file');
                    await saveToFile(content);
                    
                    // Mark as processed even when not posting
                    await markArticleAsProcessed(event);
                }
                
                await delay(60000); // 1-minute delay between posts
            } catch (error) {
                console.error(`Error processing event: ${event.title}`, error);
            }
        }
    } catch (error) {
        console.error('Error in runBot:', error);
    }
}

// Test function for a quick run
async function testBot(maxAgeDays = 1) {
    try {
        // Ensure MongoDB connection
        await connectToMongoDB();
        
        console.log('🤖 Starting test run...\n');
        const news = await fetchNews(maxAgeDays);
        if (news.length === 0) {
            console.log(`❌ No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        console.log(`📰 Found ${news.length} recent news items (last ${maxAgeDays} days):\n`);
        const event = news[0];
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${event.source}`);
        console.log(`📝 TITLE: ${event.title}`);
        console.log(`📅 PUBLISHED: ${event.publishedAt.toISOString()}`);
        console.log(`🔗 URL: ${event.url}`);
        const content = await generateTweet(event);
        
        // Handle non-crypto-relevant content
        if (content === null) {
            console.log('\n⏭️ This article is not crypto-relevant and will be skipped.');
            return;
        }
        
        console.log('\n🐦 GENERATED CONTENT:');
        console.log(content);
        if (process.env.MASTODON_POST_ENABLED === 'true') {
            console.log('🚀 Test posting to Mastodon...');
            const result = await postToMastodon(content);
            if (result) {
                console.log(`✅ Posted to Mastodon: ${result.url}`);
                console.log(`📱 View your post at: ${result.url}`);
                await markArticleAsProcessed(event);
            }
        } else {
            console.log('\n⚠️ To post this to Mastodon, set MASTODON_POST_ENABLED=true in your .env file');
        }
        console.log('=====================================\n');
    } catch (error) {
        console.error('❌ Error in testBot:', error);
    }
}

// Function to post a single item
async function postSingleItem(maxAgeDays = 1) {
    try {
        // Ensure MongoDB connection
        await connectToMongoDB();
        
        console.log('🤖 Generating a single post...\n');
        const news = await fetchNews(maxAgeDays);
        if (news.length === 0) {
            console.log(`❌ No recent news found (last ${maxAgeDays} days) or all articles already processed.`);
            return;
        }
        const randomIndex = Math.floor(Math.random() * news.length);
        const event = news[randomIndex];
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${event.source}`);
        console.log(`📝 TITLE: ${event.title}`);
        console.log(`📅 PUBLISHED: ${event.publishedAt.toISOString()}`);
        console.log(`🔗 URL: ${event.url}`);
        const content = await generateTweet(event);
        
        // Handle non-crypto-relevant content
        if (content === null) {
            console.log('\n⏭️ This article is not crypto-relevant and will be skipped.');
            return;
        }
        
        // Ensure the post isn't truncated in display
        console.log('\n🐦 GENERATED CONTENT:');
        const contentLines = content.split('\n');
        for (const line of contentLines) {
            console.log(line);
        }
        console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
        
        // Check if the content is complete (doesn't end with a partial word)
        if (content.length > 480 && !content.endsWith('.') && !content.endsWith('?') && !content.endsWith('!')) {
            console.log(`\n⚠️ Warning: Post may be incomplete. Consider regenerating.`);
        }
        
        console.log('\n✋ Would you like to post this to Mastodon?');
        console.log('   To post, set MASTODON_POST_ENABLED=true in your .env file and run again');
        if (process.env.MASTODON_POST_ENABLED === 'true') {
            console.log('🚀 Posting to Mastodon...');
            const result = await postToMastodon(content);
            if (result) {
                console.log(`✅ Posted to Mastodon: ${result.url}`);
                console.log(`📱 View your post at: ${result.url}`);
                await markArticleAsProcessed(event);
            }
        }
        console.log('=====================================\n');
    } catch (error) {
        console.error('❌ Error in postSingleItem:', error);
    }
}

// Function to generate multiple posts without publishing
async function generateMultiplePosts(count = 5) {
    try {
        console.log(`🤖 Generating ${count} posts without publishing...\n`);
        const news = await fetchNews();
        if (news.length === 0) {
            console.log('❌ No news found.');
            return;
        }
        const itemCount = Math.min(count, news.length);
        for (let i = 0; i < itemCount; i++) {
            const event = news[i];
            console.log(`\n=====================================`);
            console.log(`🔍 POST #${i+1}`);
            console.log(`🔍 SOURCE: ${event.source}`);
            console.log(`📝 TITLE: ${event.title}`);
            console.log(`🔗 URL: ${event.url}`);
            const content = await generateTweet(event);
            console.log('\n🐦 GENERATED CONTENT:');
            console.log(content);
            console.log(`=====================================\n`);
            if (i < itemCount - 1) {
                console.log('Preparing next post...');
                await delay(2000);
            }
        }
        console.log(`✅ Generated ${itemCount} posts successfully!`);
    } catch (error) {
        console.error('❌ Error in generateMultiplePosts:', error);
    }
}

// Function to test both positive prompts
async function testPositivePrompts() {
    try {
        console.log('🤖 Testing both positive prompts with 650 character limit...\n');
        const news = await fetchNews();
        if (news.length === 0) {
            console.log('❌ No news found.');
            return;
        }
        
        // Get a random article to use for both tests
        const randomIndex = Math.floor(Math.random() * news.length);
        const event = news[randomIndex];
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${event.source}`);
        console.log(`📝 TITLE: ${event.title}`);
        console.log(`🔗 URL: ${event.url}`);
        
        // Generate hashtags
        const hashtags = await generateDynamicHashtags(event.title, event.description);
        console.log('Generated hashtags:', hashtags);
        
        // Test each positive prompt
        for (let i = 0; i < positivePrompts.length; i++) {
            console.log(`\n=======================================`);
            console.log(`🔍 TESTING POSITIVE PROMPT #${i+1}:`);
            
            // Generate content with current prompt
            const response = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    {
                        role: "system",
                        content: positivePrompts[i],
                    },
                    {
                        role: "user",
                        content: `Title: ${event.title}
Description: ${event.description}
URL: ${event.url}

Please format your response with:
1. Short paragraphs with line breaks between them (not one big block of text)
2. Add an extra blank line before your concluding statement or call-to-action question
3. Place the hashtags on their own line at the end

Your response can be up to 650 characters.

Hashtags: ${hashtags.join(' ')}`,
                    },
                ],
                temperature: 1.0,
                max_tokens: 700, // Increased to accommodate longer responses
            });
            
            const content = response.choices[0].message.content.trim();
            console.log('\n🐦 GENERATED CONTENT:');
            const contentLines = content.split('\n');
            for (const line of contentLines) {
                console.log(line);
            }
            console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
            console.log(`\n✨ PROMPT USED: Prompt ${i+1}`);
            console.log(`=======================================\n`);
        }
        
        console.log('✅ Testing complete for both positive prompts!');
        
    } catch (error) {
        console.error('❌ Error in testPositivePrompts:', error);
    }
}

// Function to test both neutral prompts
async function testNeutralPrompts() {
    try {
        console.log('🤖 Testing both neutral prompts with 650 character limit...\n');
        const news = await fetchNews();
        if (news.length === 0) {
            console.log('❌ No news found.');
            return;
        }
        
        // Get a random article to use for both tests
        const randomIndex = Math.floor(Math.random() * news.length);
        const event = news[randomIndex];
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${event.source}`);
        console.log(`📝 TITLE: ${event.title}`);
        console.log(`🔗 URL: ${event.url}`);
        
        // Generate hashtags
        const hashtags = await generateDynamicHashtags(event.title, event.description);
        console.log('Generated hashtags:', hashtags);
        
        // Test each neutral prompt
        for (let i = 0; i < neutralPrompts.length; i++) {
            console.log(`\n=======================================`);
            console.log(`🔍 TESTING NEUTRAL PROMPT #${i+1}:`);
            
            // Generate content with current prompt
            const response = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    {
                        role: "system",
                        content: neutralPrompts[i],
                    },
                    {
                        role: "user",
                        content: `Title: ${event.title}
Description: ${event.description}
URL: ${event.url}

Please format your response with:
1. Short paragraphs with line breaks between them (not one big block of text)
2. Add an extra blank line before your concluding statement or call-to-action question
3. Place the hashtags on their own line at the end

Your response can be up to 650 characters.

Hashtags: ${hashtags.join(' ')}`,
                    },
                ],
                temperature: 0.85, // Using the neutral temperature
                max_tokens: 700, // Increased to accommodate longer responses
            });
            
            const content = response.choices[0].message.content.trim();
            console.log('\n🐦 GENERATED CONTENT:');
            const contentLines = content.split('\n');
            for (const line of contentLines) {
                console.log(line);
            }
            console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
            console.log(`\n✨ PROMPT USED: Prompt ${i+1}`);
            console.log(`=======================================\n`);
        }
        
        console.log('✅ Testing complete for both neutral prompts!');
        
    } catch (error) {
        console.error('❌ Error in testNeutralPrompts:', error);
    }
}

// Function to test both negative prompts
async function testNegativePrompts() {
    try {
        console.log('🤖 Testing both negative prompts with 650 character limit...\n');
        const news = await fetchNews();
        if (news.length === 0) {
            console.log('❌ No news found.');
            return;
        }
        
        // Get a random article to use for both tests
        const randomIndex = Math.floor(Math.random() * news.length);
        const event = news[randomIndex];
        console.log('=====================================');
        console.log(`🔍 SOURCE: ${event.source}`);
        console.log(`📝 TITLE: ${event.title}`);
        console.log(`🔗 URL: ${event.url}`);
        
        // Generate hashtags
        const hashtags = await generateDynamicHashtags(event.title, event.description);
        console.log('Generated hashtags:', hashtags);
        
        // Test each negative prompt
        for (let i = 0; i < negativePrompts.length; i++) {
            console.log(`\n=======================================`);
            console.log(`🔍 TESTING NEGATIVE PROMPT #${i+1}:`);
            
            // Generate content with current prompt
            const response = await openai.chat.completions.create({
                model: "gpt-5",
                messages: [
                    {
                        role: "system",
                        content: negativePrompts[i],
                    },
                    {
                        role: "user",
                        content: `Title: ${event.title}
Description: ${event.description}
URL: ${event.url}

Please format your response with:
1. Short paragraphs with line breaks between them (not one big block of text)
2. Add an extra blank line before your concluding statement or call-to-action question
3. Place the hashtags on their own line at the end

Your response can be up to 650 characters.

Hashtags: ${hashtags.join(' ')}`,
                    },
                ],
                temperature: 1.0,
                max_tokens: 800, // Increased to accommodate longer responses
            });
            
            const content = response.choices[0].message.content.trim();
            console.log('\n🐦 GENERATED CONTENT:');
            const contentLines = content.split('\n');
            for (const line of contentLines) {
                console.log(line);
            }
            console.log(`\n📊 CHARACTER COUNT: ${content.length} characters`);
            console.log(`\n✨ PROMPT USED: Prompt ${i+1}`);
            console.log(`=======================================\n`);
        }
        
        console.log('✅ Testing complete for both negative prompts!');
        
    } catch (error) {
        console.error('❌ Error in testNegativePrompts:', error);
    }
}

// Uncomment one of the following lines to run your bot
// testBot();
// runBot();
// postSingleItem(); // Post a single item to Mastodon

// console.log('🔍 Testing positive prompts');
// testPositivePrompts(); // Test both positive prompts
// console.log('🔍 Testing negative prompts');
// testNegativePrompts(); // Test both negative prompts
// console.log('🔍 Testing neutral prompts');
// testNeutralPrompts(); // Test both neutral prompts
// generateMultiplePosts(1); // Generate one post without publishing

// Export MongoDB functions for external use or testing
module.exports = {
    connectToMongoDB,
    isArticleProcessed,
    markArticleAsProcessed,
    fetchNews,
    fetchNewsAPI,
    fetchDefiantRSS,
    fetchCoinDeskRSS,
    fetchCoinTelegraphRSS,
    runBot,
    testBot,
    postSingleItem,
    analyzeArticleContent,
    // Add constants for max age settings that can be used by other modules
    DEFAULT_MAX_AGE_DAYS: 1,
    EXTENDED_MAX_AGE_DAYS: 2
};

