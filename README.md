# Cypher University TweetBot

A crypto news bot that automatically fetches, analyzes, and posts relevant cryptocurrency news to Mastodon with cross-posting capabilities to X (Twitter) and Bluesky.

## Features

- Fetches news from multiple sources (CoinDesk, TheBlock, Decrypt, CryptoPotato, Bitcoin Magazine)
- Uses OpenAI's GPT-5 to analyze news importance, relevance, and sentiment
- Deduplicates similar content across different news outlets using advanced similarity detection
- Automatically generates social media posts with appropriate tone and hashtags
- Cross-posts to multiple platforms (Mastodon, X, Bluesky)
- Monitors for urgent crypto news and posts breaking updates
- Generates daily Crypto Diary summarizing important events

## Requirements

- Node.js (v16+)
- MongoDB (v6.0+) for storing post history and processed articles
- Redis for content deduplication and caching
- OpenAI API key
- Mastodon account with API access
- Optional: X (Twitter) and Bluesky accounts for cross-posting

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd tweet-bot
```

2. Install dependencies:
```bash
npm install
```

3. Run the setup script to create required directories and configuration:
```bash
./setup.sh
```

4. Configure the `.env` file with your credentials:
```
# MongoDB connection
MONGO_URI=mongodb://localhost:27017
MONGODB_USE_NODEJS_CLIENT=true
MONGODB_DB_NAME=TweetBot

# Mastodon API credentials
MASTODON_API_URL=https://your-mastodon-instance.com/api/v1/
MASTODON_ACCESS_TOKEN=your_access_token

# OpenAI API Key
OPENAI_API_KEY=your_openai_key

# News API Key
NEWS_API_KEY=your_news_api_key

# Post control
MASTODON_POST_ENABLED=true

# Urgent News Detection Configuration
URGENCY_THRESHOLD=7
SCAN_HOURS=4
URGENT_POST_ENABLED=true

# Cross-posting Configuration
X_POST_ENABLED=false
X_USERNAME=your_x_username
X_PASSWORD=your_x_password
X_POST_NOHASHTAGS=false

BLUESKY_POST_ENABLED=false
BLUESKY_IDENTIFIER=your.bsky.social
BLUESKY_PASSWORD=your_bluesky_password
BLUESKY_REMOVE_EMOJIS=false

# Redis Configuration (for deduplication)
REDIS_HOST=localhost
REDIS_PORT=6379
# REDIS_PASSWORD=your_password_if_needed
```

5. Make sure MongoDB and Redis are running:
```bash
# Start MongoDB
mongod --dbpath=/path/to/your/db

# Start Redis
redis-server
# OR on macOS with Homebrew:
brew services start redis
```

## Usage

### Running with the Menu Script
To run with an interactive menu:

```bash
./run-tweetbot-node.sh
```

This presents a menu with the following options:
1. **Testing Mode**: Posts every 30 minutes and scans for urgent news
2. **Production Mode**: Posts every 6 hours and scans for urgent news every 30 minutes
3. **Urgent News Test**: Runs a one-time scan for urgent news
4. **Generate Single Post**: Generates and posts a single update
5. **Exit**: Closes the application

### Using NPM Scripts

```bash
# Start the bot with interactive menu
npm start

# Start in production mode
npm run start:prod 

# Post a single update
npm run post:single

# Scan for urgent news
npm run urgent:scan

# Generate a Crypto Diary
npm run diary:generate

# Test Crypto Diary generation
npm run diary:test

# Cross-post latest Mastodon post to X and Bluesky
npm run crosspost

# Cross-post latest Mastodon post (dry run)
npm run crosspost:dryrun

# Cross-post latest Mastodon post to other platforms
npm run crosspost:latest
```

## Architecture

### Core Components

- **src/js/index.js**: Main module with news fetching, AI analysis, and posting logic
- **src/js/content_deduplicator.js**: Advanced content similarity detection and clustering
- **src/js/mongodb_client.js**: Direct MongoDB client for database operations
- **src/js/mongodb_service.js**: Higher-level service for database interactions
- **src/js/crypto_diary.js**: Daily crypto news summary generator
- **src/js/crosspost/**: Cross-posting functionality to X and Bluesky
  - **integrated-cross-poster.js**: Manages cross-posting to multiple platforms
  - **x-poster.js**: Handles posting to X (Twitter)
  - **bluesky.js**: Handles posting to Bluesky

### Database Structure

- **post_history**: Records of all posts made
- **processedArticles**: Tracks processed news articles with metadata
- **processing_intents**: Prevents race conditions between posting flows (with TTL index)

## Advanced Features

### Enhanced Duplicate Prevention System
- Intent-based tracking system in MongoDB
- Prevents race conditions between urgent and regular posting flows
- Eliminates duplicate posts when both flows try to process the same article

### Article Scoring and Selection
- AI-driven importance scoring (1-10 scale)
- Sentiment analysis (positive, neutral, negative)
- Topic clustering to ensure content variety
- Source reliability weighting in selection algorithm

### Urgency Detection
- Configurable urgency threshold (default: 7/10)
- Special formatting for urgent posts with appropriate emojis
- Dedicated prompt templates for urgent content

### Daily Crypto Diary
- Automatic daily generation at 8 PM local time
- Uses the top 10 most important articles from the past 24 hours
- Personal, journal-style reflections in the "Crypto Professor's" voice
- Saved to logs/crypto-diary/ for website integration

## Project Structure

```
tweet-bot/
├── logs/                # Generated logs and saved tweets
├── scripts/             # Runner scripts
│   ├── start.js         # Main starter script
│   ├── post-single.js   # Script to post a single tweet
│   ├── scan-urgent.js   # Script to scan for urgent news
│   ├── crosspost.js     # Cross-posting functionality
│   └── ...              # Other utility scripts
├── src/                 # Source code
│   ├── js/              # JavaScript source
│   │   ├── index.js                # Main bot implementation
│   │   ├── mongodb_client.js       # Direct MongoDB client
│   │   ├── mongodb_service.js      # MongoDB service layer
│   │   ├── db_client_factory.js    # Database client factory
│   │   ├── content_deduplicator.js # Content similarity detection
│   │   ├── crypto_diary.js         # Crypto diary generator
│   │   └── crosspost/              # Cross-posting functionality
│   │       ├── integrated-cross-poster.js  # Cross-posting manager
│   │       ├── x-poster.js                 # X (Twitter) posting
│   │       └── bluesky.js                  # Bluesky posting
│   └── run-tweetbot.js   # Main runner script
├── tests/               # Test scripts and utilities
├── .env                 # Environment variables
├── package.json         # Node.js dependencies
├── run-tweetbot-node.sh # Node.js runner script
├── setup.sh             # Setup script
└── README.md            # This file
```

## Troubleshooting

- **No posts appearing**: Check MongoDB connection and verify MASTODON_POST_ENABLED=true
- **Duplicate posts**: Check processing_intents collection in MongoDB
- **API connection errors**: Ensure all API keys are correct and services are accessible
- **MongoDB errors**: Verify MongoDB is running and MONGO_URI is correct, check MongoDB version compatibility
- **Redis connection errors**: Ensure Redis is running (redis-server or brew services start redis)
- **Cross-posting failures**: Check platform credentials and try the dry run option first
- **"Cannot connect to MongoDB" errors**: This bot uses a direct Node.js MongoDB client, not a Python bridge

## Production Deployment

For production use, it's recommended to use a process manager like PM2:

```bash
# Install PM2
npm install -g pm2

# Start the bot in production mode
pm2 start npm --name "tweet-bot" -- run start:prod

# View logs
pm2 logs

# Stop the bot
pm2 stop tweet-bot
```

## Recent Updates

### Enhanced Duplicate Prevention System (Mar 2025)
- Implemented a persistent intent-based tracking system in MongoDB
- Created a new `processing_intents` collection with TTL index for automatic cleanup
- Prevents race conditions between urgent and regular posting flows

### Improved Score Field Handling (Mar 2025)
- Fixed handling of various naming conventions for score fields in MongoDB operations
- Enhanced logging for better debugging of article processing

### Article Score Tracking (Mar 2025)
- Implemented importance and urgency score storage in the database
- Scores are now stored in processed articles, content, and post history collections
- Enables analytics based on article importance and urgency patterns

### Cross-posting Capabilities (Mar 2025)
- Added support for posting to X (Twitter) and Bluesky
- Implemented thread creation for longer content
- Content optimization for each platform's specific features