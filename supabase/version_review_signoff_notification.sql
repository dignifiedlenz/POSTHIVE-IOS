-- =============================================
-- VERSION REVIEW SIGN-OFF NOTIFICATION (UPLOADER)
-- Ensures "done reviewing" (rpc: sign_off_version) creates a notification for the uploader.
-- Run in Supabase SQL editor (prod + staging as needed).
-- =============================================

CREATE OR REPLACE FUNCTION public.sign_off_version(
  p_version_id UUID,
  p_user_id UUID
) RETURNS VOID AS $$
DECLARE
  v_uploader_id UUID;
  v_workspace_id UUID;
  v_project_id UUID;
  v_deliverable_id UUID;
  v_deliverable_name TEXT;
  v_version_number INTEGER;
  v_reviewer_name TEXT;
  v_version_display TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  -- Mark sign-off timestamp (idempotent: only sets if missing)
  INSERT INTO public.version_review_states (version_id, user_id, signed_off_at)
  VALUES (p_version_id, p_user_id, NOW())
  ON CONFLICT (version_id, user_id)
  DO UPDATE SET signed_off_at = NOW()
  WHERE version_review_states.signed_off_at IS NULL;

  -- Get version + deliverable + project + uploader + reviewer name
  SELECT
    v.uploaded_by,
    v.deliverable_id,
    v.version_number,
    d.project_id,
    p.workspace_id,
    d.name,
    COALESCE(u.name, u.email, 'Someone')
  INTO
    v_uploader_id,
    v_deliverable_id,
    v_version_number,
    v_project_id,
    v_workspace_id,
    v_deliverable_name,
    v_reviewer_name
  FROM public.versions v
  JOIN public.deliverables d ON d.id = v.deliverable_id
  JOIN public.projects p ON p.id = d.project_id
  LEFT JOIN public.users u ON u.id = p_user_id
  WHERE v.id = p_version_id;

  -- Only notify uploader (and never notify the reviewer about themselves)
  IF v_uploader_id IS NULL OR v_uploader_id = p_user_id THEN
    RETURN;
  END IF;

  -- Format version display (handle FINAL as 100)
  IF v_version_number = 100 THEN
    v_version_display := 'FINAL';
  ELSE
    v_version_display := 'V' || v_version_number::TEXT;
  END IF;

  v_title := v_reviewer_name || ' finished reviewing "' || COALESCE(v_deliverable_name, 'deliverable') || '"';
  v_message := 'Review complete for ' || v_version_display;

  -- Create in-app notification row
  PERFORM public.create_user_notification(
    v_uploader_id,
    v_workspace_id,
    'version_signed_off',
    v_title,
    v_message,
    jsonb_build_object(
      'version_id', p_version_id,
      'reviewer_id', p_user_id,
      'deliverable_name', v_deliverable_name,
      'version_number', v_version_number
    ),
    v_project_id,
    v_deliverable_id,
    p_version_id,
    NULL,
    NULL,
    NULL,
    NULL,
    p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Allow authenticated users to call it (matches existing API usage)
GRANT EXECUTE ON FUNCTION public.sign_off_version(UUID, UUID) TO authenticated;



