#!/bin/bash
# Check TweetBot Instances
# A utility script to check for running instances of the tweet bot

# Print colorful messages
function print_header() {
  echo -e "\033[1;35m=== $1 ===\033[0m"
}

function print_info() {
  echo -e "\033[1;34m>\033[0m \033[1;37m$1\033[0m"
}

function print_success() {
  echo -e "\033[1;32m✓\033[0m \033[1;37m$1\033[0m"
}

function print_error() {
  echo -e "\033[1;31m✗\033[0m \033[1;37m$1\033[0m"
}

# Check for lock file
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
LOCK_FILE="${SCRIPT_DIR}/.tweetbot.lock"

print_header "TweetBot Status Check"
echo ""

# Check lock file
if [ -f "$LOCK_FILE" ]; then
  PID=$(cat "$LOCK_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    print_info "Lock file exists with PID: $PID"
    print_success "TweetBot is running (verified via lock file)"
  else
    print_error "Stale lock file exists with PID: $PID"
    print_info "This process is no longer running"
    print_info "You can delete the lock file with: rm $LOCK_FILE"
  fi
else
  print_info "No lock file found at: $LOCK_FILE"
fi

echo ""
print_header "Running TweetBot Processes"

# Find all running instances
RUNNING_PROCESSES=$(ps aux | grep "node.*run-tweetbot.js" | grep -v grep)
PROCESS_COUNT=$(echo "$RUNNING_PROCESSES" | grep -v "^$" | wc -l)

if [ "$PROCESS_COUNT" -gt 0 ]; then
  echo "$RUNNING_PROCESSES" | while read -r line; do
    PID=$(echo "$line" | awk '{print $2}')
    STATUS=$(echo "$line" | awk '{print $8}')
    RUNTIME=$(echo "$line" | awk '{print $10}')
    START_TIME=$(echo "$line" | awk '{print $9}')
    
    echo ""
    print_info "Process ID: $PID"
    print_info "Status: $STATUS"
    print_info "Running since: $START_TIME"
    print_info "CPU time: $RUNTIME"
  done
  
  if [ "$PROCESS_COUNT" -gt 1 ]; then
    echo ""
    print_error "Multiple instances detected! ($PROCESS_COUNT found)"
    print_info "You should kill extra instances with:"
    print_info "  kill -9 <PID>"
    print_info "Or kill all instances with:"
    print_info "  kill -9 \$(ps aux | grep \"node.*run-tweetbot.js\" | grep -v grep | awk '{print \$2}')"
  fi
else
  print_info "No TweetBot processes are currently running"
fi

echo ""
print_header "Recent Posts"
RECENT_POSTS=$(node -e "require('dotenv').config(); const { MongoClient } = require('mongodb'); async function main() { const client = new MongoClient(process.env.MONGO_URI); try { await client.connect(); const db = client.db(process.env.MONGODB_DB_NAME); const recentPosts = await db.collection('post_history').find().sort({postedAt: -1}).limit(3).toArray(); console.log(JSON.stringify(recentPosts, null, 2)); } finally { await client.close(); } } main().catch(console.error);" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$RECENT_POSTS" ]; then
  FORMATTED=$(echo "$RECENT_POSTS" | jq -r '.[] | "Posted at: \(.postedAt)\nTitle: \(.title)\nImportance: \(.importanceScore)/10  Urgency: \(.urgencyScore)/10\n"' 2>/dev/null)
  if [ $? -eq 0 ] && [ -n "$FORMATTED" ]; then
    echo "$FORMATTED"
  else
    echo "$RECENT_POSTS" | head -15
  fi
else
  print_error "Could not retrieve recent posts"
  print_info "Check your MongoDB connection"
fi

echo ""
print_header "Summary"
if [ "$PROCESS_COUNT" -eq 0 ]; then
  print_error "No TweetBot processes running!"
elif [ "$PROCESS_COUNT" -eq 1 ]; then
  print_success "TweetBot is running normally (1 instance)"
else
  print_error "Multiple TweetBot instances detected ($PROCESS_COUNT)"
  print_info "This may cause duplicate posts!"
fi 