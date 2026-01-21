# Push Notifications Setup Guide

This guide explains how to set up push notifications for PostHive Companion.

## Architecture

```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  Event Happens  │───▶│ Database Trigger     │───▶│ Queue Table     │
│  (comment/upload)    │ queue_push_on_*()    │    │ push_notif_queue│
└─────────────────┘    └──────────────────────┘    └────────┬────────┘
                                                            │
                                                            ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│  User's iPhone  │◀───│ APNs (Apple)         │◀───│ Edge Function   │
│  PostHive App   │    │                      │    │ process-push    │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## Step 1: Run the SQL

In Supabase SQL Editor, run these files in order:

1. **First, create the base push notification tables:**
   - Open your Supabase project → SQL Editor
   - Run the contents of `push_notifications_base_tables.sql`
   - This creates:
     - `user_push_tokens` - stores device tokens
     - `user_notification_preferences` - stores user notification settings

2. **Then run `push_notification_queue.sql`:**
```sql
-- This creates:
-- - push_notification_queue table
-- - queue_push_notification() function
-- - Triggers on comments, versions, todos, deliverables
```

## Step 2: Deploy Edge Functions

### Install Supabase CLI (if not installed)
```bash
npm install -g supabase
```

### Login to Supabase
```bash
supabase login
```

### Link your project
```bash
cd /path/to/POSTHIVE-IOS/supabase
supabase link --project-ref YOUR_PROJECT_REF
```

### Set the secrets
```bash
supabase secrets set APNS_KEY_ID=L8TFA7GX5T
supabase secrets set APNS_TEAM_ID=YOUR_TEAM_ID
supabase secrets set APNS_BUNDLE_ID=org.reactjs.native.example.PostHiveCompanion
supabase secrets set APNS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
YOUR_KEY_CONTENT_HERE
-----END PRIVATE KEY-----"

# For production (App Store builds), add:
# supabase secrets set APNS_PRODUCTION=true
```

### Deploy the functions
```bash
supabase functions deploy send-push
supabase functions deploy process-push-queue
```

## Step 3: Schedule the Queue Processor

### Option A: Supabase Cron (pg_cron)

In SQL Editor:
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule every minute
SELECT cron.schedule(
  'process-push-queue',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-push-queue',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Option B: External Cron (Vercel/Railway/etc)

Create a simple endpoint that calls:
```
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-push-queue
Authorization: Bearer YOUR_SERVICE_ROLE_KEY
```

### Option C: Supabase Realtime + Edge Function

Set up a Realtime subscription on `push_notification_queue` table.

## Step 4: Test It!

1. **Check queue is working:**
   ```sql
   -- Add a test notification
   INSERT INTO push_notification_queue (user_id, title, body, notification_type)
   VALUES ('YOUR_USER_ID', 'Test', 'Test notification', 'test');
   
   -- Check it was added
   SELECT * FROM push_notification_queue ORDER BY created_at DESC LIMIT 5;
   ```

2. **Trigger the processor:**
   ```bash
   curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/process-push-queue \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```

3. **Check the result:**
   ```sql
   SELECT * FROM push_notification_queue ORDER BY processed_at DESC LIMIT 5;
   ```

## Notification Types & User Preferences

| Event | Type | Preference |
|-------|------|------------|
| New comment | `comment_added` | `push_comments` |
| Reply to comment | `comment_reply` | `push_comments` |
| @mention | `comment_mention` | `push_mentions` |
| New version upload | `version_uploaded` | `push_uploads` |
| Task assigned | `todo_assigned` | `push_todos` |
| Task completed | `todo_completed` | `push_todos` |
| Deliverable status change | `deliverable_status_changed` | `push_deliverable_updates` |

Users can toggle these in the app: **Profile → Notifications**

## Troubleshooting

### No notifications received?

1. **Check the queue:**
   ```sql
   SELECT * FROM push_notification_queue WHERE status = 'pending';
   ```

2. **Check device tokens:**
   ```sql
   SELECT * FROM user_push_tokens WHERE active = true;
   ```

3. **Check user preferences:**
   ```sql
   SELECT * FROM user_notification_preferences;
   ```

4. **Check Edge Function logs:**
   - Supabase Dashboard → Edge Functions → process-push-queue → Logs

### Common errors:

- `BadDeviceToken`: Token is invalid (debug vs production mismatch)
- `Unregistered`: App was uninstalled
- `DeviceTokenNotForTopic`: Bundle ID mismatch

### Development vs Production

- **Development builds** (from Xcode): Use `api.sandbox.push.apple.com`
- **Production builds** (TestFlight/App Store): Use `api.push.apple.com`

Set `APNS_PRODUCTION=true` for production.

## Cleanup (Optional)

To clean up old processed notifications:
```sql
DELETE FROM push_notification_queue 
WHERE status IN ('sent', 'skipped') 
AND processed_at < NOW() - INTERVAL '7 days';
```








