-- Integrations migration
-- Create tables for external service integrations (Google Calendar, GitHub, etc.)

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
  internal_entity_id TEXT NOT NULL, -- endeavor ID or daily log reference
  link_type TEXT DEFAULT 'related' CHECK (link_type IN ('related', 'sync', 'mirror')),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(external_entity_id, internal_entity_type, internal_entity_id)
);

-- RLS policies
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_links ENABLE ROW LEVEL SECURITY;

-- Integration accounts policies
CREATE POLICY "Users can manage own integration accounts" ON integration_accounts
  FOR ALL USING (auth.uid() = user_id);

-- External entities policies
CREATE POLICY "Users can view own external entities" ON external_entities
  FOR ALL USING (
    integration_account_id IN (
      SELECT id FROM integration_accounts WHERE user_id = auth.uid()
    )
  );

-- Integration links policies
CREATE POLICY "Users can manage own integration links" ON integration_links
  FOR ALL USING (
    external_entity_id IN (
      SELECT ee.id FROM external_entities ee
      JOIN integration_accounts ia ON ee.integration_account_id = ia.id
      WHERE ia.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_integration_accounts_user_id ON integration_accounts(user_id);
CREATE INDEX idx_external_entities_account_id ON external_entities(integration_account_id);
CREATE INDEX idx_external_entities_type ON external_entities(entity_type);
CREATE INDEX idx_integration_links_external_id ON integration_links(external_entity_id);
CREATE INDEX idx_integration_links_internal ON integration_links(internal_entity_type, internal_entity_id);