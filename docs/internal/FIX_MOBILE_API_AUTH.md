# Fix Mobile App API Authentication (Unauthorized Errors)

## Problem
The mobile app sends Bearer tokens in the Authorization header, but these API routes only check for cookie-based sessions (used by the web app). This causes 401 Unauthorized errors when calling these endpoints from the mobile app.

**Additional Issue:** Helper functions like `getUserWorkHours()` create their own Supabase client from cookies internally. Even with auth fixed, these functions fail for mobile requests.

## Routes to Fix

### 1. Client Review Create Route
**File:** `src/app/api/client-review/create/route.ts`

### 2. Planner Trigger Route  
**File:** `src/app/api/workspaces/[workspaceId]/planner/trigger/route.ts`

---

## Fix Instructions

For **BOTH** routes, apply the same pattern:

### Step 1: Add Import
Add this import at the top of the file:
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
```

### Step 2: Replace Authentication Block
Find this pattern at the start of the POST function:
```typescript
const session = await getSession();
if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// ... some code ...

const supabase = await createClient();
```

Replace it with:
```typescript
// Try cookie-based session first (web app), then Bearer token (mobile app)
let session = await getSession();
let supabase = await createClient();

// If no cookie session, check for Bearer token (mobile app)
if (!session) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const accessToken = authHeader.substring(7);
    
    // Create a Supabase client with the access token
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );
    
    // Get the user from the token
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    session = { user };
  }
}

if (!session) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Key Changes Summary

1. **Add import** for `createSupabaseClient` from `@supabase/supabase-js`
2. **Change `const` to `let`** for both `session` and `supabase` variables
3. **Add Bearer token handling block** that:
   - Checks for Authorization header
   - Extracts the token
   - Creates a new Supabase client with the token
   - Validates the user from the token
   - Sets `session = { user }` for the rest of the code to use

## Why This Works

- **Web app**: Uses cookies → `getSession()` works → uses cookie-based supabase client
- **Mobile app**: Sends Bearer token → header check works → creates token-based supabase client

Both paths end up with a valid `session` object and appropriate `supabase` client for database operations.

## Testing

After deploying, test with curl:
```bash
curl -L -X POST 'https://posthive.app/api/client-review/create' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_VALID_TOKEN' \
  -d '{"deliverableId": "test-id", "versionNumber": 1}'
```

Should return a proper error about the deliverable not existing (not 401 Unauthorized).

---

## ADDITIONAL FIX: Planner Trigger Route - Work Hours Query

The `getUserWorkHours()` function creates its own Supabase client internally (from cookies), so it fails for mobile requests even after the auth fix above.

**In the planner trigger route**, replace this:
```typescript
// Get user's work hours
const workHours = await getUserWorkHours(workspaceId, session.user.id);
if (!workHours) {
  return NextResponse.json({ error: 'Smart scheduling is disabled' }, { status: 400 });
}
```

With this (query directly using the authenticated `supabase` client):
```typescript
// Get user's work hours - query directly to use the authenticated supabase client
const { data: workHoursData, error: workHoursError } = await supabase
  .from('workspace_members')
  .select('planner_work_start, planner_work_end, planner_enabled')
  .eq('workspace_id', workspaceId)
  .eq('user_id', session.user.id)
  .single();

if (workHoursError || !workHoursData || !workHoursData.planner_enabled) {
  return NextResponse.json({ error: 'Smart scheduling is disabled' }, { status: 400 });
}

const workHours = {
  start: workHoursData.planner_work_start || '08:30:00',
  end: workHoursData.planner_work_end || '21:30:00'
};
```

This ensures the work hours query uses the same `supabase` client that was authenticated with the Bearer token.

