# Fix AI Command API for Bearer Token Authentication

## Problem
The AI command API route (`/api/ai/command`) fails with `NEXT_REDIRECT` errors when called from the React Native app using Bearer token authentication. This happens because execution functions call `createClient()` which requires cookies, but API routes with Bearer tokens don't have cookies.

## Solution
Pass an optional `SupabaseClient` parameter to all execution functions and helper functions. When provided, use it instead of creating a new client. This allows the API route to pass the service client (which bypasses RLS but is safe since we validate the user first).

## Status

### ✅ Completed
1. **Helper functions** (`ai-command-helpers.ts`):
   - ✅ `findProjectByName` - accepts optional `supabase` parameter
   - ✅ `findDeliverableByName` - accepts optional `supabase` parameter
   - ✅ `findTeamMemberByName` - accepts optional `supabase` parameter
   - ✅ `searchComments` - accepts optional `supabase` parameter

2. **Execution functions** (partially completed):
   - ✅ `executeCreateDeliverable` - accepts and uses `supabase` parameter
   - ✅ `executeCreateTodo` - accepts and uses `supabase` parameter
   - ✅ `executeCreateCalendarEvent` - accepts `supabase` parameter
   - ✅ `executeUpdateDeliverableDueDate` - accepts `supabase` parameter
   - ✅ `executeCreateProject` - accepts `supabase` parameter
   - ✅ `executeAssignTodo` - accepts and uses `supabase` parameter
   - ✅ `executeFindComments` - accepts `supabase` parameter
   - ✅ `executeFindDeliverables` - accepts `supabase` parameter
   - ✅ `executeUpdateTodoEstimatedTime` - accepts and uses `supabase` parameter
   - ✅ `executeUpdateTodoDueDate` - accepts and uses `supabase` parameter

3. **API Route** (`api/ai/command/route.ts`):
   - ✅ Updated to pass `supabase` (service client) to all execution function calls

### ❌ Remaining Work

#### All 56 Execution Functions - Status

**✅ Completed (10 functions):**
1. ✅ `executeCreateDeliverable` (line 755)
2. ✅ `executeCreateTodo` (line 821)
3. ✅ `executeCreateCalendarEvent` (line 980)
4. ✅ `executeUpdateDeliverableDueDate` (line 1055)
5. ✅ `executeCreateProject` (line 1118)
6. ✅ `executeAssignTodo` (line 1180)
7. ✅ `executeFindComments` (line 1251)
8. ✅ `executeFindDeliverables` (line 1296)
9. ✅ `executeUpdateTodoEstimatedTime` (line 1348)
10. ✅ `executeUpdateTodoDueDate` (line 1456)

**❌ Need `supabase` Parameter Added (46 functions):**

11. ❌ `executeUpdateTodoPriority` (line 1576)
12. ❌ `executeBlockTime` (line 1677)
13. ❌ `executeMarkTravelDay` (line 1726)
14. ❌ `executeMarkVacation` (line 1773)
15. ❌ `executeSetRecurringBlock` (line 1823)
16. ❌ `executeAdjustWorkHours` (line 1893)
17. ❌ `executeSkipCurrentTask` (line 1961)
18. ❌ `executeExtendCurrentTask` (line 2011)
19. ❌ `executeCompleteCurrentTask` (line 2073)
20. ❌ `executeRescheduleAll` (line 2131)
21. ❌ `executePushScheduleBack` (line 2154)
22. ❌ `executeClearTodaySchedule` (line 2215)
23. ❌ `executeTakeBreak` (line 2257)
24. ❌ `executeDoneForToday` (line 2303)
25. ❌ `executeStartTaskNow` (line 2418)
26. ❌ `executeExtendTaskTime` (line 2796)
27. ❌ `executeDeleteTodo` (line 2923)
28. ❌ `executeDeleteDeliverable` (line 2996) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
29. ❌ `executeDeleteProject` (line 3041) - **Calls helper: `findProjectByName`**
30. ❌ `executeDeleteEvent` (line 3078)
31. ❌ `executeDeleteComment` (line 3144)
32. ❌ `executeUnassignTodo` (line 3197)
33. ❌ `executeUpdateTodoStatus` (line 3289)
34. ❌ `executeUpdateTodoDescription` (line 3395)
35. ❌ `executeMarkTodoComplete` (line 3488)
36. ❌ `executeMarkTodoInProgress` (line 3507)
37. ❌ `executeUpdateDeliverable` (line 3526) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
38. ❌ `executeUpdateDeliverableStatus` (line 3605) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
39. ❌ `executeUpdateProject` (line 3670) - **Calls helper: `findProjectByName`**
40. ❌ `executeUpdateEvent` (line 3751)
41. ❌ `executeFindTodos` (line 3857)
42. ❌ `executeFindProjects` (line 3939)
43. ❌ `executeFindEvents` (line 4007)
44. ❌ `executeGetSchedule` (line 4074)
45. ❌ `executeGetCalendar` (line 4130)
46. ❌ `executeGetTodayTasks` (line 4175)
47. ❌ `executeGetUpcomingDeadlines` (line 4248)
48. ❌ `executeAddComment` (line 4278) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
49. ❌ `executeUpdateComment` (line 4338) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
50. ❌ `executeMarkCommentComplete` (line 4414)
51. ❌ `executeGetDeliverableComments` (line 4476) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**
52. ❌ `executeGetNotifications` (line 4531)
53. ❌ `executeMarkNotificationSeen` (line 4568)
54. ❌ `executeMarkAllNotificationsSeen` (line 4604)
55. ❌ `executeTriggerAutoScheduler` (line 4636)
56. ❌ `executeGetDeliverableVersions` (line 4668) - **Calls helpers: `findProjectByName`, `findDeliverableByName`**

**Note:** Functions marked with "Calls helpers" need special attention - make sure to pass the `client` to helper function calls.

#### Pattern to Follow

For each execution function, do the following:

1. **Add the parameter to the function signature:**
   ```typescript
   export async function executeFunctionName(
     workspaceId: string,
     workspaceSlug: string,
     params: { ... },
     lastCreatedItem?: any, // if it has this parameter
     supabase?: SupabaseClient<Database> // ADD THIS
   ): Promise<ActionResult> {
   ```

2. **Update the function body to use the provided client:**
   ```typescript
   try {
     // Use provided client or create one (for backward compatibility)
     const client = supabase || await createClient();
     
     // Replace all instances of:
     // - `const supabase = await createClient();` → remove this line
     // - `await supabase.from(...)` → `await client.from(...)`
     // - `supabase.from(...)` → `client.from(...)`
     
     // If function calls getSession(), make it conditional:
     let session = null;
     if (!supabase) {
       session = await getSession();
       if (!session) {
         return { success: false, message: 'Unauthorized' };
       }
     }
     // Note: When using service client (from API route), skip session check
     // The user is already validated in the API route
   ```

3. **If the function calls helper functions, pass the client:**
   ```typescript
   // Before:
   const project = await findProjectByName(workspaceId, params.project_name);
   
   // After:
   const project = await findProjectByName(workspaceId, params.project_name, client);
   ```

#### Functions That Call Helper Functions

These functions need special attention because they call helper functions that also need the client:

- `executeDeleteDeliverable` - calls `findProjectByName`, `findDeliverableByName`
- `executeDeleteProject` - calls `findProjectByName`
- `executeUpdateDeliverable` - calls `findProjectByName`, `findDeliverableByName`
- `executeUpdateDeliverableStatus` - calls `findProjectByName`, `findDeliverableByName`
- `executeUpdateProject` - calls `findProjectByName`
- `executeAddComment` - calls `findProjectByName`, `findDeliverableByName`
- `executeUpdateComment` - calls `findProjectByName`, `findDeliverableByName`
- `executeGetDeliverableComments` - calls `findProjectByName`, `findDeliverableByName`
- `executeGetDeliverableVersions` - calls `findProjectByName`, `findDeliverableByName`

For these, make sure to pass `client` (not `supabase`) to the helper functions.

## Testing

After completing the refactor:

1. Test with Bearer token from React Native app
2. Test with cookie-based auth from web app (should still work)
3. Verify no NEXT_REDIRECT errors occur
4. Test a few different command types (create todo, find todos, etc.)

## Files to Modify

1. `MainApp_Code/src/lib/actions/ai-command-functions.ts` - Add `supabase` parameter to ~46 remaining execution functions
2. `MainApp_Code/src/app/api/ai/command/route.ts` - Already updated ✅

## Notes

- The `supabase` parameter is optional, so existing code that doesn't pass it will still work (it will create its own client)
- When the service client is passed from the API route, it bypasses RLS, but this is safe because we validate the user in the API route first
- All helper functions already accept the optional parameter ✅
- The API route already passes the service client to all execution functions ✅

