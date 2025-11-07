#!/bin/bash
# Setup script for Cypher University TweetBot

# Print colorful messages
function print_step() {
  echo -e "\033[1;36m==>\033[0m \033[1;37m$1\033[0m"
}

function print_success() {
  echo -e "\033[1;32m✓\033[0m \033[1;37m$1\033[0m"
}

function print_error() {
  echo -e "\033[1;31m✗\033[0m \033[1;37m$1\033[0m"
}

# Create required directories
print_step "Creating project directories..."
mkdir -p db logs

# Install Node.js dependencies
print_step "Installing Node.js dependencies..."
npm install
if [ $? -eq 0 ]; then
  print_success "Node.js dependencies installed successfully"
else
  print_error "Failed to install Node.js dependencies"
  exit 1
fi

# Python dependencies no longer needed - using Node.js MongoDB client

# Check if .env file exists
if [ ! -f .env ]; then
  print_step "Creating sample .env file..."
  cat > .env << EOF
# MongoDB connection
MONGO_URI=mongodb://localhost:27017

# Mastodon API credentials
MASTODON_API_URL=https://your-mastodon-instance.com/api/v1/
MASTODON_ACCESS_TOKEN=your_access_token

# OpenAI API Key
OPENAI_API_KEY=your_openai_key

# News API Key
NEWS_API_KEY=your_news_api_key

# Post control
MASTODON_POST_ENABLED=false

# Urgent News Detection Configuration
URGENCY_THRESHOLD=7
SCAN_HOURS=4
URGENT_POST_ENABLED=false

# Cross-posting Configuration
X_POST_ENABLED=false
X_USERNAME=your_x_username
X_PASSWORD=your_x_password

BLUESKY_POST_ENABLED=false
BLUESKY_IDENTIFIER=your.bsky.social
BLUESKY_PASSWORD=your_bluesky_password

# Webflow CMS Integration
WEBFLOW_POST_ENABLED=false
WEBFLOW_API_TOKEN=your_webflow_api_token
WEBFLOW_SITE_ID=your_webflow_site_id
WEBFLOW_COLLECTION_ID=your_webflow_collection_id
WEBFLOW_AUTO_PUBLISH=false

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
EOF
  print_success "Sample .env file created. Please edit it with your credentials."
else
  print_success ".env file already exists"
fi

# Make the script files executable
chmod +x scripts/*.js

print_success "Setup complete!"
print_step "To start the bot:"
echo "1. Start MongoDB: mongod --dbpath=/path/to/your/db"
echo "2. Start Redis: redis-server (or brew services start redis)"
echo "3. Run the bot: ./run-tweetbot-node.sh or npm start" 