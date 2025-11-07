#!/bin/bash
ACCESS_TOKEN="qCdvg8Tb8PVcPSLrVZyl9bE-wAJ21vFK9vI8irdi1S8"
API_URL="https://social.cypheruniversity.com/api/v1/statuses"
TEST_TEXT="This is a test post with well under 5000 characters to confirm the API is working. It is longer than 500 characters though to prove our fix works!"
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"status\": \"$TEST_TEXT\"}" $API_URL
