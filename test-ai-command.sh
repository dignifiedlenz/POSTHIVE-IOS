#!/bin/bash

# Test script for AI Command API endpoint
# Usage: ./test-ai-command.sh [access_token] [workspace_slug]

API_BASE_URL="https://www.posthive.app"
# Or use local: API_BASE_URL="http://localhost:3000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== AI Command API Test Script ===${NC}\n"

# Check if token and workspace slug are provided
if [ -z "$1" ] || [ -z "$2" ]; then
  echo -e "${RED}Usage: $0 <access_token> <workspace_slug>${NC}"
  echo ""
  echo "To get an access token:"
  echo "1. Log in to the React Native app"
  echo "2. Check the app logs for the access token, OR"
  echo "3. Use Supabase Auth API to sign in:"
  echo ""
  echo "   curl -X POST 'https://YOUR_SUPABASE_URL/auth/v1/token?grant_type=password' \\"
  echo "     -H 'Content-Type: application/json' \\"
  echo "     -H 'apikey: YOUR_SUPABASE_ANON_KEY' \\"
  echo "     -d '{\"email\":\"your@email.com\",\"password\":\"yourpassword\"}'"
  echo ""
  echo "   Extract 'access_token' from the response"
  echo ""
  exit 1
fi

ACCESS_TOKEN=$1
WORKSPACE_SLUG=$2

echo -e "${GREEN}Testing with:${NC}"
echo "  API URL: $API_BASE_URL"
echo "  Workspace: $WORKSPACE_SLUG"
echo "  Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Test 1: Simple create todo command
echo -e "${YELLOW}Test 1: Create a simple todo${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/ai/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"command\": \"create a todo to test the API\",
    \"workspaceSlug\": \"$WORKSPACE_SLUG\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Test 2: Find todos
echo -e "${YELLOW}Test 2: Find todos${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/ai/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"command\": \"show me my todos\",
    \"workspaceSlug\": \"$WORKSPACE_SLUG\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Test 3: Invalid command (should return helpful message)
echo -e "${YELLOW}Test 3: Invalid command (should return helpful message)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/ai/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"command\": \"make me a sandwich\",
    \"workspaceSlug\": \"$WORKSPACE_SLUG\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Test 4: Missing workspace (should return 400)
echo -e "${YELLOW}Test 4: Missing workspace slug (should return 400)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/ai/command" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"command\": \"create a todo\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Test 5: No auth token (should return 401)
echo -e "${YELLOW}Test 5: No auth token (should return 401)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/api/ai/command" \
  -H "Content-Type: application/json" \
  -d "{
    \"command\": \"create a todo\",
    \"workspaceSlug\": \"$WORKSPACE_SLUG\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

echo -e "${GREEN}=== Tests Complete ===${NC}"

