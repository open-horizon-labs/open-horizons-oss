-- Simplify token generation without complex functions

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
  current_timestamp_ms bigint;
  random_uuid text;
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

  -- 4. Generate unique invitation ID with millisecond precision
  current_timestamp_ms := extract(epoch from now() at time zone 'utc') * 1000;
  random_uuid := gen_random_uuid()::text;
  new_invitation_id := 'invite:' || p_context_id || ':' || current_timestamp_ms || '-' || substr(replace(random_uuid, '-', ''), 1, 8);

  -- Simple base64-like token using UUID
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
    now() + interval '7 days'
  );

  RETURN QUERY SELECT new_invitation_id, new_token;
END;
$$ LANGUAGE plpgsql;