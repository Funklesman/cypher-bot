#!/bin/bash
ACCESS_TOKEN="qCdvg8Tb8PVcPSLrVZyl9bE-wAJ21vFK9vI8irdi1S8"
API_URL="https://social.cypheruniversity.com/api/v1/statuses"
TEST_TEXT=$(printf "Testing character limit: %0.s" {1..600})
TEST_TEXT+=" - This post is over 500 characters long to test if the server accepts it correctly."
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"status\": \"$TEST_TEXT\"}" $API_URL
