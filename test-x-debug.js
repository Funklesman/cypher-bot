import dotenv from 'dotenv';
const puppeteerModule = await import('puppeteer');
const puppeteer = puppeteerModule.default;
import fs from 'fs';
import path from 'path';

dotenv.config();

const SCREENSHOTS_DIR = './screenshots/x-debug';

async function testLogin() {
    console.log('Testing X Login...');
    console.log('USERNAME:', process.env.X_USERNAME);
    
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run'
        ]
    });
    
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        
        console.log('1. Navigate to login');
        await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2', timeout: 30000 });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-login.png') });
        
        console.log('2. Enter username');
        await page.waitForSelector('input[autocomplete="username"]', { timeout: 30000 });
        await page.type('input[autocomplete="username"]', process.env.X_USERNAME);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2-username.png') });
        
        console.log('3. Click Next/Enter');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(5000);
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '3-after-next.png') });
        
        console.log('4. Check for password field');
        const hasPassword = await page.$('input[type="password"]');
        console.log('Has password field:', !!hasPassword);
        
        if (!hasPassword) {
            const pageText = await page.evaluate(() => document.body.innerText);
            console.log('=== PAGE TEXT SAMPLE ===');
            console.log(pageText.substring(0, 500));
            console.log('========================');
        }
        
        console.log('Screenshots saved to:', SCREENSHOTS_DIR);
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await browser.close();
    }
}

testLogin();

