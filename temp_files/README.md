# Temporary Storage for Legacy Files

This directory contains the original files that have been refactored into the new project structure. These files are kept for reference but are no longer used in the current implementation.

## Contents

### Main Bot Files
- `bot.js` - Original monolithic bot implementation (refactored to `src/js/index.js`)
- `enhanced-bot.js` - Enhanced version with extra MongoDB features (refactored to `src/js/index.js`)
- `bot-with-content-storage.js` - Bot with content storage capabilities (refactored to `src/js/index.js`)

### Runner Scripts
- `run-enhanced-bot.js` - Original runner for enhanced bot (replaced by `scripts/start.js`)
- `run-single-tweet.js` - Original script to post a single tweet (replaced by `scripts/post-single.js`)
- `start-tweetbot.js` - Original interactive starter script (replaced by `scripts/start.js`)
- `post-single-tweet.js` - Original posting script (replaced by `scripts/post-single.js`)

### Scheduler Scripts
- `tweetbot-testing.js` - Original hourly scheduling script (refactored to `src/js/index.js`)
- `tweetbot-production.js` - Original production scheduling script (refactored to `src/js/index.js`)
- `urgent-news-scheduler.js` - Original urgent news scheduler (refactored to `src/js/index.js`)

### Utilities
- `debug-mastodon.js` - Debug utility for Mastodon API (refactored to `src/js/index.js`)
- `scanForUrgentNews.js` - Original urgent news scanning (replaced by `scripts/scan-urgent.js`)

### Testing & Development Files
- `test_hashtags.js` - Hashtag generation testing script
- `test-prompts.js` - Prompt templates testing
- `test-opportunity.js` - Opportunity detection testing
- `test_urgent.js` - Simple urgent news test
- `test-prompts-README.md` - Documentation for test prompts
- `crypto_news_sources_analysis.md` - Analysis document for news sources
- `clear-cache.js` - Utility for clearing cache
- `clean-post-history.js` - Utility for cleaning post history

### Testing Scripts (from scripts/ directory)
- `test-x-posting.js` - X (Twitter) posting test
- `test-bluesky-posting.js` - Bluesky posting test
- `test-content-optimization.js` - Content optimization test
- `test-mastodon-optimize.js` - Mastodon optimization test
- `test-content-crosspost.js` - Crossposting test
- `x-test-simple.js` - Simple X posting test
- `x-only-ultra-simple.js` - Ultra simple X posting test
- `x-static-text.js` - Static text X posting test
- `x-longer-test.js` - Longer X posting test
- `test-x-basic.js` - Basic X posting test
- `simple-test-post.js` - Simple posting test
- `hashtag-format-test.js` - Hashtag formatting test
- `debug-mastodon-content.js` - Mastodon content debugging

### Development Utilities (from src/ directory)
- `test-duplicate-detection.js` - Duplicate detection test
- `test-score.js` - Scoring algorithm test
- `check-db-contents.js` - Database content checker
- `clear-some-articles.js` - Article clearing utility
- `debug-mongo-schema.js` - MongoDB schema debugging
- `direct-db-check.js` - Direct database check
- `test-db.js` - Database testing script
- `test-simple.js` - Simple functionality test
- `test-prompt-verify.js` - Prompt verification test
- `run-bot.js` - Legacy bot runner
- `test-enhanced-selection.js` - Enhanced selection test
- `test-description-storage.js` - Description storage test
- `test-all-sources.js` - All sources test
- `test-sources-stats.js` - Sources statistics test
- `test-sources.js` - Sources testing
- `check-mongodb.js` - MongoDB check utility
- `create-test-intent.js` - Test intent creator
- `test-crypto-diary.js` - Crypto diary testing
- `update-urgent-flags.js` - Urgent flags updater
- `migrate-urgent-news.js` - Urgent news migration

### Testing
- `Test files/` - Directory with original test scripts and utilities

## Note

These files are kept for reference only and should not be used in the current application. The functionality from these files has been refactored into the new project structure with improved organization and maintainability. 