-- Integration accounts (one per user per service)
CREATE TABLE integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL, -- 'google_calendar', 'github', 'linear', etc.
  external_account_id TEXT NOT NULL, -- service-specific user ID
  access_token_encrypted TEXT, -- encrypted OAuth token (handled by Pipedream)
  refresh_token_encrypted TEXT, -- encrypted refresh token
  account_info JSONB, -- name, email, avatar, etc.
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  pipedream_connection_id TEXT, -- Pipedream Link connection ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, service_name)
);

-- External entities (calendar events, GitHub issues, etc.)
CREATE TABLE external_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL, -- service-specific entity ID
  entity_type TEXT NOT NULL, -- 'calendar_event', 'github_issue', 'linear_issue', etc.
  title TEXT,
  data JSONB NOT NULL, -- full entity data from external service
  start_time TIMESTAMPTZ, -- for events/tasks with timing
  end_time TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(integration_account_id, external_id, entity_type)
);

-- Link external entities to internal endeavors/logs
CREATE TABLE integration_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_entity_id UUID NOT NULL REFERENCES external_entities(id) ON DELETE CASCADE,
  internal_entity_type TEXT NOT NULL CHECK (internal_entity_type IN ('endeavor', 'daily_log')),
  internal_entity_id UUID NOT NULL,
  link_type TEXT NOT NULL CHECK (link_type IN ('spawned_from', 'subscribed_to', 'context_for')),
  created_by_user BOOLEAN DEFAULT true, -- vs. auto-created
  metadata JSONB, -- additional link-specific data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync logs for audit trail and debugging
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_account_id UUID NOT NULL REFERENCES integration_accounts(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'full_sync', 'incremental', 'webhook', 'manual'
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'partial')),
  entities_processed INTEGER DEFAULT 0,
  entities_created INTEGER DEFAULT 0,
  entities_updated INTEGER DEFAULT 0,
  entities_deleted INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB, -- timing, source info, etc.
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Create indexes for common queries
CREATE INDEX idx_integration_accounts_user_service ON integration_accounts(user_id, service_name);
CREATE INDEX idx_integration_accounts_status ON integration_accounts(status) WHERE status != 'active';

CREATE INDEX idx_external_entities_account_type ON external_entities(integration_account_id, entity_type);
CREATE INDEX idx_external_entities_timing ON external_entities(start_time, end_time) WHERE start_time IS NOT NULL;
CREATE INDEX idx_external_entities_sync_time ON external_entities(last_synced_at);

CREATE INDEX idx_integration_links_internal ON integration_links(internal_entity_type, internal_entity_id);
CREATE INDEX idx_integration_links_external ON integration_links(external_entity_id);

CREATE INDEX idx_sync_logs_account_status ON integration_sync_logs(integration_account_id, status);
CREATE INDEX idx_sync_logs_timing ON integration_sync_logs(started_at, completed_at);

-- Row Level Security (RLS) policies
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- Users can only access their own integration data
CREATE POLICY "Users can manage their own integration accounts" ON integration_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can access external entities through their accounts" ON external_entities
  FOR ALL USING (
    integration_account_id IN (
      SELECT id FROM integration_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own integration links" ON integration_links
  FOR ALL USING (
    external_entity_id IN (
      SELECT ee.id FROM external_entities ee
      JOIN integration_accounts ia ON ee.integration_account_id = ia.id
      WHERE ia.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own sync logs" ON integration_sync_logs
  FOR SELECT USING (
    integration_account_id IN (
      SELECT id FROM integration_accounts WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sync logs for their own accounts" ON integration_sync_logs
  FOR INSERT WITH CHECK (
    integration_account_id IN (
      SELECT id FROM integration_accounts WHERE user_id = auth.uid()
    )
  );

-- Grant necessary permissions
GRANT ALL ON integration_accounts TO authenticated;
GRANT ALL ON external_entities TO authenticated;
GRANT ALL ON integration_links TO authenticated;
GRANT SELECT, INSERT ON integration_sync_logs TO authenticated;

-- Functions for common operations

-- Get external context for a specific date (for daily logs)
CREATE OR REPLACE FUNCTION get_external_context_for_date(
  target_user_id UUID,
  target_date DATE
)
RETURNS TABLE (
  service_name TEXT,
  entity_type TEXT,
  title TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  data JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ia.service_name,
    ee.entity_type,
    ee.title,
    ee.start_time,
    ee.end_time,
    ee.data
  FROM external_entities ee
  JOIN integration_accounts ia ON ee.integration_account_id = ia.id
  WHERE ia.user_id = target_user_id
    AND ia.status = 'active'
    AND (
      ee.start_time::date = target_date
      OR ee.end_time::date = target_date
      OR (ee.start_time::date <= target_date AND ee.end_time::date >= target_date)
    )
  ORDER BY COALESCE(ee.start_time, ee.created_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update entity last synced timestamp
CREATE OR REPLACE FUNCTION update_entity_sync_timestamp(
  entity_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE external_entities
  SET last_synced_at = NOW(), updated_at = NOW()
  WHERE id = entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up old sync logs (keep last 100 per account)
CREATE OR REPLACE FUNCTION cleanup_old_sync_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  WITH logs_to_delete AS (
    SELECT id FROM (
      SELECT id,
             ROW_NUMBER() OVER (PARTITION BY integration_account_id ORDER BY started_at DESC) as rn
      FROM integration_sync_logs
    ) ranked
    WHERE rn > 100
  )
  DELETE FROM integration_sync_logs
  WHERE id IN (SELECT id FROM logs_to_delete);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE integration_accounts IS 'Stores OAuth connections for external services via Pipedream Link';
COMMENT ON TABLE external_entities IS 'Cached external data (calendar events, issues, etc.) from integrated services';
COMMENT ON TABLE integration_links IS 'Links external entities to internal Open Horizons entities';
COMMENT ON TABLE integration_sync_logs IS 'Audit trail for synchronization operations';

COMMENT ON FUNCTION get_external_context_for_date IS 'Returns external entities relevant to a specific date for daily log context';
COMMENT ON FUNCTION update_entity_sync_timestamp IS 'Updates the last synced timestamp for an external entity';
COMMENT ON FUNCTION cleanup_old_sync_logs IS 'Removes old sync logs, keeping the most recent 100 per account';