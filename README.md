# Crypto News Bot

A Twitter bot that posts crypto and tech news with a cyberpunk twist. The bot fetches news from multiple sources and generates engaging tweets using AI.

## Features

- Fetches news from NewsAPI and Defiant.io RSS feed
- Generates tweets using GPT-4 with a unique cyberpunk professor style
- Posts updates every 6 hours
- Includes market insights and trading tips
- Uses emojis and hashtags for better engagement

## Tech Stack

- Node.js
- Twitter API v2
- OpenAI GPT-4
- NewsAPI
- RSS Parser
- node-cron for scheduling

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables: `cp .env.example .env` and fill in the values
4. Run the bot: `node bot.js`

## Note

This bot is currently scheduled to run every 6 hours. You can adjust the schedule in `bot.js` if needed.
## Dependencies

- axios
- twitter-api-v2
- openai
- node-cron
- rss-parser
- dotenv

## License

MIT