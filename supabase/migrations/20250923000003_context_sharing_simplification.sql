-- Comprehensive context sharing simplification
-- Combines multiple migrations into a single cohesive change:
-- 1. Move from complex access control to simple context_id column
-- 2. Restore simplified context memberships for collaboration
-- 3. Create optimized user contexts function
-- 4. Fix invitation functions to remove role references

BEGIN;

-- Step 1: Add required columns to endeavors table
ALTER TABLE endeavors ADD COLUMN context_id TEXT REFERENCES contexts(id) ON DELETE SET NULL;
ALTER TABLE endeavors ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Migrate existing data
-- Populate created_by from existing user_id column
UPDATE endeavors SET created_by = user_id WHERE user_id IS NOT NULL;

-- Migrate context_id from endeavor_access table (prioritize owner access)
UPDATE endeavors
SET context_id = (
  SELECT ea.context_id
  FROM endeavor_access ea
  WHERE ea.endeavor_id = endeavors.id
  ORDER BY CASE WHEN ea.access_type = 'owner' THEN 1 ELSE 2 END
  LIMIT 1
);

-- Step 3: Make created_by required
ALTER TABLE endeavors ALTER COLUMN created_by SET NOT NULL;

-- Step 4: Create performance indexes for endeavors
CREATE INDEX IF NOT EXISTS idx_endeavors_context_id ON endeavors(context_id);
CREATE INDEX IF NOT EXISTS idx_endeavors_created_by ON endeavors(created_by);

-- Step 5: Drop complex tables that are no longer needed
DROP TABLE IF EXISTS endeavor_access CASCADE;
DROP TABLE IF EXISTS role_assertions CASCADE;
DROP TABLE IF EXISTS context_memberships CASCADE;

-- Step 6: Drop complex RPC functions
DROP FUNCTION IF EXISTS get_context_subgraph(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS get_user_accessible_endeavors(UUID) CASCADE;
DROP FUNCTION IF EXISTS get_endeavor_with_context_access(UUID, UUID) CASCADE;

-- Step 7: Remove unnecessary columns from contexts
ALTER TABLE contexts DROP COLUMN IF EXISTS root_endeavor_ids;

-- Step 8: Create simplified context memberships table for collaboration
CREATE TABLE context_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_id TEXT NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitation_token TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(context_id, user_id)
);

-- Step 9: Create indexes for context memberships
CREATE INDEX idx_context_memberships_context_id ON context_memberships(context_id);
CREATE INDEX idx_context_memberships_user_id ON context_memberships(user_id);
CREATE INDEX idx_context_memberships_invitation_token ON context_memberships(invitation_token) WHERE invitation_token IS NOT NULL;

-- Step 10: Enable RLS on context memberships
ALTER TABLE context_memberships ENABLE ROW LEVEL SECURITY;

-- Step 11: Create RLS policies
-- Drop any existing endeavor policies first
DROP POLICY IF EXISTS "endeavors_access_policy" ON endeavors;
DROP POLICY IF EXISTS "endeavors_context_policy" ON endeavors;
DROP POLICY IF EXISTS "endeavors_context_access" ON endeavors;
DROP POLICY IF EXISTS "endeavors_simple_access" ON endeavors;
DROP POLICY IF EXISTS "Users can view accessible endeavors" ON endeavors;
DROP POLICY IF EXISTS "Users can view their own endeavors" ON endeavors;
DROP POLICY IF EXISTS "Users can view endeavors in their contexts" ON endeavors;
DROP POLICY IF EXISTS "endeavors_owner_only" ON endeavors;

-- Context memberships RLS: users can see their own memberships and context owners can see all memberships for their contexts
CREATE POLICY "context_memberships_access" ON context_memberships
  FOR ALL USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM contexts c
      WHERE c.id = context_memberships.context_id
      AND c.created_by = auth.uid()
    )
  );

-- Endeavors RLS: users can see endeavors they created or are context members of
CREATE POLICY "endeavors_context_access" ON endeavors
  FOR ALL USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = endeavors.context_id
      AND cm.user_id = auth.uid()
    )
  );

-- Step 12: Update user creation trigger to not use role_assertions
CREATE OR REPLACE FUNCTION public.create_user_node()
RETURNS TRIGGER AS $$
BEGIN
  -- Create user endeavor node with proper columns
  INSERT INTO public.endeavors (id, user_id, created_by, title, description, status, metadata)
  VALUES (
    'user:' || NEW.id::text,
    NEW.id,
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'Global user node for daily logs and cross-endeavor work',
    'active',
    jsonb_build_object(
      'node_type', 'user',
      'is_system_node', true,
      'created_via', 'trigger'
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '';

-- Step 13: Create function to get user contexts using UNION
DROP FUNCTION IF EXISTS get_user_contexts(UUID);

CREATE OR REPLACE FUNCTION get_user_contexts(p_user_id UUID)
RETURNS TABLE(
  id TEXT,
  title TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ,
  ui_config JSONB
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Get contexts user owns
  SELECT c.id, c.title, c.description, c.created_by, c.created_at, c.ui_config
  FROM contexts c
  WHERE c.created_by = p_user_id

  UNION

  -- Get contexts user is a member of
  SELECT c.id, c.title, c.description, c.created_by, c.created_at, c.ui_config
  FROM contexts c
  INNER JOIN context_memberships cm ON cm.context_id = c.id
  WHERE cm.user_id = p_user_id

  ORDER BY created_at DESC;
$$;

-- Step 14: Fix invitation functions to remove role references
-- Drop existing functions first
DROP FUNCTION IF EXISTS create_context_invitation(text, uuid, text, text);
DROP FUNCTION IF EXISTS create_context_invitation(text, uuid, text);
DROP FUNCTION IF EXISTS get_context_pending_invitations(text, uuid);
DROP FUNCTION IF EXISTS revoke_context_invitation(text, uuid);

-- Update create_context_invitation to remove role parameter and checks
CREATE OR REPLACE FUNCTION create_context_invitation(
  p_context_id text,
  p_inviter_user_id uuid,
  p_invitee_email text
)
RETURNS TABLE(
  invitation_id text,
  token text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation_id text;
  v_token text;
BEGIN
  -- Check if the user is the context owner
  IF NOT EXISTS (
    SELECT 1 FROM contexts c
    WHERE c.id = p_context_id
    AND c.created_by = p_inviter_user_id
  ) THEN
    RAISE EXCEPTION 'Only context owners can create invitations';
  END IF;

  -- Generate unique IDs
  v_invitation_id := 'inv:' || p_context_id || ':' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || substr(md5(random()::text), 1, 8);
  v_token := 'ct_' || substr(md5(random()::text || now()::text), 1, 32);

  -- Insert invitation
  INSERT INTO context_invitations (
    id,
    context_id,
    inviter_user_id,
    invitee_email,
    token,
    expires_at
  ) VALUES (
    v_invitation_id,
    p_context_id,
    p_inviter_user_id,
    p_invitee_email,
    v_token,
    NOW() + INTERVAL '7 days'
  );

  -- Return the invitation ID and token
  RETURN QUERY SELECT v_invitation_id, v_token;
END;
$$;

-- Update get_context_pending_invitations to remove role checks
CREATE OR REPLACE FUNCTION get_context_pending_invitations(
  p_context_id text,
  p_user_id uuid
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
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if user owns the context (simplified - no role column)
  IF NOT EXISTS (
    SELECT 1 FROM contexts c
    WHERE c.id = p_context_id
    AND c.created_by = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only view invitations for contexts you own';
  END IF;

  -- Return pending invitations
  RETURN QUERY
  SELECT
    ci.id,
    ci.context_id,
    c.title as context_title,
    c.description as context_description,
    'member'::text as role, -- Always return 'member' since we removed roles
    (SELECT email FROM auth.users WHERE id = ci.inviter_user_id) as inviter_email,
    ci.created_at,
    ci.expires_at,
    ci.token
  FROM context_invitations ci
  JOIN contexts c ON c.id = ci.context_id
  WHERE ci.context_id = p_context_id
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > NOW()
  ORDER BY ci.created_at DESC;
END;
$$;

-- Update revoke_context_invitation to remove role checks
CREATE OR REPLACE FUNCTION revoke_context_invitation(
  p_invitation_id text,
  p_revoker_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the user owns the context for this invitation
  IF NOT EXISTS (
    SELECT 1
    FROM context_invitations ci
    JOIN contexts c ON c.id = ci.context_id
    WHERE ci.id = p_invitation_id
      AND c.created_by = p_revoker_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied: You can only revoke invitations for contexts you own';
  END IF;

  -- Revoke the invitation
  UPDATE context_invitations
  SET revoked_at = NOW()
  WHERE id = p_invitation_id
    AND accepted_at IS NULL
    AND revoked_at IS NULL;

  -- Check if any row was actually updated
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found or already processed';
  END IF;
END;
$$;

COMMIT;