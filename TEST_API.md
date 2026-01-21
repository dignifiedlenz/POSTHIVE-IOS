# Testing AI Command API with curl

## Quick Test Commands

### 1. Get Access Token from Supabase

```bash
curl -X POST 'https://YOUR_SUPABASE_URL/auth/v1/token?grant_type=password' \
  -H 'Content-Type: application/json' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -d '{"email":"your@email.com","password":"yourpassword"}'
```

Extract the `access_token` from the response.

### 2. Test AI Command API

Replace `YOUR_ACCESS_TOKEN` and `your-workspace-slug` with actual values:

```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "create a todo to test the API",
    "workspaceSlug": "your-workspace-slug"
  }'
```

### 3. Test with Different Commands

**Find todos:**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "show me my todos",
    "workspaceSlug": "your-workspace-slug"
  }'
```

**Create project:**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "create a project called Test Project",
    "workspaceSlug": "your-workspace-slug"
  }'
```

**Get schedule:**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "what is my schedule for today",
    "workspaceSlug": "your-workspace-slug"
  }'
```

### 4. Test Error Cases

**Missing workspace slug (should return 400):**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "create a todo"
  }'
```

**No auth token (should return 401):**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -d '{
    "command": "create a todo",
    "workspaceSlug": "your-workspace-slug"
  }'
```

**Invalid token (should return 401):**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer invalid-token-12345' \
  -d '{
    "command": "create a todo",
    "workspaceSlug": "your-workspace-slug"
  }'
```

**Invalid workspace (should return 404):**
```bash
curl -X POST 'https://www.posthive.app/api/ai/command' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \
  -d '{
    "command": "create a todo",
    "workspaceSlug": "non-existent-workspace"
  }'
```

## Using the Test Scripts

### Option 1: Full test suite
```bash
./test-ai-command.sh YOUR_ACCESS_TOKEN your-workspace-slug
```

### Option 2: Get token and test in one go
```bash
export SUPABASE_URL='https://your-project.supabase.co'
export SUPABASE_ANON_KEY='your-anon-key'
export API_BASE_URL='https://www.posthive.app'

./get-token-and-test.sh your@email.com yourpassword your-workspace-slug
```

## Expected Responses

### Success Response
```json
{
  "success": true,
  "message": "Created todo \"test the API\"",
  "data": {
    "id": "...",
    "title": "test the API",
    "type": "todo"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description here"
}
```

## Debugging Tips

1. **Check HTTP status code**: Should be 200 for success, 400/401/404/500 for errors
2. **Check response format**: Should always have `success` boolean and `message` string
3. **Check server logs**: Look for console.error messages in your Next.js server logs
4. **Verify token**: Make sure the access token is valid and not expired
5. **Verify workspace**: Make sure the workspace slug exists and user has access

## Common Issues

### "auth session Missing"
- The Supabase client isn't recognizing the Bearer token
- Check that the token is being sent correctly in the Authorization header
- Verify the token is valid by calling `supabase.auth.getUser(token)`

### "Workspace not found"
- The workspace slug doesn't exist
- User doesn't have access to the workspace
- Check workspace_members table

### "NEXT_REDIRECT" error
- Execution functions are trying to use `createClient()` which expects cookies
- This should be caught and return a proper error message

### 401 Unauthorized
- Token is invalid or expired
- Token format is wrong (should be "Bearer <token>")
- User doesn't exist or session is invalid

