-- Add role parameter back to create_context_invitation function
-- This supports assigning roles (owner, editor, viewer) when inviting users to contexts

DROP FUNCTION IF EXISTS create_context_invitation(text, uuid, text);
DROP FUNCTION IF EXISTS create_context_invitation(text, uuid, text, text);

CREATE OR REPLACE FUNCTION create_context_invitation(
  p_context_id text,
  p_inviter_user_id uuid,
  p_invitee_email text,
  p_role text DEFAULT 'viewer'
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
  v_context_title text;
  v_context_description text;
BEGIN
  -- Validate role
  IF p_role NOT IN ('owner', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role: %. Must be owner, editor, or viewer', p_role;
  END IF;

  -- Check if the user is the context owner
  IF NOT EXISTS (
    SELECT 1 FROM contexts c
    WHERE c.id = p_context_id
    AND c.created_by = p_inviter_user_id
  ) THEN
    RAISE EXCEPTION 'Only context owners can create invitations';
  END IF;

  -- Get context details for the invitation
  SELECT title, description INTO v_context_title, v_context_description
  FROM contexts
  WHERE id = p_context_id;

  -- Generate unique IDs
  v_invitation_id := 'inv:' || p_context_id || ':' || EXTRACT(EPOCH FROM NOW())::bigint || '-' || substr(md5(random()::text), 1, 8);
  v_token := 'ct_' || substr(md5(random()::text || now()::text), 1, 32);

  -- Insert invitation with role
  INSERT INTO context_invitations (
    id,
    context_id,
    context_title,
    context_description,
    inviter_user_id,
    invitee_email,
    token,
    role,
    expires_at
  ) VALUES (
    v_invitation_id,
    p_context_id,
    v_context_title,
    v_context_description,
    p_inviter_user_id,
    LOWER(p_invitee_email),
    v_token,
    p_role,
    NOW() + INTERVAL '7 days'
  );

  -- Return the invitation ID and token
  RETURN QUERY SELECT v_invitation_id, v_token;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_context_invitation(text, uuid, text, text) TO authenticated;
