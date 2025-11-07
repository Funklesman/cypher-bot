#!/bin/bash
# Node-only TweetBot startup script

# Store the script location
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
echo "Working directory: ${SCRIPT_DIR}"
cd "${SCRIPT_DIR}"

# Define lock file
LOCK_FILE="${SCRIPT_DIR}/.tweetbot.lock"

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

# Check if already running
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    print_error "TweetBot is already running with PID $PID"
    print_error "If this is incorrect, delete the lock file: $LOCK_FILE"
    exit 1
  else
    print_step "Removing stale lock file..."
    rm "$LOCK_FILE"
  fi
fi

# Create lock file with current PID
echo $$ > "$LOCK_FILE"
print_success "Created lock file with PID $$"

# Function to clean up lock file on exit
function cleanup() {
  print_step "Removing lock file..."
  rm -f "$LOCK_FILE"
  print_success "Lock file removed"
  echo "TweetBot stopped"
  exit 0
}

# Set up trap to remove lock file on exit
trap cleanup EXIT INT TERM

# Check if Redis is running
print_step "Checking if Redis is running..."
if redis-cli ping > /dev/null 2>&1; then
  print_success "Redis is running"
else
  print_step "Starting Redis..."
  brew services start redis
  sleep 2
  if redis-cli ping > /dev/null 2>&1; then
    print_success "Redis started successfully"
  else
    print_error "Failed to start Redis. Please run 'brew services start redis' manually."
    exit 1
  fi
fi

# Create required directories
print_step "Creating required directories..."
mkdir -p "${SCRIPT_DIR}/screenshots" "${SCRIPT_DIR}/logs"
print_success "Directories created"

# Set environment variables for Node.js MongoDB client
print_step "Configuring for Node.js MongoDB client..."
export DB_MODE=node
export MONGODB_DB_NAME=TweetBot
print_success "Node.js MongoDB configuration set"

# Start the TweetBot using Node.js MongoDB client
print_step "Starting TweetBot in Node.js-only mode (foreground)..."

# Run in the foreground
echo "TweetBot running in foreground mode. Press Ctrl+C to stop."
echo "---------------------------------------------------------"
node "${SCRIPT_DIR}/src/run-tweetbot.js" 