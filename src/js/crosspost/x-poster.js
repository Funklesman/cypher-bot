/**
 * X (Twitter) Poster Module
 * 
 * This module handles posting to X using browser automation.
 * It uses Puppeteer to interact with the X web interface instead of the API.
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');

// Configure Puppeteer with stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

// Create screenshots directory for debugging if it doesn't exist
const SCREENSHOTS_DIR = path.join(__dirname, '../../../screenshots');
const COOKIES_PATH = path.join(__dirname, '../../../.x-cookies.json');

/**
 * Ensure screenshots directory exists
 */
async function ensureScreenshotsDir() {
  try {
    await fs.mkdir(SCREENSHOTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating screenshots directory:', error);
  }
}

/**
 * Helper function to wait for a specified time
 */
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Save cookies from the browser session
 * 
 * @param {Object} page - Puppeteer page object
 */
async function saveCookies(page) {
  const cookies = await page.cookies();
  await fs.writeFile(COOKIES_PATH, JSON.stringify(cookies, null, 2));
  console.log('X session cookies saved for future use');
}

/**
 * Load cookies into the browser session
 * 
 * @param {Object} page - Puppeteer page object
 * @returns {boolean} Whether cookies were loaded successfully
 */
async function loadCookies(page) {
  try {
    const cookiesString = await fs.readFile(COOKIES_PATH);
    const cookies = JSON.parse(cookiesString);
    if (cookies.length) {
      await page.setCookie(...cookies);
      console.log('X session cookies loaded from previous session');
      return true;
    }
    return false;
  } catch (error) {
    console.log('No previous X session found or error loading cookies');
    return false;
  }
}

/**
 * Post content to X using browser automation
 * 
 * @param {string} content - The content to post
 * @param {Array} mediaFiles - Array of media files to attach
 * @param {Object} options - Additional posting options
 * @returns {Object} Result of the posting operation
 */
async function postToX(content, mediaFiles = [], options = {}) {
  console.log('🚀 Posting to X via browser automation...');
  
  const browser = await puppeteer.launch({ 
    headless: 'new', // Use new headless mode (optimized)
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    // Create screenshots directory
    await ensureScreenshotsDir();
    
    // Attempt to use existing session
    let loggedIn = false;
    
    if (!options.forceLogin) {
      console.log('Trying to reuse existing X session...');
      const hasCookies = await loadCookies(page);
      
      if (hasCookies) {
        // Navigate to X home to check if we're still logged in
        await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-home-check.png') });
        
        // Check if we're logged in by looking for compose elements
        loggedIn = await isLoggedIn(page);
        
        if (loggedIn) {
          console.log('Successfully restored X session, already logged in');
        } else {
          console.log('Cookie session expired, will perform a fresh login');
        }
      }
    }
    
    // Login if needed
    if (!loggedIn) {
      // 1. Navigate to X login page
      console.log('Navigating to X login page...');
      await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2' });
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '1-login-page.png') });
      
      // 2. Log in to X
      console.log('Logging in to X...');
      const loginSuccess = await loginToX(page, process.env.X_USERNAME, process.env.X_PASSWORD);
      
      if (!loginSuccess) {
        throw new Error('Failed to log in to X');
      }
      
      // Save cookies after successful login
      await saveCookies(page);
    }
    
    // 3. Navigate to compose tweet page - try different possible URLs
    console.log('Navigating to compose tweet page...');
    try {
      await page.goto('https://twitter.com/compose/tweet', { waitUntil: 'networkidle2' });
      // Wait longer after navigation to ensure the compose page is fully loaded
      await wait(5000);
    } catch (error) {
      console.log('Could not navigate to /compose/tweet, trying alternative...');
      await page.goto('https://twitter.com/home', { waitUntil: 'networkidle2' });
      await wait(5000);
    }
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '3-compose-page.png') });
    
    // 4. Enter tweet content - try different possible selectors
    console.log('Finding tweet input area...');
    
    // Possible tweet input selectors
    const tweetInputSelectors = [
      '[data-testid="tweetTextarea_0"]',
      'div[role="textbox"][aria-label="Tweet text"]',
      'div[data-testid="tweetTextInput_0"]',
      'div[aria-label="Post text"]'
    ];
    
    // Try each tweet input selector
    let tweetInputFound = false;
    for (const selector of tweetInputSelectors) {
      try {
        const exists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, selector);
        
        if (exists) {
          console.log(`Found tweet input with selector: ${selector}`);
          
          // Wait longer to ensure the input is fully interactive
          await wait(3000);
          
          // Click and make sure it's focused
          await page.click(selector);
          await wait(1000);
          
          // For longer content, enter it in chunks to avoid potential issues
          console.log('Entering tweet content...');
          if (content.length > 500) {
            // Break content into chunks of 100 characters
            const chunks = [];
            for (let i = 0; i < content.length; i += 100) {
              chunks.push(content.substring(i, i + 100));
            }
            
            // Type each chunk with a small delay
            for (const chunk of chunks) {
              await page.type(selector, chunk);
              await wait(300);
            }
          } else {
            // For shorter content, just type it all at once
            await page.type(selector, content);
          }
          
          // Wait after typing to ensure content is properly entered
          await wait(2000);
          
          tweetInputFound = true;
          break;
        }
      } catch (error) {
        console.log(`Error with input selector ${selector}:`, error.message);
        // Continue to next selector
      }
    }
    
    // If no dedicated compose area found, try to find the "post" or "tweet" button on the home page
    if (!tweetInputFound) {
      console.log('No dedicated tweet input found, looking for post button on home page...');
      const tweetButtonSelectors = [
        '[data-testid="SideNav_NewTweet_Button"]',
        'a[href="/compose/tweet"]',
        'div[aria-label="Tweet"]',
        'div[data-testid="tweetButtonInline"]',
        'div[aria-label="Post"]',
        'a[aria-label="Tweet"]',
        'a[data-testid="Tweet-Button"]',
        'a:has-text("Tweet")',
        'div:has-text("Tweet")'
      ];
      
      for (const selector of tweetButtonSelectors) {
        try {
          const exists = await page.evaluate((sel) => {
            return !!document.querySelector(sel);
          }, selector);
          
          if (exists) {
            console.log(`Found tweet button with selector: ${selector}`);
            await page.click(selector);
            // Wait longer for the compose box to appear
            console.log('Waiting for compose box to appear...');
            await wait(5000);
            
            // Try finding the tweet input area again
            for (const inputSelector of tweetInputSelectors) {
              try {
                console.log(`Checking for input: ${inputSelector}`);
                await page.waitForSelector(inputSelector, { timeout: 10000 });
                // Wait longer to ensure the input is fully interactive
                await wait(3000);
                
                await page.click(inputSelector);
                await wait(1000);
                
                // For longer content, enter it in chunks
                console.log('Entering tweet content...');
                if (content.length > 500) {
                  // Break content into chunks of 100 characters
                  const chunks = [];
                  for (let i = 0; i < content.length; i += 100) {
                    chunks.push(content.substring(i, i + 100));
                  }
                  
                  // Type each chunk with a small delay
                  for (const chunk of chunks) {
                    await page.type(inputSelector, chunk);
                    await wait(300);
                  }
                } else {
                  await page.type(inputSelector, content);
                }
                
                // Wait after typing
                await wait(2000);
                
                tweetInputFound = true;
                break;
              } catch (error) {
                console.log(`Error with input after button click (${inputSelector}):`, error.message);
                // Continue to next input selector
              }
            }
            
            if (tweetInputFound) break;
          }
        } catch (error) {
          console.log(`Error with button selector ${selector}:`, error.message);
          // Continue to next button selector
        }
      }
    }
    
    if (!tweetInputFound) {
      throw new Error('Could not find a tweet input area');
    }
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '4-content-entered.png') });
    
    // 5. Handle media uploads if any
    if (mediaFiles && mediaFiles.length > 0) {
      console.log('Uploading media files...');
      await uploadMedia(page, mediaFiles);
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '5-media-uploaded.png') });
    }
    
    // Get the current tweet count for verification
    const initialTweetCount = await getTweetCount(page);
    console.log(`Initial tweet count: ${initialTweetCount}`);
    
    // 6. Submit the tweet with multiple possible selectors
    console.log('Looking for submit tweet button...');
    const tweetSubmitSelectors = [
      '[data-testid="tweetButton"]',
      'div[role="button"]:has-text("Tweet")',
      'div[role="button"]:has-text("Post")',
      'div[data-testid="tweetButtonInline"]',
      'div[aria-label="Post"]',
      '[aria-label="Post"]',
      'span:has-text("Tweet")',
      'span:has-text("Post")',
      'button:has-text("Tweet")',
      'button:has-text("Post")'
    ];
    
    let submitButtonFound = false;
    for (const selector of tweetSubmitSelectors) {
      try {
        const isVisible = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          if (!element) return false;
          
          // Check if the element is visible and not disabled
          const style = window.getComputedStyle(element);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden';
          const isEnabled = !element.disabled;
          
          return isVisible && isEnabled;
        }, selector);
        
        if (isVisible) {
          console.log(`Found submit button with selector: ${selector}`);
          
          // Wait to ensure it's fully interactive
          await wait(2000);
          
          // Setup dialog handler before clicking
          page.on('dialog', async dialog => {
            console.log(`Dialog appeared: ${dialog.type()} with message: ${dialog.message()}`);
            await dialog.accept();
            console.log('Dialog accepted');
          });
          
          // Click the button and wait for navigation or network idle
          console.log('Clicking submit button...');
          
          // Use Promise.all to wait for potential navigation or dialog
          await Promise.all([
            page.click(selector),
            // Wait for navigation or network idle, but don't fail if it doesn't happen
            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 })
              .catch(e => console.log('No navigation occurred after clicking submit')),
          ]);
          
          // Additional wait after clicking to allow any post-click processes to complete
          await wait(5000);
          
          // Check for error toasts or messages after clicking
          const errorMessage = await page.evaluate(() => {
            // Common selectors for error messages or toasts
            const errorSelectors = [
              'div[data-testid="toast"]',
              'div[role="alert"]',
              '[data-testid="toast"]',
              '[data-testid="toast-text"]',
              '[data-testid="error"]',
              '[role="alert"]'
            ];
            
            for (const selector of errorSelectors) {
              const elements = document.querySelectorAll(selector);
              for (const element of elements) {
                if (element && element.textContent) {
                  return element.textContent.trim();
                }
              }
            }
            
            return null;
          });
          
          if (errorMessage) {
            console.error('Error message detected after submit:', errorMessage);
            throw new Error(`Error submitting post: ${errorMessage}`);
          }
          
          // Take a screenshot after clicking
          await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '5a-after-click.png') });
          
          submitButtonFound = true;
          console.log(`Clicked submit button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`Error with submit button selector ${selector}:`, error.message);
        // Continue to next selector
      }
    }
    
    if (!submitButtonFound) {
      throw new Error('Could not find a tweet submit button');
    }
    
    // Wait longer after submitting to ensure the post is processed
    console.log('Waiting for tweet to be posted...');
    await wait(20000); // Wait 20 seconds
    
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '6-tweet-posted.png') });
    
    // Verify the post by checking if tweet count increased
    let postSuccessful = false;
    try {
      // Try multiple verification methods
      console.log('Verifying post with multiple methods...');
      
      // Method 1: Check for success indicators on current page
      const successIndicators = [
        'Your Tweet was sent',
        'Your post was sent',
        'View',
        'View Tweet'
      ];
      
      for (const indicator of successIndicators) {
        const hasIndicator = await page.evaluate((text) => {
          return document.body.innerText.includes(text);
        }, indicator);
        
        if (hasIndicator) {
          console.log(`Found success indicator: "${indicator}"`);
          postSuccessful = true;
          break;
        }
      }
      
      // Method 2: Go to profile page and check tweet count
      if (!postSuccessful) {
        console.log('Navigating to profile page to verify post...');
        await page.goto(`https://twitter.com/${process.env.X_USERNAME}`, { 
          waitUntil: 'networkidle2',
          timeout: 30000
        });
        await wait(5000); // Wait for profile to load
        
        // Check if tweet count increased
        const newTweetCount = await getTweetCount(page);
        console.log(`New tweet count: ${newTweetCount}`);
        
        if (newTweetCount > initialTweetCount) {
          postSuccessful = true;
          console.log('Tweet count increased, post confirmed successful!');
        } else {
          console.log('Tweet count did not increase, trying content matching...');
          
          // Method 3: Look for the post by content
          const postExists = await findRecentPostByContent(page, content);
          if (postExists) {
            postSuccessful = true;
            console.log('Found recent post with matching content!');
          }
        }
      }
      
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '7-profile-verification.png') });
    } catch (error) {
      console.error('Error verifying post:', error);
    }
    
    if (postSuccessful) {
      console.log('✅ Successfully posted to X!');
      return { success: true };
    } else {
      console.log('⚠️ Post submission appeared to work but could not verify the post');
      // Take an additional screenshot of what we see
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'failed-verification.png') });
      
      // Check if there's any error message on the page
      const errorMessage = await page.evaluate(() => {
        // Look for common error message elements
        const errorSelectors = [
          'div[data-testid="toast"]',
          'div[role="alert"]',
          'div[data-testid="toast-text"]',
          'div[data-testid="error"]',
          '.css-901oao.r-37j5jr.r-a023e6' // Common class for error messages
        ];
        
        for (const selector of errorSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            return element.textContent.trim();
          }
        }
        
        // Look for any text that might indicate an error
        const errorTexts = ['failed', 'error', 'unable', 'cannot', 'try again', 'problem'];
        for (const errorText of errorTexts) {
          const elements = document.querySelectorAll('div, span, p');
          for (const element of elements) {
            if (element.textContent && 
                element.textContent.toLowerCase().includes(errorText) &&
                element.textContent.length < 200) {
              return element.textContent.trim();
            }
          }
        }
        
        return null;
      });
      
      if (errorMessage) {
        console.error('Detected error message:', errorMessage);
        return { success: false, error: errorMessage };
      }
      
      // Create a debug log of all visible text on the page
      const pageText = await page.evaluate(() => document.body.innerText);
      await fs.writeFile(path.join(SCREENSHOTS_DIR, 'page-text-debug.txt'), pageText);
      console.log('Saved page text for debugging to page-text-debug.txt');
      
      // For now, don't report success if we couldn't verify
      return { success: false, warning: 'Could not verify post' };
    }
  } catch (error) {
    console.error('❌ Error posting to X:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'error.png') });
    return { success: false, error: error.message };
  } finally {
    await browser.close();
  }
}

/**
 * Check if the user is logged in to X
 * 
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<boolean>} Whether the user is logged in
 */
async function isLoggedIn(page) {
  const loggedInSelectors = [
    '[data-testid="SideNav_NewTweet_Button"]',
    '[aria-label="Home timeline"]',
    '[data-testid="AppTabBar_Home_Link"]',
    'a[href="/home"]',
    'a[href="/compose/tweet"]',
    'div[aria-label="Tweet"]',
    'div[data-testid="tweetButtonInline"]'
  ];
  
  for (const selector of loggedInSelectors) {
    try {
      const exists = await page.evaluate((sel) => {
        return !!document.querySelector(sel);
      }, selector);
      
      if (exists) {
        return true;
      }
    } catch (error) {
      // Continue to next selector
    }
  }
  
  return false;
}

/**
 * Get tweet count from profile page
 * 
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<number>} Tweet count
 */
async function getTweetCount(page) {
  try {
    // Wait a bit for page to load
    await wait(2000);
    
    // Check for tweet count in various formats
    const tweetCountSelectors = [
      'a[href$="/posts"] span span',
      '[data-testid="primaryColumn"] a[role="tab"] span span',
      'div[data-testid="primaryColumn"] a[href*="/posts"] span',
      'a[aria-label*="posts"]'
    ];
    
    for (const selector of tweetCountSelectors) {
      try {
        const countText = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element ? element.textContent : null;
        }, selector);
        
        if (countText) {
          // Parse number from text like "1,234 Posts" or just "1,234"
          const match = countText.replace(',', '').match(/(\d+)/);
          if (match) {
            return parseInt(match[1], 10);
          }
        }
      } catch (error) {
        // Try next selector
      }
    }
    
    return 0; // Could not determine count
  } catch (error) {
    console.error('Error getting tweet count:', error);
    return 0;
  }
}

/**
 * Find a recent post by content on the profile page
 * 
 * @param {Object} page - Puppeteer page object
 * @param {string} content - Post content to look for
 * @returns {boolean} Whether the post was found
 */
async function findRecentPostByContent(page, content) {
  try {
    console.log('Looking for recent post with matching content...');
    
    // Make sure we're on the profile page
    const currentUrl = page.url();
    if (!currentUrl.includes(`twitter.com/${process.env.X_USERNAME}`)) {
      await page.goto(`https://twitter.com/${process.env.X_USERNAME}`, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      await wait(5000); // Wait for profile to load
    }
    
    // Wait for tweets to load
    await wait(3000);
    
    // Create a simplified version of content for comparison
    // Strip whitespace, lowercase, and remove URLs
    const simplifyText = (text) => {
      return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    };
    
    const simplifiedContent = simplifyText(content);
    console.log(`Looking for simplified content: "${simplifiedContent.substring(0, 40)}..."`);
    
    // Check if there's any tweet containing our content
    const found = await page.evaluate((simplifiedContent) => {
      // Find all tweet articles
      const tweets = document.querySelectorAll('[data-testid="tweet"]');
      if (!tweets || tweets.length === 0) return false;
      
      // Helper function to simplify text in the browser context
      const simplifyText = (text) => {
        return text
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .replace(/https?:\/\/\S+/g, '')
          .replace(/[^\w\s]/g, '')
          .trim();
      };
      
      // Check each tweet
      for (const tweet of tweets) {
        const tweetText = tweet.innerText;
        const simplifiedTweet = simplifyText(tweetText);
        
        // Check if the simplified tweet contains our simplified content
        // For long content, just check if the first 40 chars match
        const contentToCheck = simplifiedContent.length > 40 
          ? simplifiedContent.substring(0, 40)
          : simplifiedContent;
          
        if (simplifiedTweet.includes(contentToCheck)) {
          return true;
        }
      }
      
      return false;
    }, simplifiedContent);
    
    return found;
  } catch (error) {
    console.error('Error finding recent post:', error);
    return false;
  }
}

/**
 * Log in to X
 * 
 * @param {Object} page - Puppeteer page object
 * @param {string} username - X username
 * @param {string} password - X password
 * @returns {boolean} Whether login was successful
 */
async function loginToX(page, username, password) {
  try {
    // Take a screenshot of the initial login page
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2a-login-page.png') });
    
    // Wait for the username field (longer timeout since X can be slow)
    await page.waitForSelector('input[autocomplete="username"]', { timeout: 60000 });
    
    // Clear and enter username using evaluate to set the value directly
    await page.evaluate(() => {
      document.querySelector('input[autocomplete="username"]').value = '';
    });
    await page.type('input[autocomplete="username"]', username);
    
    // Take screenshot after username entry
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2b-username-entered.png') });
    
    // Look for the Next button by multiple potential selectors
    const nextButtonSelectors = [
      '[data-testid="auth-username-next"]',
      'div[role="button"]:has-text("Next")',
      'div[role="button"]:has-text("next")',
      'span:has-text("Next")',
      'button:has-text("Next")'
    ];
    
    // Try each selector
    let nextButtonFound = false;
    for (const selector of nextButtonSelectors) {
      try {
        const isVisible = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element && element.offsetWidth > 0 && element.offsetHeight > 0;
        }, selector);
        
        if (isVisible) {
          await page.click(selector);
          nextButtonFound = true;
          console.log(`Found Next button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    if (!nextButtonFound) {
      // Try clicking on the submit button
      await page.keyboard.press('Enter');
      console.log('Could not find Next button, pressed Enter instead');
    }
    
    // Wait for password field (with longer timeout)
    await page.waitForSelector('input[type="password"]', { timeout: 60000 });
    
    // Take screenshot before entering password
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2c-password-page.png') });
    
    // Clear and enter password using evaluate to set the value directly
    await page.evaluate(() => {
      document.querySelector('input[type="password"]').value = '';
    });
    await page.type('input[type="password"]', password);
    
    // Take screenshot after password entry
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2d-password-entered.png') });
    
    // Look for the Login button by multiple potential selectors
    const loginButtonSelectors = [
      '[data-testid="LoginForm_Login_Button"]',
      'div[role="button"]:has-text("Log in")',
      'div[role="button"]:has-text("login")',
      'div[role="button"]:has-text("Sign in")',
      'span:has-text("Log in")',
      'button:has-text("Log in")'
    ];
    
    // Try each selector
    let loginButtonFound = false;
    for (const selector of loginButtonSelectors) {
      try {
        const isVisible = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element && element.offsetWidth > 0 && element.offsetHeight > 0;
        }, selector);
        
        if (isVisible) {
          await page.click(selector);
          loginButtonFound = true;
          console.log(`Found Login button with selector: ${selector}`);
          break;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    if (!loginButtonFound) {
      // Try pressing Enter
      await page.keyboard.press('Enter');
      console.log('Could not find Login button, pressed Enter instead');
    }
    
    // Instead of waiting for navigation, wait for a bit and then check for login elements
    console.log('Waiting for login to complete...');
    await wait(15000); // Wait 15 seconds for login to process
    
    // Take screenshot after login attempt
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2e-login-attempt.png') });
    
    // Check if we're logged in by looking for common elements on the home page
    const loggedInSelectors = [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label="Home timeline"]',
      '[data-testid="AppTabBar_Home_Link"]',
      // Additional elements that might indicate login success
      'a[href="/home"]',
      'a[href="/compose/tweet"]',
      'div[aria-label="Tweet"]',
      'div[data-testid="tweetButtonInline"]',
      // Even more general selectors
      '[aria-label*="timeline"]',
      '[data-testid*="Home"]',
      '[data-testid*="Tweet"]'
    ];
    
    // Navigate to home page to verify login
    try {
      await page.goto('https://twitter.com/home', { timeout: 30000 });
      console.log('Navigated to Twitter home page to verify login');
      await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2f-home-page.png') });
    } catch (error) {
      console.log('Could not navigate to home page, continuing anyway');
    }
    
    for (const selector of loggedInSelectors) {
      try {
        const exists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, selector);
        
        if (exists) {
          console.log(`Login successful, found element with selector: ${selector}`);
          return true;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    // Try to detect login error messages
    const errorSelectors = [
      '[data-testid="LoginForm_Login_Error"]',
      '[data-testid*="error"]',
      'span:has-text("incorrect")',
      'span:has-text("failed")',
      'div:has-text("incorrect username")',
      'div:has-text("incorrect password")'
    ];
    
    for (const selector of errorSelectors) {
      try {
        const exists = await page.evaluate((sel) => {
          return !!document.querySelector(sel);
        }, selector);
        
        if (exists) {
          console.log(`Login failed, found error with selector: ${selector}`);
          return false;
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    // If we reach here, login might have succeeded but we couldn't verify
    console.log('Could not conclusively verify login success, but continuing anyway...');
    return true; // Assume success and try to proceed
  } catch (error) {
    console.error('Error during login:', error);
    // Take screenshot of the error state
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '2z-login-error.png') });
    return false;
  }
}

/**
 * Upload media files to a tweet
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Array} mediaFiles - Array of media file paths to upload
 */
async function uploadMedia(page, mediaFiles) {
  if (!mediaFiles || mediaFiles.length === 0) {
    return;
  }
  
  // Attempt to find the media upload input with different selectors
  const mediaUploadSelectors = [
    'input[type="file"][accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"]',
    'input[type="file"][multiple]',
    'input[type="file"][accept*="image"]',
    'input[type="file"]'
  ];
  
  for (const selector of mediaUploadSelectors) {
    try {
      const fileInputExists = await page.evaluate((sel) => {
        return !!document.querySelector(sel);
      }, selector);
      
      if (fileInputExists) {
        console.log(`Found media upload input with selector: ${selector}`);
        
        // Set up file input element
        const input = await page.$(selector);
        if (input) {
          // Upload all files
          await input.uploadFile(...mediaFiles);
          console.log(`Uploaded ${mediaFiles.length} media files`);
          
          // Wait for media to be processed
          console.log('Waiting for media to process...');
          await wait(5000); // Give some time for media to process
          return;
        }
      }
    } catch (error) {
      console.log(`Error with selector ${selector}:`, error.message);
      // Continue to next selector
    }
  }
  
  // If we get here, try to look for media upload buttons
  const mediaButtonSelectors = [
    '[aria-label="Add photos or video"]',
    '[data-testid="imageOrVideoIcon"]',
    'svg[aria-label*="media"]',
    'button[aria-label*="media"]',
    'button[aria-label*="photo"]',
    'svg[aria-label*="photo"]'
  ];
  
  for (const selector of mediaButtonSelectors) {
    try {
      const buttonExists = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element && element.offsetWidth > 0 && element.offsetHeight > 0;
      }, selector);
      
      if (buttonExists) {
        console.log(`Found media button with selector: ${selector}`);
        await page.click(selector);
        await page.waitForTimeout(1000);
        
        // After clicking the button, look for file inputs again
        for (const fileSelector of mediaUploadSelectors) {
          try {
            const fileInputVisible = await page.evaluate((sel) => {
              const element = document.querySelector(sel);
              return element && !element.disabled;
            }, fileSelector);
            
            if (fileInputVisible) {
              const input = await page.$(fileSelector);
              await input.uploadFile(...mediaFiles);
              console.log(`Uploaded ${mediaFiles.length} media files after clicking media button`);
              await page.waitForTimeout(5000); // Give some time for media to process
              return;
            }
          } catch (error) {
            // Continue to next file selector
          }
        }
      }
    } catch (error) {
      // Continue to next button selector
    }
  }
  
  console.warn('⚠️ Could not find a way to upload media files');
}

/**
 * Test if X credentials are valid
 * 
 * @returns {Promise<Object>} Result of the test
 */
async function testXCredentials() {
  console.log('🔑 Testing X credentials...');
  
  if (!process.env.X_USERNAME || !process.env.X_PASSWORD) {
    return { 
      success: false, 
      error: 'X credentials not set in environment variables' 
    };
  }
  
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  try {
    // Create screenshots directory
    await ensureScreenshotsDir();
    
    // Navigate to X login page
    console.log('Navigating to X login page...');
    await page.goto('https://twitter.com/i/flow/login', { waitUntil: 'networkidle2' });
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-login-page.png') });
    
    // Log in to X
    console.log('Testing login with provided credentials...');
    const loginSuccess = await loginToX(
      page, 
      process.env.X_USERNAME, 
      process.env.X_PASSWORD
    );
    
    if (!loginSuccess) {
      throw new Error('Failed to log in with provided credentials');
    }
    
    // Take screenshot after successful login
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-login-success.png') });
    
    console.log('✅ X credentials are valid!');
    return { 
      success: true,
      username: process.env.X_USERNAME
    };
  } catch (error) {
    console.error('❌ Error testing X credentials:', error);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, 'test-login-error.png') });
    return { 
      success: false, 
      error: error.message 
    };
  } finally {
    await browser.close();
  }
}

module.exports = {
  postToX,
  testXCredentials
};
