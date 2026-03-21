-- Consolidated invitation system fixes

-- 1. Fix get_user_pending_invitations email type casting
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
    CAST(u.email AS text) as inviter_email, -- Explicit CAST to fix type mismatch
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

-- 2. Fix get_context_pending_invitations to only allow owners/editors to see invitations
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
  -- Allow both owners and editors to see pending invitations
  IF NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
      AND cm.role IN ('owner', 'editor')
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