const express = require('express');
const router = express.Router();

// Import bot functions
let botModule;
let cryptoDiaryModule;

// Lazy load modules to avoid circular dependencies
function getBotModule() {
    if (!botModule) {
        botModule = require('../js/index');
    }
    return botModule;
}

function getCryptoDiaryModule() {
    if (!cryptoDiaryModule) {
        cryptoDiaryModule = require('../js/crypto_diary');
    }
    return cryptoDiaryModule;
}

/**
 * GET /api/status
 * Get bot status, schedule, and system info
 */
router.get('/status', async (req, res) => {
    try {
        const bot = getBotModule();
        
        // Get bot state from module
        const status = {
            running: true, // If API responds, bot is running
            nextNewsPost: bot.nextScheduledPost || null,
            nextWisdomPost: bot.nextWisdomPost || null,
            lastNewsPostTime: bot.lastNewsPostTime || null,
            uptime: process.uptime(),
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
            },
            cpu: process.cpuUsage(),
            nodeVersion: process.version,
            environment: process.env.NODE_ENV || 'production'
        };

        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting bot status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get bot status',
            error: error.message
        });
    }
});

/**
 * GET /api/latest-posts
 * Get latest posts from MongoDB
 */
router.get('/latest-posts', async (req, res) => {
    try {
        const { MongoClient } = require('mongodb');
        const mongoUri = process.env.MONGODB_URI;
        
        if (!mongoUri) {
            return res.status(503).json({
                success: false,
                message: 'MongoDB URI not configured'
            });
        }

        // Connect to MongoDB
        const client = new MongoClient(mongoUri);
        await client.connect();
        
        const db = client.db('TweetBot');

        // Get collections
        const postHistory = db.collection('post_history');
        const cryptoDiary = db.collection('crypto_diary_entries');

        // Get all posts sorted by date (for now, until we add type field)
        const latestPosts = await postHistory
            .find({})
            .sort({ postedAt: -1 })
            .limit(10)
            .toArray();

        console.log('📊 DEBUG: Found', latestPosts.length, 'posts in post_history');
        if (latestPosts.length > 0) {
            console.log('📊 DEBUG: First post keys:', Object.keys(latestPosts[0]));
            console.log('📊 DEBUG: First post data:', JSON.stringify(latestPosts[0], null, 2));
        }

        // Separate wisdom tweets from news tweets by checking the content
        const wisdomPosts = latestPosts.filter(p => 
            p.content && (p.content.includes('kodex.academy') || p.content.includes('Learn more'))
        );
        const newsPosts = latestPosts.filter(p => 
            p.content && !(p.content.includes('kodex.academy') || p.content.includes('Learn more'))
        );

        console.log('📊 DEBUG: Found', wisdomPosts.length, 'wisdom posts and', newsPosts.length, 'news posts');

        // Get latest diary entry
        const latestDiary = await cryptoDiary
            .find({})
            .sort({ postedAt: -1 })
            .limit(1)
            .toArray();

        console.log('📊 DEBUG: Found', latestDiary.length, 'diary entries');
        if (latestDiary.length > 0) {
            console.log('📊 DEBUG: First diary keys:', Object.keys(latestDiary[0]));
        }

        await client.close();

        res.json({
            success: true,
            data: {
                lastNewsPost: newsPosts[0] ? newsPosts[0].postedAt : null,
                lastWisdomPost: wisdomPosts[0] ? wisdomPosts[0].postedAt : null,
                lastDiary: latestDiary[0] ? latestDiary[0].postedAt : null
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting latest posts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get latest posts',
            error: error.message
        });
    }
});

/**
 * POST /api/generate-news
 * Trigger immediate news tweet generation
 */
router.post('/generate-news', async (req, res) => {
    try {
        const bot = getBotModule();
        
        // Trigger news post generation
        console.log('🎯 Admin triggered news tweet generation');
        
        // Call the bot's post function
        if (typeof bot.runNewsPost === 'function') {
            // Run in background
            bot.runNewsPost().then(() => {
                console.log('✅ Admin-triggered news tweet completed');
            }).catch(err => {
                console.error('❌ Admin-triggered news tweet failed:', err);
            });
            
            res.json({
                success: true,
                message: 'News tweet generation started',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Bot post function not available'
            });
        }
    } catch (error) {
        console.error('Error generating news tweet:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate news tweet',
            error: error.message
        });
    }
});

/**
 * POST /api/generate-wisdom
 * Trigger immediate wisdom tweet generation
 */
router.post('/generate-wisdom', async (req, res) => {
    try {
        const bot = getBotModule();
        
        console.log('🎯 Admin triggered wisdom tweet generation');
        
        // Call the bot's wisdom post function
        if (typeof bot.postWisdomTweet === 'function') {
            // Run in background
            bot.postWisdomTweet().then(() => {
                console.log('✅ Admin-triggered wisdom tweet completed');
            }).catch(err => {
                console.error('❌ Admin-triggered wisdom tweet failed:', err);
            });
            
            res.json({
                success: true,
                message: 'Wisdom tweet generation started',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Bot wisdom function not available'
            });
        }
    } catch (error) {
        console.error('Error generating wisdom tweet:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate wisdom tweet',
            error: error.message
        });
    }
});

/**
 * POST /api/generate-diary
 * Trigger immediate crypto diary generation
 */
router.post('/generate-diary', async (req, res) => {
    try {
        const diary = getCryptoDiaryModule();
        
        console.log('🎯 Admin triggered crypto diary generation');
        
        // Call the diary generation function
        if (typeof diary.generateCryptoDiary === 'function') {
            // Run in background
            diary.generateCryptoDiary().then(() => {
                console.log('✅ Admin-triggered crypto diary completed');
            }).catch(err => {
                console.error('❌ Admin-triggered crypto diary failed:', err);
            });
            
            res.json({
                success: true,
                message: 'Crypto diary generation started',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Diary generation function not available'
            });
        }
    } catch (error) {
        console.error('Error generating crypto diary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate crypto diary',
            error: error.message
        });
    }
});

/**
 * GET /api/settings
 * Get current bot settings (X, Bluesky toggles)
 */
router.get('/settings', (req, res) => {
    try {
        const settings = {
            xPostEnabled: process.env.X_POST_ENABLED === 'true',
            blueskyPostEnabled: process.env.BLUESKY_POST_ENABLED === 'true',
            mastodonPostEnabled: process.env.MASTODON_POST_ENABLED !== 'false'
        };

        res.json({
            success: true,
            data: settings,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting settings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get settings',
            error: error.message
        });
    }
});

/**
 * POST /api/settings/toggle-x
 * Toggle X (Twitter) posting on/off
 */
router.post('/settings/toggle-x', (req, res) => {
    try {
        const { enabled } = req.body;
        
        // Update environment variable
        process.env.X_POST_ENABLED = enabled ? 'true' : 'false';
        
        console.log(`📡 Admin ${enabled ? 'enabled' : 'disabled'} X posting`);

        res.json({
            success: true,
            message: `X posting ${enabled ? 'enabled' : 'disabled'}`,
            data: { xPostEnabled: enabled },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error toggling X posting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle X posting',
            error: error.message
        });
    }
});

/**
 * POST /api/settings/toggle-bluesky
 * Toggle Bluesky posting on/off
 */
router.post('/settings/toggle-bluesky', (req, res) => {
    try {
        const { enabled } = req.body;
        
        // Update environment variable
        process.env.BLUESKY_POST_ENABLED = enabled ? 'true' : 'false';
        
        console.log(`📡 Admin ${enabled ? 'enabled' : 'disabled'} Bluesky posting`);

        res.json({
            success: true,
            message: `Bluesky posting ${enabled ? 'enabled' : 'disabled'}`,
            data: { blueskyPostEnabled: enabled },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error toggling Bluesky posting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle Bluesky posting',
            error: error.message
        });
    }
});

/**
 * GET /api/health
 * Simple health check endpoint
 */
router.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;

