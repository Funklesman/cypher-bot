# Cross-Posting Implementation Plan

This document outlines the plan for implementing cross-posting functionality from Mastodon to X (Twitter) and Bluesky.

## Project Structure

We've added the following new files to the project:

- `/src/js/crosspost/index.js` - Main cross-posting module
- `/src/js/crosspost/x-poster.js` - X browser automation
- `/src/js/crosspost/bluesky.js` - Bluesky API client
- `/scripts/crosspost.js` - Script to run cross-posting
- `/scripts/test-x-posting.js` - Script to test X posting functionality

## Implementation Checklist

### Phase 1: Setup ✅
- [x] Create folder structure
- [x] Create empty files
- [x] Add implementation documentation (this file)
- [x] Update package.json with new dependencies
- [x] Create skeleton implementations
- [x] Install dependencies
- [x] Add environment variables

### Phase 2: X Integration ✅
- [x] Implement browser automation login for X
- [x] Create posting functionality for X
- [x] Add support for screenshot capture for debugging
- [x] Implement error handling and retry logic
- [x] Add test script for X posting

### Phase 3: Bluesky Integration ✅
- [x] Implement Bluesky API client
- [x] Create posting functionality for Bluesky
- [x] Add support for handling media attachments
- [x] Test Bluesky posting functionality

### Phase 4: Integration with Existing Code ✅
- [x] Create main cross-posting module
- [x] Add configuration options
- [x] Implement content formatting for each platform
- [x] Create dedicated cross-posting script

### Phase 5: Testing & Deployment
- [ ] Test cross-posting locally
- [ ] Hook into existing Mastodon posting flow
- [ ] Add proper logging
- [ ] Update documentation
- [ ] Deploy to production

## Dependencies Installed ✅

The following dependencies have been installed:

```bash
npm install @atproto/api puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
```

## Environment Variables Added ✅

The following environment variables have been added to your `.env` file:

```
# Cross-posting Configuration
CROSSPOST_ENABLED=true

# X (Twitter) Configuration
X_USERNAME=your_username
X_PASSWORD=your_password

# Bluesky Configuration
BLUESKY_IDENTIFIER=your.handle
BLUESKY_PASSWORD=your_app_password

# Mastodon Configuration
MASTODON_ACCESS_TOKEN=your_mastodon_access_token
MASTODON_INSTANCE=your.mastodon.instance
```

**Note**: Remember to replace the placeholder values with your actual credentials.

## Testing X Posting

You can test the X posting functionality with:

```bash
npm run test:x
```

This will:
1. Test your X credentials to ensure they're valid
2. Post a test message to your X account
3. Save screenshots of the process in the `/screenshots` directory

If successful, you should see a new post on your X account with a timestamp.

## Testing Mastodon Crossposting

You can test crossposting your latest Mastodon post with:

```bash
npm run crosspost:latest
```

This will:
1. Fetch your most recent Mastodon post
2. Check if it has already been crossposted (to prevent duplicates)
3. Ask for confirmation before proceeding
4. Crosspost to X and Bluesky

## Next Steps

1. ✅ Install the new dependencies
2. ✅ Add the required environment variables to your `.env` file
3. ✅ Implement the X browser automation in `src/js/crosspost/x-poster.js`
4. Implement the Bluesky API client in `src/js/crosspost/bluesky.js`
5. Complete the main cross-posting module in `src/js/crosspost/index.js`
6. Integrate with the existing code to enable cross-posting when posting to Mastodon

## Usage

Once implemented, you'll be able to use cross-posting in two ways:

1. **Automatic**: When posting to Mastodon, content will also be cross-posted if `CROSSPOST_ENABLED=true`
2. **Manual**: Use the dedicated script to cross-post specific content:
   ```
   npm run crosspost
   ```

## Implementation Details

### X Browser Automation ✅

The X integration uses browser automation instead of the official API to avoid high API costs. It:
- Launches a headless browser
- Logs into your X account
- Posts content through the web interface
- Handles longer posts (for X Blue)
- Takes screenshots for debugging purposes

### Bluesky API Integration

The Bluesky integration uses the official API client (@atproto/api) to:
- Authenticate with your Bluesky account
- Post content to Bluesky
- Handle media attachments 