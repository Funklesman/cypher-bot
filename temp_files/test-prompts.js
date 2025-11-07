/**
 * Simplified Test Script for Comparing Different Prompt Variations
 * 
 * This script directly tests different prompt variations with the OpenAI API
 * without using the tweetBot functions to avoid database operations.
 */

require('dotenv').config();
const OpenAI = require('openai');
const axios = require('axios');
const Parser = require('rss-parser');

// OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Initialize RSS parser
const parser = new Parser();

// Choose which type of prompts to test
// Now we'll test neutral prompts
const TEST_MODES = ['neutral'];

// Keep track of last used article so we don't repeat
let lastUsedArticleUrl = null;

// Fetch real articles from news sources
async function fetchRealArticles() {
    const articles = {
        neutral: null
    };
    
    try {
        console.log('📰 Fetching articles from CoinDesk...');
        
        // Only use CoinDesk since NewsAPI has rate limiting issues
        const coinDeskArticles = await fetchCoinDeskRSS();
        
        const allArticles = coinDeskArticles;
        
        if (allArticles.length === 0) {
            throw new Error('No articles found from CoinDesk');
        }
        
        console.log(`Found ${allArticles.length} total articles to analyze`);
        
        // First, try to find technically-focused articles about development or upgrades
        // These are more likely to be neutral in tone
        const techArticles = allArticles.filter(article => {
            const title = article.title.toLowerCase();
            return title.includes('upgrade') || 
                   title.includes('update') || 
                   title.includes('develop') || 
                   title.includes('launch') ||
                   title.includes('protocol') ||
                   title.includes('blockchain');
        });
        
        // Collect all neutral articles instead of just taking the first one
        const neutralArticles = [];
        
        if (techArticles.length > 0) {
            console.log(`Found ${techArticles.length} technical/development articles to try first`);
            
            // Try to find neutral articles among the tech articles first
            for (const article of techArticles) {
                // Skip the last used article to avoid repetition
                if (article.url === lastUsedArticleUrl) {
                    console.log(`Skipping previously used article: "${article.title}"`);
                    continue;
                }
                
                console.log(`Analyzing: "${article.title}"`);
                const sentiment = await analyzeArticleSentiment(article.title, article.description);
                console.log(`Sentiment result: ${sentiment}`);
                
                if (sentiment === 'neutral') {
                    neutralArticles.push(article);
                    console.log(`✅ Found a neutral technical article: "${article.title}"`);
                }
            }
        }
        
        // If no neutral tech articles found, try all articles
        if (neutralArticles.length === 0) {
            console.log('Checking all articles for neutral sentiment...');
            for (const article of allArticles) {
                // Skip tech articles we've already checked
                if (techArticles.includes(article)) {
                    continue;
                }
                
                // Skip the last used article to avoid repetition
                if (article.url === lastUsedArticleUrl) {
                    console.log(`Skipping previously used article: "${article.title}"`);
                    continue;
                }
                
                console.log(`Analyzing: "${article.title}"`);
                const sentiment = await analyzeArticleSentiment(article.title, article.description);
                console.log(`Sentiment result: ${sentiment}`);
                
                if (sentiment === 'neutral') {
                    neutralArticles.push(article);
                    console.log(`✅ Found a neutral article: "${article.title}"`);
                }
            }
        }
        
        // If we found any neutral articles, pick a random one
        if (neutralArticles.length > 0) {
            const randomIndex = Math.floor(Math.random() * neutralArticles.length);
            articles.neutral = neutralArticles[randomIndex];
            console.log(`📊 Selected random article from ${neutralArticles.length} neutral articles`);
            
            // Store the URL to avoid repetition next time
            lastUsedArticleUrl = articles.neutral.url;
        } else {
            // If still no neutral article found, use a random article that isn't the last one used
            const availableArticles = allArticles.filter(article => article.url !== lastUsedArticleUrl);
            
            if (availableArticles.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableArticles.length);
                articles.neutral = availableArticles[randomIndex];
                console.log(`⚠️ Could not find a neutral article, using a random article: "${articles.neutral.title}"`);
                
                // Store the URL to avoid repetition next time
                lastUsedArticleUrl = articles.neutral.url;
            } else {
                // If all articles have been used, just pick the first one
                articles.neutral = allArticles[0];
                console.log(`⚠️ All articles have been used, reusing the first article: "${articles.neutral.title}"`);
                
                // Reset the last used URL
                lastUsedArticleUrl = null;
            }
        }
        
        return articles;
    } catch (error) {
        console.error('Error fetching real articles:', error);
        
        // Fallback to sample article only as a last resort
        console.log('⚠️ Using fallback sample neutral article due to fetch error');
        return {
            neutral: {
                title: 'Ethereum Developers Announce Timeline for Major Network Upgrade',
                description: 'The Ethereum development team has released a roadmap for the next significant protocol upgrade, scheduled for later this year. The update aims to address scaling issues and reduce transaction fees, though some community members have expressed concerns about potential centralization risks.',
                url: 'https://example.com/crypto-development',
                source: 'Test Article'
            }
        };
    }
}

// Fetch news from NewsAPI
async function fetchNewsAPI() {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain OR "web3"',
                language: 'en',
                sortBy: 'publishedAt',
                from: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                apiKey: process.env.NEWS_API_KEY,
            },
        });
        
        return response.data.articles.slice(0, 5).map((article) => ({
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

// Fetch news from CoinDesk RSS
async function fetchCoinDeskRSS() {
    try {
        const feed = await parser.parseURL('https://www.coindesk.com/arc/outboundfeeds/rss/');
        return feed.items.slice(0, 15).map(item => ({  // Increased from 5 to 15 articles
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

// Quick sentiment analysis using OpenAI
async function analyzeArticleSentiment(title, description) {
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
                    content: `Analyze the sentiment of this crypto news:\nTitle: ${title}\nDescription: ${description}`
                }
            ],
            temperature: 0.1,
        });
        
        const sentiment = response.choices[0].message.content.trim().toLowerCase();
        
        // Map the result to our sentiment categories
        if (sentiment.includes('positive')) return 'positive';
        if (sentiment.includes('negative')) return 'negative';
        return 'neutral';
    } catch (error) {
        console.error('Error analyzing sentiment:', error);
        return 'neutral'; // Default to neutral on error
    }
}

// Test article
const testArticles = {
    negative: {
        title: 'Major Security Breach at Crypto Exchange, $200M in User Funds Missing',
        description: 'Investigators are looking into a significant security incident at a leading cryptocurrency exchange where approximately $200 million in user funds have been compromised. The exchange has temporarily suspended all withdrawals while working with cybersecurity experts to trace the stolen assets.',
        url: 'https://example.com/crypto-hack',
    },
    positive: {
        title: 'Major Financial Institution Launches Bitcoin ETF, Bringing Crypto to Mainstream Investors',
        description: 'One of the world\'s largest asset managers has officially launched its Bitcoin ETF today, allowing traditional investors to gain exposure to cryptocurrency through conventional brokerage accounts. This move is expected to bring billions in new capital to the crypto market.',
        url: 'https://example.com/crypto-adoption',
    },
    neutral: {
        title: 'Ethereum Developers Announce Timeline for Major Network Upgrade',
        description: 'The Ethereum development team has released a roadmap for the next significant protocol upgrade, scheduled for later this year. The update aims to address scaling issues and reduce transaction fees, though some community members have expressed concerns about potential centralization risks.',
        url: 'https://example.com/crypto-development',
    }
};

// Prompts for testing
const prompts = {
    negative: [
        `

Using the following news headline and context, craft a tweet that's sharp, analytical, and grounded in real crypto experience. Speak as "Cypher Funk, the Crypto Professor from Cypher University"—a voice shaped by market cycles and regulatory ups and downs, yet still curious about what's next.

Clearly outline a tension or contradiction in the news, balancing tangible benefits against real risks. Insert a brief personal reflection based on past crypto cycles—but don't mention specific years or claim any teaching roles. Keep your tone skeptical without being bitter.

Use clear, accessible language. Add 2–4 emojis that sharpen critical points—avoid decorative use. End with a concise, thought-provoking question or a grounded suggestion for further reflection. Avoid direct slogans for decentralization, but let the theme subtly appear. Stay under 650 characters.

Include these hashtags at the end:



`,
        `
Using the following news headline and context, write a tweet that's reflective, skeptical, and grounded in personal experience. 
Speak as "Cypher Funk, the Crypto Professor from Cypher University"—someone who's been around the crypto block long enough to spot contradictions. 
Share a clear anecdote that highlights a core problem, but avoid sounding cynical.

Do not mention teaching at or lecturing for Cypher University—just reference that you're from there. 
Avoid exact years (e.g., "2017," "2020"), but feel free to reference experiences from past bull or bear markets in a general sense.

Don't open with generalizations—start with something specific or personal. 
Avoid overused metaphors or emotional outbursts. Use accessible language, and explain jargon only if truly necessary. 
Add 2–4 emojis to emphasize crucial points—no fluff.

Skip direct historical comparisons unless personally relevant, and keep them year-free. 
End with a single, grounded question or invitation to reflect. 
Keep references to decentralization subtle—no slogans. 
Stay under 650 characters.

Include these hashtags at the end:


` ],
    positive: [
        `
  Using the following news headline and context, craft a tweet that is sharp, confident, and grounded in personal experience. Speak as the "Crypto Professor" from Cypher University—a voice shaped by breakthroughs and market scars. Share real optimism for what's ahead, but don't ignore red flags or power dynamics.

Avoid poetic phrasing, vague metaphors, or overly casual openers. If you use a technical term, explain it briefly. Use 2–4 emojis only where they sharpen tone or meaning—no fluff. Keep the language clear, grounded, and accessible.

No historical references unless it's one short, personal comparison. End with one open-ended question or one direct call-to-action. Do not include conversational invitations or phrases such as "Let's discuss," "What's your take?," or similar questions. Stay under 650 characters.  
Include these hashtags at the end:
`,
        `
  Using the following news headline and context, write a tweet that is reflective, honest, and quietly optimistic. Speak as the "Crypto Professor" from Cypher University—a hardened but hopeful voice shaped by real crypto experience. Share one grounded insight from your journey that reinforces cautious excitement about what's unfolding.

Avoid vague phrasing, filler metaphors, or casual hype. Skip poetic structure—just be real. Keep technical terms simple and explain briefly if needed. Use 2–4 emojis that sharpen tone or highlight contrast—avoid decorative use.

Only mention history if it's a personal reference. End with one thought-provoking question or grounded call-to-action. Max 650 characters.  
Include these hashtags at the end:
`
    ],
    neutral: [
        `
  Using the following news headline and context, craft a tweet that's clear, informed, and reflective. Speak as the "Crypto Professor" from Cypher University—someone who has navigated crypto's highs and lows but remains open-minded. Provide balanced analysis without leaning too skeptical or overly positive.

Avoid dramatic or overly-critical phrasing. Keep it direct, accessible, and thoughtful. Briefly share one relevant personal observation or insight to ground your analysis. Use 2–3 emojis to gently enhance tone.

End with a thoughtful question or constructive suggestion. Max 650 characters.  
Include these hashtags at the end:

`,
        `
  Using the following news headline and context, write a tweet in a balanced, analytical tone. Speak as the "Crypto Professor" from Cypher University—a knowledgeable observer who sees both opportunity and risk clearly. Briefly outline potential benefits and trade-offs without emphasizing negativity or criticism.

Use clear and accessible language. Briefly explain technical terms if necessary. Share a concise, neutral personal insight or observation to add depth. Include 2–3 emojis that highlight key points or contrasts subtly.

End with a reflective question or a neutral takeaway. Stay under 650 characters.  
Include these hashtags at the end:

`
    ]
};

// Sample hashtags for testing
const sampleHashtags = ['#Crypto', '#Blockchain'];

// Directly generate content using OpenAI
async function generateContent(prompt, article) {
    const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
            {
                role: "system",
                content: prompt,
            },
            {
                role: "user",
                content: `Title: ${article.title}
Description: ${article.description}
URL: ${article.url}

Please format your response with:
1. Begin with the exact article title in the first paragraph (do not prefix with "Title:" or any other text)
2. Short paragraphs with line breaks between them (not one big block of text)
3. Add an extra blank line before your concluding statement or call-to-action question
4. Place the hashtags on their own line at the end

Your response can be up to 650 characters.

Hashtags: ${sampleHashtags.join(' ')}`,
            },
        ],
        temperature: 1.0,
        max_tokens: 800, // For 650 character limit
    });

    return response.choices[0].message.content.trim();
}

// Test function to compare prompt variations
async function testPromptVariations(mode, testArticles) {
    console.log(`\n==== TESTING ${mode.toUpperCase()} PROMPT VARIATIONS ====`);
    
    // Get the test article for the current mode
    const article = testArticles[mode];
    console.log('\n📰 Test Article:');
    console.log(`Title: ${article.title}`);
    console.log(`Description: ${article.description}`);
    console.log(`Source: ${article.source || 'Unknown'}`);
    console.log(`URL: ${article.url}`);
    
    // Get both prompt variations
    const promptVariation1 = prompts[mode][0];
    const promptVariation2 = prompts[mode][1];
    
    console.log('\n==== PROMPT VERIFICATION ====');
    console.log(`${mode.charAt(0).toUpperCase() + mode.slice(1)} Prompt 1 (first few words):`, promptVariation1.trim().substring(0, 50) + '...');
    console.log(`${mode.charAt(0).toUpperCase() + mode.slice(1)} Prompt 2 (first few words):`, promptVariation2.trim().substring(0, 50) + '...');
    
    // Test variation 1
    console.log(`\n----- TESTING ${mode.toUpperCase()} VARIATION 1 -----`);
    const content1 = await generateContent(promptVariation1, article);
    console.log('\n📝 Generated Content (Variation 1):');
    console.log(content1);
    console.log(`\nCharacter count: ${content1.length}`);
    
    // Test variation 2
    console.log(`\n----- TESTING ${mode.toUpperCase()} VARIATION 2 -----`);
    const content2 = await generateContent(promptVariation2, article);
    console.log('\n📝 Generated Content (Variation 2):');
    console.log(content2);
    console.log(`\nCharacter count: ${content2.length}`);
    
    console.log('\n==== COMPARISON COMPLETE ====');
}

// Run all tests in sequence
async function runAllTests() {
    console.log('🧪 Starting prompt variation testing for neutral prompts...');
    console.log('📰 Fetching real articles...');
    
    // Fetch real articles for testing
    const testArticles = await fetchRealArticles();
    
    // Log the article that will be used
    console.log('\n📋 Article selected for testing:');
    Object.entries(testArticles).forEach(([sentiment, article]) => {
        console.log(`- ${sentiment.toUpperCase()}: "${article.title}"`);
    });
    
    // Test neutral mode with the corresponding article
    await testPromptVariations('neutral', testArticles);
}

// Run all tests
runAllTests()
    .then(() => {
        console.log('\nNeutral prompt test completed.');
    });
