-- Phase 1a: Access Control Foundation
-- Create the core access control system that enables graph collaboration

-- 1. Endeavor Access Control Table
-- This replaces the ownership-only model with declarative access grants
CREATE TABLE IF NOT EXISTS endeavor_access (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endeavor_id text NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type text NOT NULL CHECK (access_type IN ('owner', 'editor', 'viewer')),
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_via text NOT NULL, -- 'direct', 'context:{id}', 'invitation:{token}'
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz, -- Optional expiration
  revoked_at timestamptz, -- Soft delete

  -- Prevent duplicate grants
  UNIQUE(endeavor_id, user_id, access_type, granted_via)
);

-- 2. Contexts Table
-- Clean separation from endeavors table
CREATE TABLE IF NOT EXISTS contexts (
  id text PRIMARY KEY, -- context:{user}:{timestamp}
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  root_endeavor_ids text[] NOT NULL DEFAULT '{}', -- Entry points into subgraph
  traversal_rules jsonb NOT NULL DEFAULT '{"max_depth": 10, "follow_relationships": ["supports", "refines"]}'::jsonb,
  ui_config jsonb NOT NULL DEFAULT '{}'::jsonb, -- Type mappings, labels, etc
  created_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

-- 3. Context Memberships Table
-- Who has access to which contexts
CREATE TABLE IF NOT EXISTS context_memberships (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  context_id text NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitation_token text, -- Reference to invitation

  -- One membership per user per context
  UNIQUE(context_id, user_id)
);

-- 4. Update Context Invitations (keep denormalized data + add revocation)
-- Keep the denormalized columns but ensure they exist
ALTER TABLE context_invitations
ADD COLUMN IF NOT EXISTS context_title text,
ADD COLUMN IF NOT EXISTS context_description text,
ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id);

-- Update to reference new contexts table
ALTER TABLE context_invitations
DROP CONSTRAINT IF EXISTS context_invitations_context_id_fkey;

ALTER TABLE context_invitations
ADD CONSTRAINT context_invitations_context_id_fkey
FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE;

-- Add index for revocation queries
CREATE INDEX IF NOT EXISTS idx_context_invitations_active
ON context_invitations(context_id, invitee_email)
WHERE accepted_at IS NULL AND revoked_at IS NULL;

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_endeavor_access_user_id ON endeavor_access(user_id);
CREATE INDEX IF NOT EXISTS idx_endeavor_access_endeavor_id ON endeavor_access(endeavor_id);
CREATE INDEX IF NOT EXISTS idx_endeavor_access_active ON endeavor_access(user_id, endeavor_id)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_contexts_created_by ON contexts(created_by);
CREATE INDEX IF NOT EXISTS idx_contexts_active ON contexts(created_by) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_context_memberships_user_id ON context_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_context_memberships_context_id ON context_memberships(context_id);

-- 6. Core Access Control Functions

-- Get all endeavors a user can access
CREATE OR REPLACE FUNCTION get_accessible_endeavors(p_user_id uuid)
RETURNS TABLE(endeavor_id text, access_type text, granted_via text)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ea.endeavor_id,
    ea.access_type,
    ea.granted_via
  FROM endeavor_access ea
  WHERE ea.user_id = p_user_id
    AND ea.revoked_at IS NULL
    AND (ea.expires_at IS NULL OR ea.expires_at > now())
  ORDER BY ea.endeavor_id, ea.access_type DESC; -- owner > editor > viewer
END;
$$ LANGUAGE plpgsql;

-- Check if user has specific access to an endeavor
CREATE OR REPLACE FUNCTION has_endeavor_access(
  p_user_id uuid,
  p_endeavor_id text,
  p_required_access text DEFAULT 'viewer'
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  access_hierarchy text[] := ARRAY['owner', 'editor', 'viewer'];
  user_access text;
  required_level int;
  user_level int;
BEGIN
  -- Get user's highest access level
  SELECT ea.access_type INTO user_access
  FROM endeavor_access ea
  WHERE ea.user_id = p_user_id
    AND ea.endeavor_id = p_endeavor_id
    AND ea.revoked_at IS NULL
    AND (ea.expires_at IS NULL OR ea.expires_at > now())
  ORDER BY
    CASE ea.access_type
      WHEN 'owner' THEN 1
      WHEN 'editor' THEN 2
      WHEN 'viewer' THEN 3
    END
  LIMIT 1;

  -- Return false if no access
  IF user_access IS NULL THEN
    RETURN false;
  END IF;

  -- Get hierarchy positions
  SELECT array_position(access_hierarchy, p_required_access) INTO required_level;
  SELECT array_position(access_hierarchy, user_access) INTO user_level;

  -- User level must be <= required level (lower number = higher access)
  RETURN user_level <= required_level;
END;
$$ LANGUAGE plpgsql;

-- Get user's accessible contexts
CREATE OR REPLACE FUNCTION get_user_contexts(p_user_id uuid)
RETURNS TABLE(
  context_id text,
  title text,
  description text,
  role text,
  created_by uuid,
  created_at timestamptz
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.description,
    cm.role,
    c.created_by,
    c.created_at
  FROM contexts c
  JOIN context_memberships cm ON cm.context_id = c.id
  WHERE cm.user_id = p_user_id
    AND c.archived_at IS NULL
  ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Policies for new tables

-- Endeavor Access RLS
ALTER TABLE endeavor_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own access grants" ON endeavor_access
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view access grants they made" ON endeavor_access
  FOR SELECT USING (auth.uid() = granted_by);

CREATE POLICY "Users can grant access to endeavors they own" ON endeavor_access
  FOR INSERT WITH CHECK (
    auth.uid() = granted_by AND
    has_endeavor_access(auth.uid(), endeavor_id, 'owner')
  );

-- Contexts RLS
ALTER TABLE contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contexts they're members of" ON contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = contexts.id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create contexts" ON contexts
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Context owners can update contexts" ON contexts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = contexts.id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );

-- Context Memberships RLS
ALTER TABLE context_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view memberships in their contexts" ON context_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = context_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Context owners can manage memberships" ON context_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = context_id AND cm.user_id = auth.uid() AND cm.role = 'owner'
    )
  );

-- 8. Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON endeavor_access TO authenticated;
GRANT SELECT, INSERT, UPDATE ON contexts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON context_memberships TO authenticated;

-- Create invitation with context details
CREATE OR REPLACE FUNCTION create_context_invitation(
  p_context_id text,
  p_inviter_user_id uuid,
  p_invitee_email text,
  p_role text
)
RETURNS TABLE(invitation_id text, token text)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  context_rec contexts%ROWTYPE;
  new_invitation_id text;
  new_token text;
BEGIN
  -- 1. Verify inviter has permission to invite to this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_inviter_user_id
      AND cm.role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to invite to context %', p_context_id;
  END IF;

  -- 2. Get context details for denormalization
  SELECT * INTO context_rec
  FROM contexts c
  WHERE c.id = p_context_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Context % not found', p_context_id;
  END IF;

  -- 3. Check for existing active invitation
  IF EXISTS (
    SELECT 1 FROM context_invitations ci
    WHERE ci.context_id = p_context_id
      AND ci.invitee_email = p_invitee_email
      AND ci.accepted_at IS NULL
      AND ci.revoked_at IS NULL
      AND ci.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Active invitation already exists for % to context %', p_invitee_email, p_context_id;
  END IF;

  -- 4. Generate invitation ID and token
  new_invitation_id := 'invite:' || p_context_id || ':' || extract(epoch from now())::bigint;
  new_token := encode(gen_random_uuid()::text::bytea, 'base64');

  -- 5. Create invitation with context details
  INSERT INTO context_invitations (
    id,
    context_id,
    context_title,
    context_description,
    inviter_user_id,
    invitee_email,
    role,
    token,
    expires_at
  ) VALUES (
    new_invitation_id,
    p_context_id,
    context_rec.title,
    context_rec.description,
    p_inviter_user_id,
    p_invitee_email,
    p_role,
    new_token,
    now() + interval '7 days' -- Default 7-day expiration
  );

  RETURN QUERY SELECT new_invitation_id, new_token;
END;
$$ LANGUAGE plpgsql;

-- Revoke invitation
CREATE OR REPLACE FUNCTION revoke_context_invitation(
  p_invitation_id text,
  p_revoker_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_rec context_invitations%ROWTYPE;
BEGIN
  -- 1. Get invitation details
  SELECT * INTO invitation_rec
  FROM context_invitations ci
  WHERE ci.id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation % not found', p_invitation_id;
  END IF;

  -- 2. Check if already processed
  IF invitation_rec.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot revoke accepted invitation';
  END IF;

  IF invitation_rec.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invitation already revoked';
  END IF;

  -- 3. Verify revoker has permission
  IF NOT (
    invitation_rec.inviter_user_id = p_revoker_user_id OR
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = invitation_rec.context_id
        AND cm.user_id = p_revoker_user_id
        AND cm.role = 'owner'
    )
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke invitation';
  END IF;

  -- 4. Revoke invitation
  UPDATE context_invitations
  SET
    revoked_at = now(),
    revoked_by = p_revoker_user_id
  WHERE id = p_invitation_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Get pending invitations for a context
CREATE OR REPLACE FUNCTION get_context_pending_invitations(
  p_context_id text,
  p_user_id uuid
)
RETURNS TABLE(
  id text,
  invitee_email text,
  role text,
  created_at timestamptz,
  expires_at timestamptz,
  token text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify user has access to see invitations for this context
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id AND cm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'No access to context %', p_context_id;
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.invitee_email,
    ci.role,
    ci.created_at,
    ci.expires_at,
    ci.token
  FROM context_invitations ci
  WHERE ci.context_id = p_context_id
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > now()
  ORDER BY ci.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get invitations for a user (by email)
CREATE OR REPLACE FUNCTION get_user_pending_invitations(
  p_user_email text
)
RETURNS TABLE(
  id text,
  context_id text,
  context_title text,
  context_description text,
  role text,
  inviter_email text,
  created_at timestamptz,
  expires_at timestamptz,
  token text
)
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.context_id,
    ci.context_title,
    ci.context_description,
    ci.role,
    u.email as inviter_email,
    ci.created_at,
    ci.expires_at,
    ci.token
  FROM context_invitations ci
  JOIN auth.users u ON u.id = ci.inviter_user_id
  WHERE ci.invitee_email = p_user_email
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > now()
  ORDER BY ci.created_at DESC;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_accessible_endeavors(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION has_endeavor_access(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_contexts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_context_invitation(text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_context_invitation(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_context_pending_invitations(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_pending_invitations(text) TO authenticated;