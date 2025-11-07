#!/bin/bash

echo "=== Redis Key Statistics Before Flush ==="
echo "Total keys: $(redis-cli DBSIZE)"

# Check for specific key patterns
echo ""
echo "Article keys: $(redis-cli KEYS "article:*" | wc -l)"
echo "Crosspost keys: $(redis-cli KEYS "crosspost:*" | wc -l)" 
echo "Global keys: $(redis-cli KEYS "global:*" | wc -l)"
echo "Recent topics: $(redis-cli KEYS "recent_topics" | wc -l)"
echo "Processing articles: $(redis-cli KEYS "processing:*" | wc -l)"

# Flush all data
echo ""
echo "Flushing all Redis data..."
redis-cli FLUSHALL

# Verify flush
echo ""
echo "=== Redis After Flush ==="
echo "Total keys: $(redis-cli DBSIZE)"

echo ""
echo "Redis cache has been completely cleared!" 