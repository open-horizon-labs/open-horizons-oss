-- API Keys table for secure token management
CREATE TABLE IF NOT EXISTS api_keys (
  id text PRIMARY KEY DEFAULT ('ak_' || gen_random_uuid()::text),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL, -- First 8 chars for display (e.g., "ak_1234...")
  scopes text[] DEFAULT ARRAY['read'], -- Future: granular permissions
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NULL,
  expires_at timestamptz NULL, -- NULL = never expires
  revoked_at timestamptz NULL,
  revoked_reason text NULL,

  CONSTRAINT api_keys_name_user_unique UNIQUE(user_id, name),
  CONSTRAINT api_keys_name_length CHECK (char_length(name) > 0 AND char_length(name) <= 100)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used ON api_keys(last_used_at);

-- RLS policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own API keys
CREATE POLICY "Users can view their own API keys" ON api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" ON api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON api_keys
  FOR UPDATE USING (auth.uid() = user_id);

-- No DELETE policy - use revocation instead for audit trail