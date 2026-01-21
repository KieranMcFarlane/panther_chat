-- Email Version History for Compose Page
-- Tracks all changes to email content with persistent undo/redo functionality

-- Email threads table to track conversation threads
CREATE TABLE IF NOT EXISTS email_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT, -- Associate with user if available
  metadata JSONB DEFAULT '{}' -- Additional thread metadata
);

-- Email versions table to track content history
CREATE TABLE IF NOT EXISTS email_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES email_threads(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  subject TEXT,
  to_email TEXT,
  change_type TEXT NOT NULL CHECK (change_type IN ('initial', 'ai_suggestion', 'user_edit', 'diff_applied', 'manual_save')),
  change_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{} -- Additional version metadata like diffs, AI responses, etc.
);

-- Function to get or create thread
CREATE OR REPLACE FUNCTION get_or_create_email_thread(
  p_to_email TEXT,
  p_subject TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  -- Try to find existing thread (by email and subject)
  SELECT id INTO v_thread_id 
  FROM email_threads 
  WHERE to_email = p_to_email 
    AND (subject = p_subject OR (subject IS NULL AND p_subject IS NULL))
    AND (user_id = p_user_id OR (user_id IS NULL AND p_user_id IS NULL))
  ORDER BY updated_at DESC
  LIMIT 1;
  
  -- If no thread exists, create one
  IF v_thread_id IS NULL THEN
    INSERT INTO email_threads (to_email, subject, user_id, metadata)
    VALUES (p_to_email, p_subject, p_user_id, p_metadata)
    RETURNING id INTO v_thread_id;
  END IF;
  
  RETURN v_thread_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create new version
CREATE OR REPLACE FUNCTION create_email_version(
  p_thread_id UUID,
  p_content TEXT,
  p_subject TEXT DEFAULT NULL,
  p_to_email TEXT DEFAULT NULL,
  p_change_type TEXT DEFAULT 'user_edit',
  p_change_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  -- Get next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 
  INTO v_version_number
  FROM email_versions 
  WHERE thread_id = p_thread_id;
  
  -- Create new version
  INSERT INTO email_versions (
    thread_id, version_number, content, subject, to_email, 
    change_type, change_description, metadata
  )
  VALUES (
    p_thread_id, v_version_number, p_content, p_subject, p_to_email,
    p_change_type, p_change_description, p_metadata
  )
  RETURNING id INTO v_version_id;
  
  -- Update thread's updated_at
  UPDATE email_threads 
  SET updated_at = NOW() 
  WHERE id = p_thread_id;
  
  RETURN v_version_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get version history
CREATE OR REPLACE FUNCTION get_email_version_history(
  p_thread_id UUID,
  p_limit INTEGER DEFAULT 50
) RETURNS TABLE (
  id UUID,
  version_number INTEGER,
  content TEXT,
  subject TEXT,
  to_email TEXT,
  change_type TEXT,
  change_description TEXT,
  created_at TIMESTAMPTZ,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ev.id,
    ev.version_number,
    ev.content,
    ev.subject,
    ev.to_email,
    ev.change_type,
    ev.change_description,
    ev.created_at,
    ev.metadata
  FROM email_versions ev
  WHERE ev.thread_id = p_thread_id
  ORDER BY ev.version_number DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to restore email to specific version
CREATE OR REPLACE FUNCTION restore_email_version(
  p_thread_id UUID,
  p_version_number INTEGER
) RETURNS TABLE (
  id UUID,
  content TEXT,
  subject TEXT,
  to_email TEXT
) AS $$
DECLARE
  v_restored_version_id UUID;
BEGIN
  -- Get the version to restore
  SELECT id INTO v_restored_version_id
  FROM email_versions
  WHERE thread_id = p_thread_id AND version_number = p_version_number;
  
  IF v_restored_version_id IS NULL THEN
    RAISE EXCEPTION 'Version % not found for thread %', p_version_number, p_thread_id;
  END IF;
  
  -- Create a new version with the restored content
  INSERT INTO email_versions (
    thread_id, version_number, content, subject, to_email,
    change_type, change_description, metadata
  )
  SELECT 
    thread_id,
    (SELECT COALESCE(MAX(version_number), 0) + 1 FROM email_versions WHERE thread_id = p_thread_id),
    content,
    subject,
    to_email,
    'restore',
    format('Restored to version %s', p_version_number),
    jsonb_build_object('restored_from_version', p_version_number)
  FROM email_versions
  WHERE id = v_restored_version_id
  RETURNING id, content, subject, to_email;
END;
$$ LANGUAGE plpgsql;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_threads_to_email ON email_threads(to_email);
CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_updated_at ON email_threads(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_versions_thread_id ON email_versions(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_versions_thread_version ON email_versions(thread_id, version_number);

-- RLS (Row Level Security) policies
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_versions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own threads (if user_id is set)
CREATE POLICY "Users can view own email threads" ON email_threads
  FOR SELECT USING (user_id IS NULL OR user_id = auth.uid()::text);

-- Policy: Users can insert threads
CREATE POLICY "Users can insert email threads" ON email_threads
  FOR INSERT WITH CHECK (user_id IS NULL OR user_id = auth.uid()::text);

-- Policy: Users can update own threads
CREATE POLICY "Users can update own email threads" ON email_threads
  FOR UPDATE USING (user_id IS NULL OR user_id = auth.uid()::text);

-- Policy: Users can view versions for their threads
CREATE POLICY "Users can view email versions" ON email_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM email_threads et 
      WHERE et.id = thread_id 
      AND (et.user_id IS NULL OR et.user_id = auth.uid()::text)
    )
  );

-- Policy: Users can insert versions for their threads
CREATE POLICY "Users can insert email versions" ON email_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM email_threads et 
      WHERE et.id = thread_id 
      AND (et.user_id IS NULL OR et.user_id = auth.uid()::text)
    )
  );