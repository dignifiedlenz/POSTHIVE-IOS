#!/bin/bash

# Helper script to get Supabase access token and test AI command API
# Usage: ./get-token-and-test.sh [email] [password] [workspace_slug]

# Set your Supabase URL and anon key here
SUPABASE_URL="${SUPABASE_URL:-https://your-project.supabase.co}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-your-anon-key}"
API_BASE_URL="${API_BASE_URL:-https://www.posthive.app}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ -z "$1" ] || [ -z "$2" ] || [ -z "$3" ]; then
  echo -e "${RED}Usage: $0 <email> <password> <workspace_slug>${NC}"
  echo ""
  echo "Or set environment variables:"
  echo "  export SUPABASE_URL='https://your-project.supabase.co'"
  echo "  export SUPABASE_ANON_KEY='your-anon-key'"
  echo "  export API_BASE_URL='https://www.posthive.app'"
  echo ""
  exit 1
fi

EMAIL=$1
PASSWORD=$2
WORKSPACE_SLUG=$3

echo -e "${YELLOW}Step 1: Getting access token from Supabase...${NC}"

# Sign in and get token
TOKEN_RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token' 2>/dev/null)

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  echo -e "${RED}Failed to get access token${NC}"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✓ Got access token: ${ACCESS_TOKEN:0:20}...${NC}"
echo ""

echo -e "${YELLOW}Step 2: Testing AI Command API...${NC}"
echo ""

# Test the API
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

if [ "$HTTP_CODE" = "200" ]; then
  echo ""
  echo -e "${GREEN}✓ Test successful!${NC}"
else
  echo ""
  echo -e "${RED}✗ Test failed with status $HTTP_CODE${NC}"
fi

