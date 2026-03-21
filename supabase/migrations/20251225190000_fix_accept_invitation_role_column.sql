-- Fix accept_context_invitation function to not reference removed role column
-- The context_memberships table was simplified to remove the role column in
-- migration 20250923000003_context_sharing_simplification.sql, but the
-- accept_context_invitation function was not updated to match.

BEGIN;

-- Drop and recreate the function without the role column
DROP FUNCTION IF EXISTS accept_context_invitation(text, uuid);

CREATE OR REPLACE FUNCTION accept_context_invitation(p_token text, p_accepter_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  invitation_rec context_invitations%ROWTYPE;
  accepter_email text;
BEGIN
  -- 1. Get accepter's email from auth.users
  SELECT email INTO accepter_email
  FROM auth.users
  WHERE id = p_accepter_user_id;

  IF accepter_email IS NULL THEN
    RAISE EXCEPTION 'Accepter user not found';
  END IF;

  -- 2. Find invitation by token and validate
  SELECT * INTO invitation_rec
  FROM context_invitations ci
  WHERE ci.token = p_token
    AND ci.invitee_email = accepter_email
    AND ci.accepted_at IS NULL
    AND ci.revoked_at IS NULL
    AND ci.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  -- 3. Check if user is already a member of the context
  IF EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = invitation_rec.context_id
      AND cm.user_id = p_accepter_user_id
  ) THEN
    RAISE EXCEPTION 'User is already a member of this context';
  END IF;

  -- 4. Create context membership (without role - column was removed)
  INSERT INTO context_memberships (
    context_id,
    user_id,
    invited_by,
    invitation_token
  ) VALUES (
    invitation_rec.context_id,
    p_accepter_user_id,
    invitation_rec.inviter_user_id,
    p_token
  );

  -- 5. Mark invitation as accepted
  UPDATE context_invitations
  SET accepted_at = now()
  WHERE id = invitation_rec.id;

  RETURN true;
END;
$$;

COMMIT;
