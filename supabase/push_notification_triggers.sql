-- =============================================
-- PUSH NOTIFICATION TRIGGERS FOR POSTHIVE
-- Run this AFTER creating the base tables
-- =============================================

-- Enable the http extension for calling Edge Functions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- =============================================
-- HELPER FUNCTION: Send Push Notification
-- =============================================
CREATE OR REPLACE FUNCTION send_push_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_notification_type TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response extensions.http_response;
  v_payload JSONB;
  v_supabase_url TEXT;
BEGIN
  -- Get Supabase URL from environment or hardcode your project URL
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not set, you can hardcode it:
  -- v_supabase_url := 'https://YOUR_PROJECT_REF.supabase.co';
  
  IF v_supabase_url IS NULL THEN
    RAISE NOTICE 'Supabase URL not configured, skipping push notification';
    RETURN;
  END IF;

  v_payload := jsonb_build_object(
    'userId', p_user_id,
    'title', p_title,
    'body', p_body,
    'notificationType', p_notification_type,
    'data', p_data
  );

  -- Call the Edge Function
  SELECT * INTO v_response FROM extensions.http((
    'POST',
    v_supabase_url || '/functions/v1/send-push',
    ARRAY[
      extensions.http_header('Content-Type', 'application/json'),
      extensions.http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
    ],
    'application/json',
    v_payload::TEXT
  )::extensions.http_request);

  -- Log response for debugging (optional)
  IF v_response.status != 200 THEN
    RAISE NOTICE 'Push notification failed: %', v_response.content;
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Don't fail the original transaction if push fails
  RAISE NOTICE 'Push notification error: %', SQLERRM;
END;
$$;

-- =============================================
-- TRIGGER: New Comment Added
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deliverable RECORD;
  v_version RECORD;
  v_commenter_name TEXT;
  v_notify_user_id UUID;
BEGIN
  -- Get version and deliverable info
  SELECT v.*, d.name as deliverable_name, d.project_id, d.created_by as deliverable_owner
  INTO v_version
  FROM versions v
  JOIN deliverables d ON d.id = v.deliverable_id
  WHERE v.id = NEW.version_id;

  -- Get commenter name
  SELECT name INTO v_commenter_name
  FROM users
  WHERE id = NEW.author_id;

  -- Don't notify if commenting on own deliverable
  IF v_version.deliverable_owner != NEW.author_id THEN
    -- Notify deliverable owner
    PERFORM send_push_notification(
      v_version.deliverable_owner,
      '',
      v_commenter_name || ' left comment on ' || v_version.deliverable_name,
      'comment_added',
      jsonb_build_object(
        'deliverable_id', v_version.deliverable_id,
        'comment_id', NEW.id,
        'version_number', v_version.version_number
      )
    );
  END IF;

  -- If this is a reply, notify the parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_notify_user_id
    FROM comments
    WHERE id = NEW.parent_id
    AND author_id != NEW.author_id;

    IF v_notify_user_id IS NOT NULL THEN
      PERFORM send_push_notification(
        v_notify_user_id,
        'New Reply',
        v_commenter_name || ' replied to your comment',
        'comment_reply',
        jsonb_build_object(
          'deliverable_id', v_version.deliverable_id,
          'comment_id', NEW.id,
          'parent_id', NEW.parent_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists, then create
DROP TRIGGER IF EXISTS trigger_notify_new_comment ON comments;
CREATE TRIGGER trigger_notify_new_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_comment();

-- =============================================
-- TRIGGER: New Version Uploaded
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_new_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deliverable RECORD;
  v_uploader_name TEXT;
  v_team_member RECORD;
BEGIN
  -- Get deliverable info
  SELECT d.*, p.name as project_name
  INTO v_deliverable
  FROM deliverables d
  LEFT JOIN projects p ON p.id = d.project_id
  WHERE d.id = NEW.deliverable_id;

  -- Get uploader name
  SELECT name INTO v_uploader_name
  FROM users
  WHERE id = NEW.uploaded_by;

  -- Notify all workspace members who have access to this project
  -- (except the uploader)
  FOR v_team_member IN
    SELECT DISTINCT wm.user_id
    FROM workspace_members wm
    WHERE wm.workspace_id = v_deliverable.workspace_id
    AND wm.user_id != NEW.uploaded_by
  LOOP
    PERFORM send_push_notification(
      v_team_member.user_id,
      'New Version Uploaded',
      v_uploader_name || ' uploaded v' || NEW.version_number || ' of "' || v_deliverable.name || '"',
      'version_uploaded',
      jsonb_build_object(
        'deliverable_id', NEW.deliverable_id,
        'version_number', NEW.version_number,
        'project_id', v_deliverable.project_id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_version ON versions;
CREATE TRIGGER trigger_notify_new_version
  AFTER INSERT ON versions
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_version();

-- =============================================
-- TRIGGER: Todo Assigned
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_todo_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigner_name TEXT;
BEGIN
  -- Only notify if assigned_to changed and is set
  IF NEW.assigned_to IS NOT NULL 
    AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)
    AND NEW.assigned_to != NEW.created_by
  THEN
    -- Get assigner name (use updated_by if available, otherwise created_by)
    SELECT name INTO v_assigner_name
    FROM users
    WHERE id = COALESCE(NEW.created_by);

    PERFORM send_push_notification(
      NEW.assigned_to,
      'Task Assigned',
      v_assigner_name || ' assigned you: "' || NEW.title || '"',
      'todo_assigned',
      jsonb_build_object(
        'todo_id', NEW.id,
        'project_id', NEW.project_id,
        'due_date', NEW.due_date
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_todo_assigned ON todos;
CREATE TRIGGER trigger_notify_todo_assigned
  AFTER INSERT OR UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_todo_assigned();

-- =============================================
-- TRIGGER: Todo Completed
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_todo_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_completer_name TEXT;
BEGIN
  -- Only notify when status changes to completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Notify the creator if someone else completed it
    IF NEW.completed_by IS NOT NULL AND NEW.completed_by != NEW.created_by THEN
      SELECT name INTO v_completer_name
      FROM users
      WHERE id = NEW.completed_by;

      PERFORM send_push_notification(
        NEW.created_by,
        'Task Completed',
        v_completer_name || ' completed: "' || NEW.title || '"',
        'todo_completed',
        jsonb_build_object(
          'todo_id', NEW.id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_todo_completed ON todos;
CREATE TRIGGER trigger_notify_todo_completed
  AFTER UPDATE ON todos
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_todo_completed();

-- =============================================
-- TRIGGER: Deliverable Status Changed
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_deliverable_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project RECORD;
  v_status_label TEXT;
BEGIN
  -- Only notify if status actually changed
  IF NEW.status != OLD.status THEN
    -- Get project info
    SELECT p.* INTO v_project
    FROM projects p
    WHERE p.id = NEW.project_id;

    -- Human readable status
    v_status_label := CASE NEW.status
      WHEN 'approved' THEN 'Approved ✓'
      WHEN 'review' THEN 'Ready for Review'
      WHEN 'final' THEN 'Finalized'
      WHEN 'draft' THEN 'Back to Draft'
      ELSE NEW.status
    END;

    -- Notify deliverable creator
    IF NEW.created_by IS NOT NULL THEN
      PERFORM send_push_notification(
        NEW.created_by,
        'Status Update',
        '"' || NEW.name || '" is now ' || v_status_label,
        'deliverable_status_changed',
        jsonb_build_object(
          'deliverable_id', NEW.id,
          'new_status', NEW.status,
          'old_status', OLD.status,
          'project_id', NEW.project_id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_deliverable_status ON deliverables;
CREATE TRIGGER trigger_notify_deliverable_status
  AFTER UPDATE ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_deliverable_status_change();

-- =============================================
-- TRIGGER: Mention in Comment (Basic @mention detection)
-- =============================================
CREATE OR REPLACE FUNCTION notify_on_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mentioned_user RECORD;
  v_commenter_name TEXT;
  v_deliverable_name TEXT;
  v_mention_pattern TEXT;
  v_deliverable_id UUID;
BEGIN
  -- Get commenter name
  SELECT name INTO v_commenter_name
  FROM users
  WHERE id = NEW.author_id;

  -- Get deliverable info
  SELECT d.name, d.id INTO v_deliverable_name, v_deliverable_id
  FROM versions v
  JOIN deliverables d ON d.id = v.deliverable_id
  WHERE v.id = NEW.version_id;

  -- Find @mentions in content (simple pattern: @username or @name)
  -- This looks for users whose name appears after @ in the comment
  FOR v_mentioned_user IN
    SELECT DISTINCT u.id, u.name
    FROM users u
    WHERE NEW.content ~* ('@' || regexp_replace(u.name, '\s+', '\\s+', 'g'))
    AND u.id != NEW.author_id
  LOOP
    PERFORM send_push_notification(
      v_mentioned_user.id,
      'You were mentioned',
      v_commenter_name || ' mentioned you in a comment on "' || v_deliverable_name || '"',
      'comment_mention',
      jsonb_build_object(
        'deliverable_id', v_deliverable_id,
        'comment_id', NEW.id
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_mention ON comments;
CREATE TRIGGER trigger_notify_mention
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_mention();

-- =============================================
-- SCHEDULED JOB: Due Date Reminders
-- Run this with pg_cron or a Supabase scheduled function
-- =============================================
CREATE OR REPLACE FUNCTION check_due_date_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_todo RECORD;
BEGIN
  -- Find todos due within 24 hours that haven't been reminded
  FOR v_todo IN
    SELECT t.*, u.name as assignee_name
    FROM todos t
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE t.status != 'completed'
    AND t.due_date IS NOT NULL
    AND t.due_date BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    AND t.assigned_to IS NOT NULL
    -- Add a flag to prevent duplicate reminders (optional: add reminded_at column)
  LOOP
    PERFORM send_push_notification(
      v_todo.assigned_to,
      'Task Due Soon',
      '"' || v_todo.title || '" is due in less than 24 hours',
      'todo_due_soon',
      jsonb_build_object(
        'todo_id', v_todo.id,
        'due_date', v_todo.due_date
      )
    );
  END LOOP;
END;
$$;

-- =============================================
-- GRANT PERMISSIONS
-- =============================================
-- Allow the functions to be called
GRANT EXECUTE ON FUNCTION send_push_notification TO authenticated;
GRANT EXECUTE ON FUNCTION send_push_notification TO service_role;

-- =============================================
-- CONFIGURATION
-- Set these in your Supabase project settings or via SQL
-- =============================================
-- ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SERVICE_ROLE_KEY';

-- =============================================
-- NOTES
-- =============================================
-- 1. Replace YOUR_PROJECT_REF with your actual Supabase project reference
-- 2. Set the service_role_key securely (don't commit to git!)
-- 3. To enable due date reminders, set up pg_cron:
--    SELECT cron.schedule('0 9 * * *', 'SELECT check_due_date_reminders()');
-- 4. Test by inserting a comment and checking the Edge Function logs












