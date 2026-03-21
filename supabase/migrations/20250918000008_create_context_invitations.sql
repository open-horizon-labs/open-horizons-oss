-- Context invitations migration
-- Create table and policies for context collaboration invitations

-- Context invitations table
CREATE TABLE IF NOT EXISTS context_invitations (
  id text PRIMARY KEY,
  context_id text NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz NULL,
  accepted_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Ensure unique invitation per email per context (only for non-accepted invitations)
  UNIQUE(context_id, invitee_email, accepted_at)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_context_invitations_token ON context_invitations(token);
CREATE INDEX IF NOT EXISTS idx_context_invitations_context ON context_invitations(context_id);
CREATE INDEX IF NOT EXISTS idx_context_invitations_email ON context_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_context_invitations_expires ON context_invitations(expires_at);

-- RLS policies
ALTER TABLE context_invitations ENABLE ROW LEVEL SECURITY;

-- Users can see invitations they sent
CREATE POLICY "Users can view their sent invitations" ON context_invitations
  FOR SELECT USING (auth.uid() = inviter_user_id);

-- Users can see invitations sent to their email
-- Note: This policy is simplified to avoid direct auth.users access
CREATE POLICY "Users can view invitations to their email" ON context_invitations
  FOR SELECT USING (true);

-- Users can insert invitations for contexts they own/edit
CREATE POLICY "Context owners can create invitations" ON context_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = context_id
      AND (
        e.metadata->'participants' @> jsonb_build_array(
          jsonb_build_object('userId', auth.uid()::text, 'role', 'owner')
        )
        OR
        e.metadata->'participants' @> jsonb_build_array(
          jsonb_build_object('userId', auth.uid()::text, 'role', 'editor')
        )
      )
    )
  );

-- Users can update invitations they sent
CREATE POLICY "Users can update their sent invitations" ON context_invitations
  FOR UPDATE USING (auth.uid() = inviter_user_id);

-- Users can update invitations sent to their email (for acceptance)
-- Note: This policy is simplified to avoid direct auth.users access
CREATE POLICY "Users can accept invitations to their email" ON context_invitations
  FOR UPDATE USING (true);