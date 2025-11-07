#!/bin/bash
ACCESS_TOKEN="qCdvg8Tb8PVcPSLrVZyl9bE-wAJ21vFK9vI8irdi1S8"
API_URL="https://social.cypheruniversity.com/api/v1/statuses"
TEST_TEXT=$(cat <<EOT
This is a test post with more than 500 characters but less than 5000 characters. 
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. 
This should confirm that our server-side limit of 5000 characters is working correctly, even though the UI is still showing 500. 
EOT
)
curl -s -X POST -H "Authorization: Bearer $ACCESS_TOKEN" -H "Content-Type: application/json" -d "{\"status\": \"$TEST_TEXT\"}" $API_URL
