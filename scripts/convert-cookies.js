/**
 * Cookie Converter
 * 
 * Converts cookies from various formats to Puppeteer format
 * 
 * Usage: node scripts/convert-cookies.js <input-file>
 */

const fs = require('fs');
const path = require('path');

function convertCookies(inputFile) {
    console.log('');
    console.log('🍪 Cookie Converter');
    console.log('='.repeat(60));
    console.log('');
    
    if (!inputFile) {
        console.error('❌ Error: No input file specified');
        console.log('');
        console.log('Usage: node scripts/convert-cookies.js <cookie-file>');
        console.log('');
        process.exit(1);
    }
    
    const fullPath = path.resolve(inputFile);
    
    if (!fs.existsSync(fullPath)) {
        console.error('❌ Error: File not found:', fullPath);
        process.exit(1);
    }
    
    console.log('📂 Reading cookies from:', fullPath);
    
    let cookies;
    try {
        const rawData = fs.readFileSync(fullPath, 'utf-8');
        cookies = JSON.parse(rawData);
    } catch (error) {
        console.error('❌ Error parsing JSON:', error.message);
        process.exit(1);
    }
    
    // Convert to Puppeteer format if needed
    let puppeteerCookies = [];
    
    if (Array.isArray(cookies)) {
        // Already an array, might be in correct format
        puppeteerCookies = cookies.map(cookie => {
            // Check if it's already in Puppeteer format
            if (cookie.name && cookie.value && cookie.domain) {
                return cookie;
            }
            
            // Convert from EditThisCookie format
            return {
                name: cookie.name,
                value: cookie.value,
                domain: cookie.domain || '.twitter.com',
                path: cookie.path || '/',
                expires: cookie.expirationDate || -1,
                httpOnly: cookie.httpOnly || false,
                secure: cookie.secure || false,
                sameSite: cookie.sameSite || 'Lax'
            };
        });
    } else {
        console.error('❌ Error: Cookies must be an array');
        process.exit(1);
    }
    
    // Filter only twitter.com cookies
    const twitterCookies = puppeteerCookies.filter(c => 
        c.domain.includes('twitter.com') || c.domain.includes('x.com')
    );
    
    if (twitterCookies.length === 0) {
        console.error('❌ Error: No Twitter/X cookies found in file');
        console.log('');
        console.log('Make sure you exported cookies from twitter.com or x.com');
        process.exit(1);
    }
    
    const outputPath = path.join(__dirname, '..', 'x-cookies.json');
    fs.writeFileSync(outputPath, JSON.stringify(twitterCookies, null, 2));
    
    console.log('');
    console.log('✅ Success!');
    console.log('📊 Converted', twitterCookies.length, 'Twitter/X cookies');
    console.log('💾 Saved to:', outputPath);
    console.log('');
    console.log('🚀 You can now use automated X posting!');
    console.log('');
}

const inputFile = process.argv[2];
convertCookies(inputFile);

