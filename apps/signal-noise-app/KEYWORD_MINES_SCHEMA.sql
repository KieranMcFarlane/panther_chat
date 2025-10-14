-- ========================================
-- KEYWORD MINES AND MONITORING SYSTEM SCHEMA
-- ========================================

-- Keyword Mines Table
CREATE TABLE IF NOT EXISTS keyword_mines (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  sport TEXT,
  keywords TEXT[] NOT NULL,
  monitoring_sources JSONB NOT NULL,
  notification_channels JSONB NOT NULL,
  alert_threshold INTEGER NOT NULL DEFAULT 60,
  reasoning_context TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_triggered TIMESTAMP WITH TIME ZONE
);

-- Alert Detections Table
CREATE TABLE IF NOT EXISTS alert_detections (
  id TEXT PRIMARY KEY,
  mine_id TEXT NOT NULL REFERENCES keyword_mines(id),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  detection_type TEXT NOT NULL,
  keywords_matched TEXT[] NOT NULL,
  content_snippet TEXT NOT NULL,
  source_url TEXT NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reasoning_analysis JSONB NOT NULL,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notification_sent BOOLEAN DEFAULT FALSE,
  read BOOLEAN DEFAULT FALSE,
  archived BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE
);

-- Reasoning Tasks Table
CREATE TABLE IF NOT EXISTS reasoning_tasks (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('periodic_analysis', 'triggered_analysis', 'relationship_analysis', 'opportunity_scan')),
  priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  data JSONB NOT NULL,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT
);

-- Analysis Results Table
CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY DEFAULT generate_id(),
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  analysis_type TEXT NOT NULL,
  insights TEXT[] NOT NULL,
  opportunities JSONB NOT NULL,
  risks JSONB NOT NULL,
  recommendations JSONB NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  next_analysis TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reasoning Failures Table
CREATE TABLE IF NOT EXISTS reasoning_failures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  error_message TEXT NOT NULL,
  failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PWA Notifications Table
CREATE TABLE IF NOT EXISTS pwa_notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  icon TEXT,
  image TEXT,
  badge TEXT,
  tag TEXT,
  require_interaction BOOLEAN DEFAULT FALSE,
  actions JSONB,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  read BOOLEAN DEFAULT FALSE,
  user_id TEXT,
  entity_id TEXT,
  entity_name TEXT,
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'critical')),
  source_type TEXT,
  read_at TIMESTAMP WITH TIME ZONE
);

-- Notification Deliveries Table
CREATE TABLE IF NOT EXISTS notification_deliveries (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('pwa', 'teams', 'slack', 'email', 'webhook', 'sms')),
  recipient TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System Logs Table
CREATE TABLE IF NOT EXISTS system_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
  category TEXT NOT NULL CHECK (category IN ('system', 'mine', 'reasoning', 'notification', 'api', 'database', 'webhook')),
  source TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  message TEXT NOT NULL,
  data JSONB,
  metadata JSONB,
  tags TEXT[],
  correlation_id TEXT
);

-- Activity Feed Table
CREATE TABLE IF NOT EXISTS activity_feed (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('detection', 'analysis', 'notification', 'system_event')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  entity_id TEXT,
  entity_name TEXT,
  urgency TEXT DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  details JSONB NOT NULL,
  actions JSONB
);

-- System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cpu_usage NUMERIC CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
  memory_usage NUMERIC CHECK (memory_usage >= 0 AND memory_usage <= 100),
  active_mines INTEGER DEFAULT 0,
  queue_size INTEGER DEFAULT 0,
  processing_rate NUMERIC DEFAULT 0,
  error_rate NUMERIC DEFAULT 0,
  notification_rate NUMERIC DEFAULT 0,
  database_connections INTEGER DEFAULT 0,
  cache_hit_rate NUMERIC CHECK (cache_hit_rate >= 0 AND cache_hit_rate <= 100),
  response_time_p95 INTEGER DEFAULT 0
);

-- ========================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ========================================

-- Keyword Mines Indexes
CREATE INDEX IF NOT EXISTS idx_keyword_mines_entity_id ON keyword_mines(entity_id);
CREATE INDEX IF NOT EXISTS idx_keyword_mines_entity_type ON keyword_mines(entity_type);
CREATE INDEX IF NOT EXISTS idx_keyword_mines_sport ON keyword_mines(sport);
CREATE INDEX IF NOT EXISTS idx_keyword_mines_active ON keyword_mines(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_keyword_mines_last_triggered ON keyword_mines(last_triggered DESC);

-- Alert Detections Indexes
CREATE INDEX IF NOT EXISTS idx_alert_detections_mine_id ON alert_detections(mine_id);
CREATE INDEX IF NOT EXISTS idx_alert_detections_entity_id ON alert_detections(entity_id);
CREATE INDEX IF NOT EXISTS idx_alert_detections_detected_at ON alert_detections(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_detections_confidence ON alert_detections(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_alert_detections_unread ON alert_detections(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_alert_detections_unarchived ON alert_detections(archived) WHERE archived = FALSE;

-- Reasoning Tasks Indexes
CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_entity_id ON reasoning_tasks(entity_id);
CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_status ON reasoning_tasks(status);
CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_priority ON reasoning_tasks(priority DESC);
CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_scheduled ON reasoning_tasks(scheduled_at ASC);
CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_type ON reasoning_tasks(task_type);

-- Analysis Results Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_results_entity_id ON analysis_results(entity_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_type ON analysis_results(analysis_type);
CREATE INDEX IF NOT EXISTS idx_analysis_results_created ON analysis_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_results_confidence ON analysis_results(confidence_score DESC);

-- PWA Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_pwa_notifications_user_id ON pwa_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_pwa_notifications_entity_id ON pwa_notifications(entity_id);
CREATE INDEX IF NOT EXISTS idx_pwa_notifications_unread ON pwa_notifications(read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_pwa_notifications_timestamp ON pwa_notifications(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pwa_notifications_expires ON pwa_notifications(expires_at);

-- Notification Deliveries Indexes
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_sent_at ON notification_deliveries(sent_at DESC);

-- System Logs Indexes
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_category ON system_logs(category);
CREATE INDEX IF NOT EXISTS idx_system_logs_source ON system_logs(source);
CREATE INDEX IF NOT EXISTS idx_system_logs_entity_id ON system_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_tags ON system_logs USING GIN(tags);

-- Activity Feed Indexes
CREATE INDEX IF NOT EXISTS idx_activity_feed_timestamp ON activity_feed(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_type ON activity_feed(type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity_id ON activity_feed(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_urgency ON activity_feed(urgency);

-- System Metrics Indexes
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);

-- ========================================
-- TRIGGERS AND FUNCTIONS
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for keyword_mines table
CREATE TRIGGER update_keyword_mines_updated_at
    BEFORE UPDATE ON keyword_mines
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to cleanup old system logs
CREATE OR REPLACE FUNCTION cleanup_old_system_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM system_logs 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    DELETE FROM activity_feed 
    WHERE timestamp < NOW() - INTERVAL '7 days';
    
    DELETE FROM pwa_notifications 
    WHERE timestamp < NOW() - INTERVAL '30 days' AND read = TRUE;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- ROW LEVEL SECURITY (RLS)
-- ========================================

-- Enable RLS on tables with sensitive data
ALTER TABLE pwa_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_detections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for PWA Notifications
CREATE POLICY "Users can view their own notifications" ON pwa_notifications
    FOR SELECT USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own notifications" ON pwa_notifications
    FOR UPDATE USING (user_id IS NULL OR user_id = current_setting('app.current_user_id', true));

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- View for recent activity with entity details
CREATE OR REPLACE VIEW recent_activity_view AS
SELECT 
    af.*,
    km.entity_type,
    km.sport
FROM activity_feed af
LEFT JOIN keyword_mines km ON af.entity_id = km.entity_id
ORDER BY af.timestamp DESC;

-- View for detection statistics
CREATE OR REPLACE VIEW detection_stats_view AS
SELECT 
    DATE_TRUNC('day', detected_at) as detection_date,
    entity_type,
    COUNT(*) as total_detections,
    COUNT(*) FILTER (WHERE confidence_score >= 80) as high_confidence_detections,
    AVG(confidence_score) as avg_confidence_score
FROM alert_detections ad
LEFT JOIN keyword_mines km ON ad.entity_id = km.entity_id
WHERE detected_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', detected_at), km.entity_type
ORDER BY detection_date DESC;

-- View for system health dashboard
CREATE OR REPLACE VIEW system_health_view AS
SELECT 
    (SELECT COUNT(*) FROM keyword_mines WHERE is_active = true) as active_mines,
    (SELECT COUNT(*) FROM reasoning_tasks WHERE status = 'pending') as pending_tasks,
    (SELECT COUNT(*) FROM alert_detections WHERE detected_at >= NOW() - INTERVAL '24 hours') as detections_24h,
    (SELECT COUNT(*) FROM pwa_notifications WHERE read = false) as unread_notifications,
    (SELECT COUNT(*) FROM system_logs WHERE level = 'error' AND timestamp >= NOW() - INTERVAL '24 hours') as errors_24h,
    (SELECT AVG(confidence_score) FROM alert_detections WHERE detected_at >= NOW() - INTERVAL '24 hours') as avg_confidence_24h;

-- ========================================
-- SAMPLE DATA INSERTION (for development)
-- ========================================

-- Insert sample keyword mines (if table is empty)
INSERT INTO keyword_mines (id, entity_id, entity_name, entity_type, keywords, monitoring_sources, notification_channels, reasoning_context)
SELECT 
    'mine_' || gen_random_uuid(),
    'sample_entity_' || generate_series(1, 10),
    'Sample Entity ' || generate_series(1, 10),
    'Organization',
    ARRAY['digital transformation', 'partnership', 'technology', 'innovation'],
    jsonb_build_object('type', 'sample', 'frequency', 'hourly'),
    jsonb_build_object('type', 'pwa', 'enabled', true),
    'Sample reasoning context for testing purposes'
WHERE NOT EXISTS (SELECT 1 FROM keyword_mines LIMIT 1);