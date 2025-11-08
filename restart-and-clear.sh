#!/bin/bash

echo "🔄 Stopping PM2 process..."
pm2 stop tweetbot

echo "🗑️ Clearing RSS cache..."
# The cache is in-memory, so stopping PM2 clears it

echo "💾 Pulling latest code changes..."
cd /root/tweet-bot
git pull origin main

echo "🚀 Starting PM2 process with fresh code..."
pm2 start tweetbot

echo "✅ Done! The bot is now running with 72-hour window and cleared cache."
echo "📊 Monitoring logs..."
pm2 logs tweetbot --lines 50

