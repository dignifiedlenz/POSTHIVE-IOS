-- =============================================
-- PUSH NOTIFICATIONS BASE TABLES
-- Run this FIRST before push_notification_queue.sql
-- =============================================

-- =============================================
-- TABLE: user_push_tokens
-- Stores device tokens for push notifications
-- =============================================
CREATE TABLE IF NOT EXISTS user_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_id TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate tokens per user
  CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_active 
  ON user_push_tokens(user_id, active) 
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_push_tokens_token 
  ON user_push_tokens(token);

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can view own tokens" ON user_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON user_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON user_push_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON user_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on push_tokens" ON user_push_tokens
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TABLE: user_notification_preferences
-- Stores user preferences for different notification types
-- =============================================
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN DEFAULT true,
  push_uploads BOOLEAN DEFAULT true,
  push_comments BOOLEAN DEFAULT true,
  push_mentions BOOLEAN DEFAULT true,
  push_todos BOOLEAN DEFAULT true,
  push_deliverable_updates BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  email_digest_frequency TEXT DEFAULT 'daily' CHECK (email_digest_frequency IN ('instant', 'daily', 'weekly', 'never')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user 
  ON user_notification_preferences(user_id);

-- RLS Policies
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can view own preferences" ON user_notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" ON user_notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" ON user_notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Service role can do everything (needed for Edge Functions)
CREATE POLICY "Service role full access on notification_prefs" ON user_notification_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- GRANTS
-- =============================================
GRANT ALL ON user_push_tokens TO authenticated;
GRANT ALL ON user_push_tokens TO service_role;
GRANT ALL ON user_notification_preferences TO authenticated;
GRANT ALL ON user_notification_preferences TO service_role;

-- =============================================
-- TRIGGER: Auto-update updated_at timestamp
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON user_push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
  BEFORE UPDATE ON user_push_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_prefs_updated_at ON user_notification_preferences;
CREATE TRIGGER update_notification_prefs_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VERIFICATION
-- Run these queries to verify tables were created:
-- =============================================
-- SELECT * FROM user_push_tokens LIMIT 1;
-- SELECT * FROM user_notification_preferences LIMIT 1;





