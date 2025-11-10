# Export X Cookies from Chrome

Since X blocks automated logins, we'll use your existing Chrome session cookies.

## Method 1: Using Chrome DevTools (Recommended)

1. **Open Chrome and go to X/Twitter** (make sure you're logged in)
   - Visit: https://twitter.com/home

2. **Open Chrome DevTools**
   - Mac: `Cmd + Option + I`
   - Windows/Linux: `F12` or `Ctrl + Shift + I`

3. **Go to the Application tab** (in DevTools)

4. **In the left sidebar, expand "Cookies"**
   - Click on `https://twitter.com`

5. **Copy all cookies:**
   - Right-click on any cookie
   - Select "Show All" or select all cookies manually
   - Copy each cookie's Name and Value

## Method 2: Using EditThisCookie Extension (Easier!)

1. **Install the extension:**
   - Go to: https://chrome.google.com/webstore/detail/editthiscookie/fngmhnnpilhplaeedifhccceomclgfbg
   - Click "Add to Chrome"

2. **Export cookies:**
   - Go to https://twitter.com/home (make sure you're logged in)
   - Click the EditThisCookie extension icon
   - Click the "Export" button (looks like a download icon)
   - This copies all cookies to your clipboard as JSON

3. **Save the cookies:**
   - Create a file: `x-cookies.json` in the tweet-bot directory
   - Paste the exported cookies into this file
   - Save the file

## Method 3: Using Cookie-Editor Extension

1. **Install Cookie-Editor:**
   - Chrome: https://chrome.google.com/webstore/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm
   - Firefox: https://addons.mozilla.org/en-US/firefox/addon/cookie-editor/

2. **Export:**
   - Go to https://twitter.com/home
   - Click Cookie-Editor extension icon
   - Click "Export" button
   - Choose "JSON" format
   - Save to `x-cookies.json`

---

## After Exporting

Once you have `x-cookies.json`, we'll upload it to the server and X posting will work!

