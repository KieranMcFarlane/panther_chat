-- Voice Sessions Table
CREATE TABLE IF NOT EXISTS voice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'paused')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice Conversations Table
CREATE TABLE IF NOT EXISTS voice_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES voice_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  room_name TEXT NOT NULL,
  audio_url TEXT,
  transcript TEXT NOT NULL,
  speaker TEXT NOT NULL CHECK (speaker IN ('user', 'assistant')),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  claude_response TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Voice Analytics Table
CREATE TABLE IF NOT EXISTS voice_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES voice_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('session_duration', 'response_time', 'transcription_accuracy', 'user_satisfaction')),
  metric_value NUMERIC NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_sessions_user_id ON voice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_status ON voice_sessions(status);
CREATE INDEX IF NOT EXISTS idx_voice_sessions_start_time ON voice_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_session_id ON voice_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_user_id ON voice_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_conversations_timestamp ON voice_conversations(timestamp);
CREATE INDEX IF NOT EXISTS idx_voice_analytics_session_id ON voice_analytics(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_analytics_user_id ON voice_analytics(user_id);

-- Row Level Security (RLS)
ALTER TABLE voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own voice sessions" ON voice_sessions
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own voice sessions" ON voice_sessions
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own voice sessions" ON voice_sessions
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own voice sessions" ON voice_sessions
  FOR DELETE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can view own voice conversations" ON voice_conversations
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own voice conversations" ON voice_conversations
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can view own voice analytics" ON voice_analytics
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own voice analytics" ON voice_analytics
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updated_at
CREATE TRIGGER update_voice_sessions_updated_at 
  BEFORE UPDATE ON voice_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for voice session statistics
CREATE OR REPLACE VIEW voice_session_stats AS
SELECT 
  vs.user_id,
  COUNT(*) as total_sessions,
  AVG(EXTRACT(EPOCH FROM (vs.end_time - vs.start_time))/60) as avg_duration_minutes,
  COUNT(CASE WHEN vs.status = 'ended' THEN 1 END) as completed_sessions,
  COUNT(CASE WHEN vs.status = 'active' THEN 1 END) as active_sessions,
  MAX(vs.start_time) as last_session
FROM voice_sessions vs
GROUP BY vs.user_id;

-- View for conversation analytics
CREATE OR REPLACE VIEW voice_conversation_analytics AS
SELECT 
  vc.session_id,
  vc.user_id,
  COUNT(*) as total_turns,
  COUNT(CASE WHEN vc.speaker = 'user' THEN 1 END) as user_turns,
  COUNT(CASE WHEN vc.speaker = 'assistant' THEN 1 END) as assistant_turns,
  AVG(LENGTH(vc.transcript)) as avg_transcript_length,
  MIN(vc.timestamp) as conversation_start,
  MAX(vc.timestamp) as conversation_end
FROM voice_conversations vc
GROUP BY vc.session_id, vc.user_id;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON voice_sessions TO authenticated;
GRANT SELECT, INSERT ON voice_conversations TO authenticated;
GRANT SELECT, INSERT ON voice_analytics TO authenticated;
GRANT SELECT ON voice_session_stats TO authenticated;
GRANT SELECT ON voice_conversation_analytics TO authenticated;

-- Grant permissions to service role for backend operations
GRANT ALL ON voice_sessions TO service_role;
GRANT ALL ON voice_conversations TO service_role;
GRANT ALL ON voice_analytics TO service_role;