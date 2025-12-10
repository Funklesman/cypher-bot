const express = require('express');
const router = express.Router();
const { exec } = require('child_process');

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
        const diary = getCryptoDiaryModule();
        
        // Get bot state from module
        const status = {
            running: true, // If API responds, bot is running
            botSchedulerRunning: bot.isBotRunning || false, // Whether scheduler is active
            nextNewsPost: bot.nextScheduledPost || null,
            nextWisdomPost: bot.nextWisdomPost || null,
            nextDiary: diary.nextDiary || null,
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

        // Separate wisdom tweets from news tweets by checking the content
        const wisdomPosts = latestPosts.filter(p => 
            p.content && (p.content.includes('kodex.academy') || p.content.includes('Learn more'))
        );
        const newsPosts = latestPosts.filter(p => 
            p.content && !(p.content.includes('kodex.academy') || p.content.includes('Learn more'))
        );

        // Get latest diary entry
        const latestDiary = await cryptoDiary
            .find({})
            .sort({ postedAt: -1 })
            .limit(1)
            .toArray();

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
 * POST /api/clear-caches
 * Clear all Redis deduplication caches and MongoDB post_history
 */
router.post('/clear-caches', async (req, res) => {
    try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        console.log('🧹 Admin triggered cache clearing via API...');
        
        // Run both cache clearing scripts
        const cacheCommand = 'node scripts/clear-all-caches.js';
        const mongoCommand = 'node scripts/clear-processed-articles.js';
        
        // Execute both commands
        const { stdout: cacheOutput } = await execAsync(cacheCommand);
        const { stdout: mongoOutput } = await execAsync(mongoCommand);
        
        console.log('✅ Cache clearing completed');
        console.log('Redis output:', cacheOutput);
        console.log('MongoDB output:', mongoOutput);
        
        res.json({
            success: true,
            message: 'All caches cleared successfully',
            redis: cacheOutput,
            mongodb: mongoOutput
        });
    } catch (error) {
        console.error('Error clearing caches:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clear caches',
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
 * Get current bot settings (X, Bluesky, Wisdom toggles)
 */
router.get('/settings', (req, res) => {
    try {
        const settings = {
            xPostEnabled: process.env.X_POST_ENABLED === 'true',
            blueskyPostEnabled: process.env.BLUESKY_POST_ENABLED === 'true',
            mastodonPostEnabled: process.env.MASTODON_POST_ENABLED !== 'false',
            wisdomPostEnabled: process.env.WISDOM_POST_ENABLED === 'true'
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
 * POST /api/settings/toggle-wisdom
 * Toggle Wisdom posting on/off
 */
router.post('/settings/toggle-wisdom', (req, res) => {
    try {
        const { enabled } = req.body;
        
        // Update environment variable
        process.env.WISDOM_POST_ENABLED = enabled ? 'true' : 'false';
        
        console.log(`🎓 Admin ${enabled ? 'enabled' : 'disabled'} Wisdom posting`);

        res.json({
            success: true,
            message: `Wisdom posting ${enabled ? 'enabled' : 'disabled'}`,
            data: { wisdomPostEnabled: enabled },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error toggling Wisdom posting:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle Wisdom posting',
            error: error.message
        });
    }
});

/**
 * POST /api/bot/stop
 * Stop the tweet bot scheduler
 */
router.post('/bot/stop', async (req, res) => {
    try {
        console.log('🛑 Admin requested bot stop via API');
        const bot = getBotModule();
        
        if (typeof bot.stopBot === 'function') {
            const result = bot.stopBot();
            res.json({
                success: true,
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Bot stop function not available'
            });
        }
    } catch (error) {
        console.error('Error stopping bot:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to stop bot',
            error: error.message
        });
    }
});

/**
 * POST /api/bot/start
 * Start the tweet bot scheduler
 */
router.post('/bot/start', async (req, res) => {
    try {
        console.log('▶️ Admin requested bot start via API');
        const bot = getBotModule();
        
        if (typeof bot.startBot === 'function') {
            const result = bot.startBot();
            res.json({
                success: result.success,
                message: result.message,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                success: false,
                message: 'Bot start function not available'
            });
        }
    } catch (error) {
        console.error('Error starting bot:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to start bot',
            error: error.message
        });
    }
});

/**
 * POST /api/restart
 * Restart the tweet bot via PM2
 */
router.post('/restart', async (req, res) => {
    try {
        console.log('🔄 Admin requested bot restart via API');
        
        // Send response immediately
        res.json({
            success: true,
            message: 'Bot restart initiated via PM2',
            timestamp: new Date().toISOString()
        });
        
        // Execute PM2 restart after response is sent
        setTimeout(() => {
            console.log('🔄 Executing PM2 restart command...');
            exec('pm2 restart tweetbot', (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ PM2 restart error:', error.message);
                    return;
                }
                if (stderr) {
                    console.error('⚠️ PM2 restart stderr:', stderr);
                }
                console.log('✅ PM2 restart output:', stdout);
            });
        }, 500);
        
    } catch (error) {
        console.error('Error restarting bot:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restart bot',
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

