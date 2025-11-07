/**
 * BACKUP: Original News Sources Implementation
 * Created: $(date)
 * 
 * This file contains the original news fetching functions from index.js
 * before replacing them with the improved RSS-based implementation.
 * 
 * Keep this file for reference or rollback if needed.
 */

const axios = require('axios');
const Parser = require('rss-parser');

// Initialize RSS parser
const parser = new Parser();

// Fetch news from NewsAPI
async function fetchNewsAPI() {
    try {
        const response = await axios.get('https://newsapi.org/v2/everything', {
            params: {
                q: 'crypto OR cryptocurrency OR bitcoin OR ethereum OR blockchain OR "web3"',
                language: 'en',
                sortBy: 'publishedAt',
                from: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().split('T')[0],
                apiKey: process.env.NEWS_API_KEY,
            },
        });
        return response.data.articles.slice(0, 3).map((article) => ({
            title: article.title,
            description: article.description,
            url: article.url,
            source: 'NewsAPI',
            publishedAt: new Date(article.publishedAt),
        }));
    } catch (error) {
        console.error('Error fetching news from NewsAPI:', error);
        return [];
    }
}

// Fetch news from The Block RSS (with fallback)
async function fetchTheBlockRSS() {
    try {
        // Try the original URL first
        try {
            const feed = await parser.parseURL('https://www.theblock.co/feed');
            return feed.items.slice(0, 2).map(item => ({
                title: item.title,
                description: item.contentSnippet || item.content,
                url: item.link,
                source: 'TheBlock',
                publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
            }));
        } catch (primaryError) {
            console.error('Error accessing primary TheBlock feed URL:', primaryError.message);
            
            // Try an alternative URL
            const feed = await parser.parseURL('https://www.theblock.co/rss.xml');
            return feed.items.slice(0, 2).map(item => ({
                title: item.title,
                description: item.contentSnippet || item.content,
                url: item.link,
                source: 'TheBlock',
                publishedAt: new Date(item.pubDate || item.isoDate || Date.now()),
            }));
        }
    } catch (error) {
        console.error('Error fetching news from The Block:', error.message);
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
        console.error('Error fetching news from CryptoPotato RSS:', error);
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
        console.error('Error fetching news from Bitcoin Magazine RSS:', error);
        return [];
    }
}

// Original combined fetch news function
async function fetchNewsOriginal(maxAgeHours = 6) {
    try {
        const [newsApiArticles, theBlockArticles, coinDeskArticles, decryptArticles, cryptoPotatoArticles, bitcoinMagazineArticles] = await Promise.all([
            fetchNewsAPI(),
            fetchTheBlockRSS(),
            fetchCoinDeskRSS(),
            fetchDecryptRSS(),
            fetchCryptoPotatoRSS(),
            fetchBitcoinMagazineRSS()
        ]);
        
        const allArticles = [...newsApiArticles, ...theBlockArticles, ...coinDeskArticles, ...decryptArticles, ...cryptoPotatoArticles, ...bitcoinMagazineArticles];
        
        // Sort by publication date (newest first)
        allArticles.sort((a, b) => b.publishedAt - a.publishedAt);
        
        // Filter out articles older than maxAgeHours
        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);
        
        const recentArticles = allArticles.filter(article => article.publishedAt >= cutoffDate);
        
        console.log(`📰 Found ${recentArticles.length} recent articles (last ${maxAgeHours} hours)`);
        
        return recentArticles;
    } catch (error) {
        console.error('Error in fetchNews:', error);
        return [];
    }
}

module.exports = {
    fetchNewsAPI,
    fetchTheBlockRSS,
    fetchCoinDeskRSS,
    fetchDecryptRSS,
    fetchCryptoPotatoRSS,
    fetchBitcoinMagazineRSS,
    fetchNewsOriginal
};
