#!/bin/bash
ACCESS_TOKEN="qCdvg8Tb8PVcPSLrVZyl9bE-wAJ21vFK9vI8irdi1S8"
API_URL="https://social.cypheruniversity.com/api/v1/statuses"
TEST_TEXT="This is a test post with exactly 600 characters."; for i in {1..10}; do TEST_TEXT="$TEST_TEXT This is additional text to make this post longer than 500 characters but still well under the 5000 character limit. We are trying to prove that the server-side limit works correctly."; done
curl -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"status\": \"$TEST_TEXT\"}" $API_URL
