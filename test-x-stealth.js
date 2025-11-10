const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

// Configure Puppeteer with stealth plugin
puppeteer.use(StealthPlugin());

const SCREENSHOTS_DIR = './screenshots/x-stealth-test';

async function testStealthLogin() {
    const loginUsername = process.env.X_LOGIN || process.env.X_USERNAME;
    
    console.log('🧪 Testing X Login with Stealth Plugin...');
    console.log('📧 X_LOGIN:', process.env.X_LOGIN);
    console.log('📧 X_USERNAME:', process.env.X_USERNAME);
    console.log('🔑 X_PASSWORD:', process.env.X_PASSWORD ? '***' + process.env.X_PASSWORD.slice(-4) : 'NOT SET');
    console.log('👤 Using for login:', loginUsername);
    console.log('');
    
    // Validate credentials
    if (!loginUsername || !process.env.X_PASSWORD) {
        console.error('❌ ERROR: X_LOGIN/X_USERNAME or X_PASSWORD not set in .env file');
        process.exit(1);
    }
    
    // Create screenshots directory
    try {
        await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote'
        ]
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        console.log('1️⃣ Navigate to X login page...');
        await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-login-page.png') });
        console.log('✅ Login page loaded');
        
        console.log('2️⃣ Wait for username field...');
        await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2-username-field-found.png') });
        console.log('✅ Username field found');
        
        console.log('3️⃣ Enter username:', loginUsername);
        await page.type('input[autocomplete="username"]', loginUsername);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '3-username-entered.png') });
        console.log('✅ Username entered');
        
        console.log('4️⃣ Press Enter to continue...');
        await page.keyboard.press('Enter');
        await new Promise(resolve => setTimeout(resolve, 5000));
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '4-after-enter.png') });
        console.log('✅ Enter pressed');
        
        console.log('5️⃣ Check for password field...');
        const hasPassword = await page.$('input[type="password"]');
        
        if (hasPassword) {
            console.log('✅ Password field found!');
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '5-password-field-found.png') });
            
            console.log('6️⃣ Enter password...');
            await page.type('input[type="password"]', process.env.X_PASSWORD);
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '6-password-entered.png') });
            
            console.log('7️⃣ Press Enter to log in...');
            await page.keyboard.press('Enter');
            await new Promise(resolve => setTimeout(resolve, 5000));
            await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '7-after-login.png') });
            
            console.log('8️⃣ Check if logged in...');
            const currentUrl = page.url();
            console.log('Current URL:', currentUrl);
            
            if (currentUrl.includes('/home') || currentUrl.includes('/compose')) {
                console.log('✅ SUCCESS! Logged in to X');
            } else {
                console.log('⚠️ Login may have failed - unexpected URL');
            }
            
        } else {
            console.log('❌ No password field found!');
            const pageText = await page.evaluate(() => document.body.innerText);
            console.log('=== PAGE TEXT SAMPLE ===');
            console.log(pageText.substring(0, 500));
            console.log('========================');
        }
        
        console.log('');
        console.log('📸 Screenshots saved to:', SCREENSHOTS_DIR);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('📸 Screenshots saved to:', SCREENSHOTS_DIR);
    } finally {
        await browser.close();
    }
}

testStealthLogin();

