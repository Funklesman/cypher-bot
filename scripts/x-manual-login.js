/**
 * Manual X Login Script
 * 
 * This script opens a visible browser where you can manually log in to X.
 * After successful login, it saves your cookies for automated posting.
 * 
 * Usage: node scripts/x-manual-login.js
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configure Puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

const COOKIES_FILE = path.join(__dirname, '..', 'x-cookies.json');

async function manualLogin() {
    console.log('');
    console.log('='.repeat(60));
    console.log('🔐 X Manual Login - Cookie Generation');
    console.log('='.repeat(60));
    console.log('');
    console.log('This will open a browser where you can manually log in to X.');
    console.log('After logging in successfully:');
    console.log('  1. Make sure you see your X home feed');
    console.log('  2. Come back to this terminal');
    console.log('  3. Press Ctrl+C to save cookies and close');
    console.log('');
    console.log('Starting browser...');
    console.log('');
    
    const browser = await puppeteer.launch({
        headless: false, // VISIBLE BROWSER
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,900'
        ],
        defaultViewport: null // Use full window size
    });
    
    const page = await browser.newPage();
    
    // Check if cookies already exist
    let hasExistingCookies = false;
    try {
        const cookiesData = await fs.readFile(COOKIES_FILE, 'utf-8');
        const cookies = JSON.parse(cookiesData);
        if (cookies && cookies.length > 0) {
            hasExistingCookies = true;
            console.log('✅ Found existing cookies, loading them...');
            await page.setCookie(...cookies);
        }
    } catch (error) {
        console.log('📝 No existing cookies found, you will need to log in.');
    }
    
    console.log('🌐 Navigating to X...');
    
    if (hasExistingCookies) {
        // Try to go directly to home if we have cookies
        await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
    } else {
        // Go to login page if no cookies
        await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2' });
    }
    
    console.log('');
    console.log('✅ Browser opened!');
    console.log('');
    console.log('👉 Please log in to X manually in the browser window');
    console.log('👉 After logging in, press Ctrl+C here to save cookies');
    console.log('');
    
    // Keep the browser open and check login status periodically
    let isLoggedIn = false;
    const checkInterval = setInterval(async () => {
        try {
            const currentUrl = page.url();
            if (currentUrl.includes('/home') || currentUrl.includes('/compose')) {
                if (!isLoggedIn) {
                    isLoggedIn = true;
                    console.log('');
                    console.log('✅ Login detected! You can now:');
                    console.log('   - Browse around to verify everything works');
                    console.log('   - Press Ctrl+C to save cookies and exit');
                    console.log('');
                }
            }
        } catch (error) {
            // Page might be closed or navigating
        }
    }, 2000);
    
    // Handle graceful shutdown
    const cleanup = async () => {
        console.log('');
        console.log('💾 Saving cookies...');
        
        clearInterval(checkInterval);
        
        try {
            const cookies = await page.cookies();
            
            if (cookies.length === 0) {
                console.log('');
                console.log('⚠️  WARNING: No cookies found!');
                console.log('   Make sure you completed the login process.');
                console.log('');
            } else {
                await fs.writeFile(COOKIES_FILE, JSON.stringify(cookies, null, 2));
                console.log('');
                console.log('✅ Cookies saved to:', COOKIES_FILE);
                console.log('📊 Saved', cookies.length, 'cookies');
                console.log('');
                console.log('🎉 You can now use automated X posting!');
                console.log('   Cookies will be valid for 30-90 days.');
                console.log('');
            }
        } catch (error) {
            console.error('');
            console.error('❌ Error saving cookies:', error.message);
            console.error('');
        }
        
        await browser.close();
        console.log('👋 Browser closed. Goodbye!');
        console.log('');
        process.exit(0);
    };
    
    // Listen for Ctrl+C
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Keep the script running
    await new Promise(() => {});
}

manualLogin().catch(error => {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    process.exit(1);
});

