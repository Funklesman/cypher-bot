/**
 * Clean Send Tweet Script
 * 
 * This script avoids running the tests in bot.js
 */

require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs');
const { MongoClient } = require('mongodb');
const Mastodon = require('mastodon-api');

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

// OpenAI API client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Mastodon API client
const mastodon = new Mastodon({
  access_token: process.env.MASTODON_ACCESS_TOKEN,
  api_url: process.env.MASTODON_API_URL
});

// Function to fetch an article from a direct RSS feed to avoid duplicates
async function fetchArticle() {
  try {
    const Parser = require('rss-parser');
    const parser = new Parser();
    
    // Try Cointelegraph first
    console.log('Fetching from CoinTelegraph RSS...');
    const feed = await parser.parseURL('https://cointelegraph.com/rss');
    if (feed.items && feed.items.length > 0) {
      const article = feed.items[0];
      return {
        title: article.title,
        description: article.contentSnippet || article.content,
        url: article.link,
        source: 'CoinTelegraph',
        publishedAt: new Date(article.pubDate || article.isoDate || Date.now()),
      };
    }
    
    // Fallback to a hardcoded article if needed
    return {
      title: "Bitcoin Price Hits New High as Institutional Demand Grows",
      description: "Bitcoin has surged to a new all-time high as institutional investors continue to enter the cryptocurrency market, with analysts predicting further growth ahead.",
      url: "https://example.com/bitcoin-price",
      source: "Example Source",
      publishedAt: new Date()
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    
    // Return a fallback article
    return {
      title: "Cryptocurrency Adoption Continues to Expand Globally",
      description: "More countries and companies are embracing blockchain technology and cryptocurrencies, leading to increased mainstream adoption.",
      url: "https://example.com/crypto-adoption",
      source: "Example Source",
      publishedAt: new Date()
    };
  }
}

// Generate tweet content
async function generateTweet(article) {
  try {
    // We'll use a simplified version with a neutral prompt
    const prompt = `
Using the following news headline and context, craft a tweet that is balanced, raw, and deeply personal. Write as if you're reflecting on your own experiences as part of Cypher University—a crypto learning platform with a raw, cyberpunk-inspired tone. Express thoughtful analysis and genuine curiosity without leaning too positive or negative. Use clear, accessible language with occasional technical terms (explain briefly if needed). Include 2-3 appropriate emojis that complement your analytical tone. Avoid historical references entirely, or include at most one very brief mention that doesn't overshadow your personal perspective. Conclude with a single thoughtful question or call-to-action, and subtly hint at decentralization between the lines. Keep it under 650 characters. 
Include these hashtags at the end: #Crypto #Blockchain`;
    
    const formatInstructions = `Please format your response with:
1. Begin with the exact article title in the first paragraph (do not prefix with "Title:" or any other text)
2. Short paragraphs with line breaks between them (not one big block of text)
3. Add an extra blank line before your concluding statement or call-to-action question
4. Place the hashtags on their own line at the end

Your response can be up to 650 characters.`;
    
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

${formatInstructions}

Hashtags: #Crypto #Blockchain`,
        },
      ],
      temperature: 0.85,
      max_tokens: 800,
    });

    let content = response.choices[0].message.content.trim();
    console.log(`📏 Content length: ${content.length} characters`);
    return content;
  } catch (error) {
    console.error('Error generating tweet:', error);
    return null;
  }
}

// Post content to Mastodon
async function postToMastodon(content) {
  try {
    const response = await mastodon.post('statuses', {
      status: content,
      visibility: 'public'
    });
    console.log('✅ Posted to Mastodon:', response.data.url);
    return response.data;
  } catch (error) {
    console.error('❌ Error posting to Mastodon:', error);
    return null;
  }
}

// Mark article as processed
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

// Main function
async function sendSingleTweet() {
  try {
    console.log('🤖 Generating and sending a single tweet...\n');
    
    // Ensure MongoDB connection
    await connectToMongoDB();
    
    // Get an article
    const article = await fetchArticle();
    
    console.log(`\n📝 Selected article: ${article.title}`);
    console.log(`🔍 Source: ${article.source}`);
    console.log(`📅 Published: ${article.publishedAt.toISOString()}`);
    
    // Generate tweet content
    console.log('\n⏳ Generating tweet...');
    const content = await generateTweet(article);
    
    if (!content) {
      console.log('❌ Could not generate tweet content for this article.');
      return;
    }
    
    // Show the generated content
    console.log('\n📝 Generated tweet:');
    console.log('----------------------------------------');
    console.log(content);
    console.log('----------------------------------------');
    console.log(`📊 Character count: ${content.length}/650`);
    
    // Post to Mastodon
    console.log('\n🚀 Posting to Mastodon...');
    const result = await postToMastodon(content);
    
    if (result) {
      console.log(`✅ Tweet posted successfully!`);
      console.log(`🔗 URL: ${result.url}`);
      
      // Mark as processed
      await markArticleAsProcessed(article);
    } else {
      console.log('❌ Failed to post to Mastodon.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the function
sendSingleTweet(); 