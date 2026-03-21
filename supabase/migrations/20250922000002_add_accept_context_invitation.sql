-- Add missing accept_context_invitation function

CREATE OR REPLACE FUNCTION accept_context_invitation(
  p_token text,
  p_accepter_user_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
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

  -- 4. Create context membership
  INSERT INTO context_memberships (
    context_id,
    user_id,
    role,
    invited_by,
    invitation_token
  ) VALUES (
    invitation_rec.context_id,
    p_accepter_user_id,
    invitation_rec.role,
    invitation_rec.inviter_user_id,
    p_token
  );

  -- 5. Mark invitation as accepted
  UPDATE context_invitations
  SET accepted_at = now()
  WHERE id = invitation_rec.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION accept_context_invitation(text, uuid) TO authenticated;