-- =============================================
-- PUSH NOTIFICATION QUEUE SYSTEM
-- Simpler approach: Queue notifications, process with Edge Function
-- =============================================

-- Queue table for pending push notifications
CREATE TABLE IF NOT EXISTS push_notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  notification_type TEXT,
  data JSONB DEFAULT '{}'::JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT valid_user CHECK (user_id IS NOT NULL)
);

-- Index for processing pending notifications
CREATE INDEX IF NOT EXISTS idx_push_queue_pending 
  ON push_notification_queue(status, created_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_push_queue_user 
  ON push_notification_queue(user_id);

-- RLS: Only service role can access
ALTER TABLE push_notification_queue ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
DROP POLICY IF EXISTS "Service role full access" ON push_notification_queue;
CREATE POLICY "Service role full access" ON push_notification_queue
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- HELPER: Queue a push notification
-- =============================================
CREATE OR REPLACE FUNCTION queue_push_notification(
  p_user_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_notification_type TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO push_notification_queue (user_id, title, body, notification_type, data)
  VALUES (p_user_id, p_title, p_body, p_notification_type, p_data)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- =============================================
-- TRIGGER: New Comment → Queue Push
-- =============================================
CREATE OR REPLACE FUNCTION queue_push_on_new_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deliverable RECORD;
  v_version RECORD;
  v_commenter_name TEXT;
  v_parent_author_id UUID;
  v_comment_preview TEXT;
  v_timecode TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Get version and deliverable info
  SELECT v.*, d.name as deliverable_name, d.project_id, d.workspace_id, d.created_by as deliverable_owner
  INTO v_version
  FROM versions v
  JOIN deliverables d ON d.id = v.deliverable_id
  WHERE v.id = NEW.version_id;

  -- Skip if we couldn't find the deliverable
  IF v_version IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get commenter name
  IF COALESCE(NEW.is_client_comment, false) = true OR NEW.author_id IS NULL THEN
    v_commenter_name := COALESCE(NULLIF(NEW.client_name, ''), NULLIF(NEW.client_email, ''), 'Client');
  ELSE
    SELECT COALESCE(name, email, 'Someone') INTO v_commenter_name
    FROM users
    WHERE id = NEW.author_id;
  END IF;

  -- Build a safe preview for notifications
  v_comment_preview := btrim(regexp_replace(COALESCE(NEW.content, ''), '\s+', ' ', 'g'));
  IF length(v_comment_preview) > 120 THEN
    v_comment_preview := left(v_comment_preview, 120) || '…';
  END IF;

  -- Build a simple timecode label from start_time/end_time if present (MM:SS or MM:SS–MM:SS)
  v_timecode := NULL;
  IF NEW.start_time IS NOT NULL THEN
    v_timecode :=
      lpad(floor(NEW.start_time / 60)::text, 2, '0') || ':' ||
      lpad(floor(mod(NEW.start_time, 60))::text, 2, '0');

    IF NEW.end_time IS NOT NULL AND NEW.end_time > NEW.start_time THEN
      v_timecode := v_timecode || '–' ||
        lpad(floor(NEW.end_time / 60)::text, 2, '0') || ':' ||
        lpad(floor(mod(NEW.end_time, 60))::text, 2, '0');
    END IF;
  END IF;

  v_title := v_commenter_name || ' commented on ' || v_version.deliverable_name;
  v_body := (CASE WHEN v_timecode IS NOT NULL THEN v_timecode || ' ' ELSE '' END) ||
            (CASE WHEN v_comment_preview <> '' THEN v_comment_preview ELSE 'Sent a comment' END);

  -- 1. Notify deliverable owner (if not the commenter)
  IF v_version.deliverable_owner IS NOT NULL 
     AND v_version.deliverable_owner IS DISTINCT FROM NEW.author_id THEN
    -- Also write to in-app inbox (mobile Notifications Center), if available.
    -- Dedupe by (user_id, comment_id) to avoid double inserts when app code also creates notifications.
    IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'create_user_notification') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_notifications un
        WHERE un.user_id = v_version.deliverable_owner
          AND un.comment_id = NEW.id
      ) THEN
        PERFORM public.create_user_notification(
          v_version.deliverable_owner,
          v_version.workspace_id,
          'comment_added',
          v_title,
          v_body,
          jsonb_build_object(
            'actor_name', v_commenter_name,
            'deliverable_id', v_version.deliverable_id,
            'deliverable_name', v_version.deliverable_name,
            'project_id', v_version.project_id,
            'comment_id', NEW.id,
            'version_id', NEW.version_id,
            'version_number', v_version.version_number,
            'comment_preview', v_comment_preview,
            'comment_timecode', v_timecode,
            'start_time', NEW.start_time,
            'end_time', NEW.end_time,
            'is_client_comment', COALESCE(NEW.is_client_comment, false),
            'client_name', NEW.client_name,
            'client_email', NEW.client_email
          ),
          v_version.project_id,
          v_version.deliverable_id,
          NEW.version_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NEW.author_id
        );
      END IF;
    END IF;

    PERFORM queue_push_notification(
      v_version.deliverable_owner,
      v_title,
      v_body,
      'comment_added',
      jsonb_build_object(
        'actor_name', v_commenter_name,
        'deliverable_id', v_version.deliverable_id,
        'deliverable_name', v_version.deliverable_name,
        'project_id', v_version.project_id,
        'workspace_id', v_version.workspace_id,
        'comment_id', NEW.id,
        'version_id', NEW.version_id,
        'version_number', v_version.version_number,
        'comment_preview', v_comment_preview,
        'comment_timecode', v_timecode,
        'start_time', NEW.start_time,
        'end_time', NEW.end_time
      )
    );
  END IF;

  -- 2. If reply, notify parent comment author
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO v_parent_author_id
    FROM comments
    WHERE id = NEW.parent_id
    AND author_id IS DISTINCT FROM NEW.author_id;

    IF v_parent_author_id IS NOT NULL THEN
      v_title := v_commenter_name || ' replied on "' || v_version.deliverable_name || '"';

      -- Also write to in-app inbox, if available, with dedupe.
      IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'create_user_notification') THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.user_notifications un
          WHERE un.user_id = v_parent_author_id
            AND un.comment_id = NEW.id
        ) THEN
          PERFORM public.create_user_notification(
            v_parent_author_id,
            v_version.workspace_id,
            'comment_reply',
            v_title,
            v_body,
            jsonb_build_object(
              'actor_name', v_commenter_name,
              'deliverable_id', v_version.deliverable_id,
              'deliverable_name', v_version.deliverable_name,
              'project_id', v_version.project_id,
              'comment_id', NEW.id,
              'parent_id', NEW.parent_id,
              'version_id', NEW.version_id,
              'version_number', v_version.version_number,
              'comment_preview', v_comment_preview,
              'comment_timecode', v_timecode,
              'start_time', NEW.start_time,
              'end_time', NEW.end_time
            ),
            v_version.project_id,
            v_version.deliverable_id,
            NEW.version_id,
            NEW.id,
            NULL,
            NULL,
            NULL,
            NEW.author_id
          );
        END IF;
      END IF;

      PERFORM queue_push_notification(
        v_parent_author_id,
        v_title,
        v_body,
        'comment_reply',
        jsonb_build_object(
          'actor_name', v_commenter_name,
          'deliverable_id', v_version.deliverable_id,
          'deliverable_name', v_version.deliverable_name,
          'project_id', v_version.project_id,
          'workspace_id', v_version.workspace_id,
          'comment_id', NEW.id,
          'parent_id', NEW.parent_id,
          'version_id', NEW.version_id,
          'version_number', v_version.version_number,
          'comment_preview', v_comment_preview,
          'comment_timecode', v_timecode,
          'start_time', NEW.start_time,
          'end_time', NEW.end_time
        )
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the comment insert if notification fails
  RAISE NOTICE 'Push queue error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_push_comment ON comments;
CREATE TRIGGER trigger_queue_push_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_on_new_comment();

-- =============================================
-- TRIGGER: New Version → Queue Push
-- =============================================
CREATE OR REPLACE FUNCTION queue_push_on_new_version()
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
  SELECT d.*, p.name as project_name, d.workspace_id
  INTO v_deliverable
  FROM deliverables d
  LEFT JOIN projects p ON p.id = d.project_id
  WHERE d.id = NEW.deliverable_id;

  IF v_deliverable IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get uploader name
  SELECT COALESCE(name, email, 'Someone') INTO v_uploader_name
  FROM users
  WHERE id = NEW.uploaded_by;

  -- Notify workspace members (except uploader)
  FOR v_team_member IN
    SELECT DISTINCT wm.user_id
    FROM workspace_members wm
    WHERE wm.workspace_id = v_deliverable.workspace_id
    AND wm.user_id != NEW.uploaded_by
    LIMIT 50  -- Prevent too many notifications
  LOOP
    -- Also write to in-app inbox (mobile Notifications Center), if available, with dedupe by (user_id, version_id).
    IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'create_user_notification') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_notifications un
        WHERE un.user_id = v_team_member.user_id
          AND un.version_id = NEW.id
          AND un.type = 'version_uploaded'
      ) THEN
        PERFORM public.create_user_notification(
          v_team_member.user_id,
          v_deliverable.workspace_id,
          'version_uploaded',
          'New Upload',
          v_uploader_name || ' uploaded v' || NEW.version_number || ' of "' || v_deliverable.name || '"',
          jsonb_build_object(
            'actor_name', v_uploader_name,
            'deliverable_id', NEW.deliverable_id,
            'deliverable_name', v_deliverable.name,
            'project_id', v_deliverable.project_id,
            'project_name', v_deliverable.project_name,
            'version_id', NEW.id,
            'version_number', NEW.version_number
          ),
          v_deliverable.project_id,
          NEW.deliverable_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL,
          NEW.uploaded_by
        );
      END IF;
    END IF;

    PERFORM queue_push_notification(
      v_team_member.user_id,
      'New Upload',
      v_uploader_name || ' uploaded v' || NEW.version_number || ' of "' || v_deliverable.name || '"',
      'version_uploaded',
      jsonb_build_object(
        'deliverable_id', NEW.deliverable_id,
        'version_number', NEW.version_number,
        'project_id', v_deliverable.project_id,
        'workspace_id', v_deliverable.workspace_id
      )
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Push queue error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_push_version ON versions;
CREATE TRIGGER trigger_queue_push_version
  AFTER INSERT ON versions
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_on_new_version();

-- =============================================
-- TRIGGER: Todo Assigned → Queue Push
-- =============================================
CREATE OR REPLACE FUNCTION queue_push_on_todo_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigner_name TEXT;
BEGIN
  -- Only if assigned_to is set/changed and not self-assigned
  IF NEW.assigned_to IS NOT NULL 
    AND NEW.assigned_to != NEW.created_by
    AND (OLD IS NULL OR OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)
  THEN
    SELECT COALESCE(name, email, 'Someone') INTO v_assigner_name
    FROM users
    WHERE id = NEW.created_by;

    -- Create in-app notification (mobile Notifications Center), if available, with dedupe.
    IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'create_user_notification') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_notifications un
        WHERE un.user_id = NEW.assigned_to
          AND un.todo_id = NEW.id
          AND un.type = 'todo_assigned'
      ) THEN
        PERFORM public.create_user_notification(
          NEW.assigned_to,
          NEW.workspace_id,
          'todo_assigned',
          'Task Assigned',
          v_assigner_name || ' assigned you: "' || LEFT(NEW.title, 50) || '"',
          jsonb_build_object(
            'todo_id', NEW.id,
            'project_id', NEW.project_id,
            'due_date', NEW.due_date,
            'assigner_name', v_assigner_name
          ),
          NEW.project_id,
          NEW.deliverable_id,
          NULL,
          NULL,
          NEW.id,
          NULL,
          NULL,
          NEW.created_by
        );
      END IF;
    END IF;

    PERFORM queue_push_notification(
      NEW.assigned_to,
      'Task Assigned',
      v_assigner_name || ' assigned you: "' || LEFT(NEW.title, 50) || '"',
      'todo_assigned',
      jsonb_build_object(
        'todo_id', NEW.id,
        'project_id', NEW.project_id,
        'due_date', NEW.due_date
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Push queue error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_push_todo_assigned ON todos;
CREATE TRIGGER trigger_queue_push_todo_assigned
  AFTER INSERT OR UPDATE OF assigned_to ON todos
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_on_todo_assigned();

-- =============================================
-- TRIGGER: Deliverable Status Changed → Queue Push
-- =============================================
CREATE OR REPLACE FUNCTION queue_push_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status_label TEXT;
BEGIN
  IF NEW.status != OLD.status AND NEW.created_by IS NOT NULL THEN
    v_status_label := CASE NEW.status
      WHEN 'approved' THEN 'approved ✓'
      WHEN 'review' THEN 'ready for review'
      WHEN 'final' THEN 'finalized'
      WHEN 'draft' THEN 'moved back to draft'
      ELSE NEW.status
    END;

    -- Create in-app notification (mobile Notifications Center), if available, with dedupe.
    IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'create_user_notification') THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.user_notifications un
        WHERE un.user_id = NEW.created_by
          AND un.deliverable_id = NEW.id
          AND un.type = 'deliverable_status_changed'
          AND un.data->>'new_status' = NEW.status
      ) THEN
        PERFORM public.create_user_notification(
          NEW.created_by,
          NEW.workspace_id,
          'deliverable_status_changed',
          'Status Updated',
          '"' || LEFT(NEW.name, 40) || '" is now ' || v_status_label,
          jsonb_build_object(
            'deliverable_id', NEW.id,
            'new_status', NEW.status,
            'old_status', OLD.status
          ),
          NEW.project_id,
          NEW.id,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          NULL
        );
      END IF;
    END IF;

    PERFORM queue_push_notification(
      NEW.created_by,
      'Status Updated',
      '"' || LEFT(NEW.name, 40) || '" is now ' || v_status_label,
      'deliverable_status_changed',
      jsonb_build_object(
        'deliverable_id', NEW.id,
        'new_status', NEW.status,
        'old_status', OLD.status
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Push queue error: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_queue_push_status ON deliverables;
CREATE TRIGGER trigger_queue_push_status
  AFTER UPDATE OF status ON deliverables
  FOR EACH ROW
  EXECUTE FUNCTION queue_push_on_status_change();

-- =============================================
-- GRANTS
-- =============================================
GRANT EXECUTE ON FUNCTION queue_push_notification TO authenticated;
GRANT EXECUTE ON FUNCTION queue_push_notification TO service_role;
GRANT ALL ON push_notification_queue TO service_role;












