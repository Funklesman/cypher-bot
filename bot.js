const axios = require('axios');
const { TwitterApi } = require('twitter-api-v2');
const OpenAI = require('openai');
const cron = require('node-cron');
const Parser = require('rss-parser');
require('dotenv').config();

// Initialize RSS parser
const parser = new Parser();

// Validate environment variables
function validateEnvVariables() {
    const required = [
        'TWITTER_API_KEY',
        'TWITTER_API_SECRET',
        'TWITTER_ACCESS_TOKEN',
        'TWITTER_ACCESS_SECRET',
        'OPENAI_API_KEY',
        'NEWS_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

validateEnvVariables();

// Twitter API client
const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

// OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Fetch news from NewsAPI
async function fetchNewsAPI() {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: 'crypto OR blockchain OR election OR technology',
                language: 'en',
                sortBy: 'relevancy',
                apiKey: process.env.NEWS_API_KEY,
            },
        });

        return response.data.articles.slice(0, 3).map((article) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            source: 'NewsAPI',
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
        }));
    } catch (error) {
        console.error('Error fetching news from Defiant:', error);
        return [];
    }
}

// Combined fetch news function
async function fetchNews() {
    try {
        const [newsApiArticles, defiantArticles] = await Promise.all([
            fetchNewsAPI(),
            fetchDefiantRSS()
        ]);

        // Combine and shuffle the articles
        const allArticles = [...newsApiArticles, ...defiantArticles];
        for (let i = allArticles.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allArticles[i], allArticles[j]] = [allArticles[j], allArticles[i]];
        }

        return allArticles;
    } catch (error) {
        console.error('Error fetching news:', error);
        return [];
    }
}

// Add delay utility function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Generate tweet content
async function generateTweet(event) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `
                        You are a crypto professor who explains global events with edgy, cyberpunk futuristic language with a slightly sarcastic tone.
                        Your tone is pro-decentralization and anti-governmental control. Your tweets should be engaging, informative, and actionable.
                        
                        Use one of these tweet structures randomly:
                        1. Market analysis with strategic trade vectors
                        2. Breaking news with future impact predictions
                        3. Educational knowledge drops with pro tips
                        4. Anti-establishment takes with action plans
                        5. Quick, sarcastic market insights
                        
                        Guidelines:
                        - Start with a shorter, rewritten version of the title in your style
                        - Use cyberpunk metaphors and future tech references
                        - Include actionable trading/market insights
                        - Keep sections punchy and memorable
                        - Educational content and easy to understand
                        - Use relevant emojis for visual structure
                        - End with 1-2 relevant hashtags
                        - Total response must be under 650 characters
                        
                        Make each tweet unique in structure and style. Do not include style labels in the tweet.
                    `,
                },
                {
                    role: "user",
                    content: `
                        Create a tweet about this news:
                        Title: ${event.title}
                        Description: ${event.description}
                        
                        First, rewrite the title in a shorter, punchier way that matches your style.
                        Then continue with the rest of the tweet content.
                        Make it engaging and informative.
                        Important: Do not include style labels like "NEURAL FEED" or "MARKET MATRIX" in the tweet.
                    `,
                },
            ],
            temperature: 0.9,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('Error generating tweet:', error);
        throw error;
    }
}

// Post a tweet
async function postTweet(content) {
    try {
        const response = await twitterClient.v2.tweet(content);
        console.log('Tweet posted:', response.data);
    } catch (error) {
        console.error('Error posting tweet:', error);
    }
}

// Run the bot
async function runBot() {
    try {
        const news = await fetchNews();
        if (news.length === 0) {
            console.log('No news found.');
            return;
        }

        for (const event of news) {
            try {
                const tweet = await generateTweet(event);
                console.log('Generated Tweet:', tweet);
                await postTweet(tweet);
                await delay(60000); // Add 1-minute delay between tweets
            } catch (error) {
                console.error(`Error processing event: ${event.title}`, error);
            }
        }
    } catch (error) {
        console.error('Error in runBot:', error);
    }
}

// Update the scheduler to run immediately and then every 6 hours
console.log('🤖 Bot starting...');
runBot(); // Run immediately when started

// Schedule subsequent runs every 6 hours
cron.schedule('0 */6 * * *', () => {
    console.log('⏰ Scheduled run starting...');
    runBot();
});

console.log('✅ Bot scheduled to run every 6 hours');
