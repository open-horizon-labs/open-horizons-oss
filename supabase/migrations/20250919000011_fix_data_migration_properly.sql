-- Option 4: Manual fix + proper migration continuation
-- This replaces the problematic parts of 20250919000002 with working code

-- 1. Essential ownership migration (from the failed migration)
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT
  id as endeavor_id,
  user_id,
  'owner' as access_type,
  user_id as granted_by,
  'direct' as granted_via
FROM endeavors
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM endeavor_access ea
    WHERE ea.endeavor_id = endeavors.id
      AND ea.user_id = endeavors.user_id
      AND ea.access_type = 'owner'
      AND ea.granted_via = 'direct'
  );

-- 2. Context migration with proper JSON parsing (fixed version)
INSERT INTO contexts (id, created_by, title, description, root_endeavor_ids, ui_config)
SELECT
  e.id,
  e.user_id,
  e.title,
  e.description,
  -- Handle the malformed JSON array properly
  CASE
    WHEN e.metadata->>'sharedEndeavors' IS NULL THEN ARRAY[]::text[]
    WHEN e.metadata->>'sharedEndeavors' = '[]' THEN ARRAY[]::text[]
    WHEN e.metadata->>'sharedEndeavors' ~ '^\[.*\]$' THEN
      -- Parse JSON array string to PostgreSQL array
      ARRAY(
        SELECT trim(both '"' from value::text)
        FROM json_array_elements_text(
          (e.metadata->>'sharedEndeavors')::json
        ) as value
      )
    ELSE ARRAY[]::text[]
  END as root_endeavor_ids,
  COALESCE(
    jsonb_build_object(
      'typeMappings', COALESCE(e.metadata->'typeMappings', '{}'::jsonb),
      'labels', COALESCE(e.metadata->'labels', '{}'::jsonb),
      'rituals', COALESCE(e.metadata->'rituals', '{}'::jsonb)
    ),
    '{}'::jsonb
  ) as ui_config
FROM endeavors e
JOIN role_assertions ra ON ra.endeavor_id = e.id
WHERE ra.role = 'context'
  AND NOT EXISTS (
    SELECT 1 FROM contexts c WHERE c.id = e.id
  )
ON CONFLICT (id) DO NOTHING;

-- 3. Migrate context memberships (from the failed migration)
INSERT INTO context_memberships (context_id, user_id, role, invited_by)
SELECT
  c.id as context_id,
  c.created_by as user_id,
  'owner' as role,
  c.created_by as invited_by
FROM contexts c
WHERE NOT EXISTS (
  SELECT 1 FROM context_memberships cm
  WHERE cm.context_id = c.id AND cm.user_id = c.created_by
);

-- 4. Grant access to shared endeavors in contexts (from the failed migration)
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT
  endeavor_id,
  cm.user_id,
  CASE cm.role
    WHEN 'owner' THEN 'editor'
    WHEN 'editor' THEN 'editor'
    ELSE 'viewer'
  END as access_type,
  c.created_by as granted_by,
  'context:' || c.id as granted_via
FROM contexts c
JOIN context_memberships cm ON cm.context_id = c.id
CROSS JOIN LATERAL unnest(c.root_endeavor_ids) as endeavor_id
WHERE NOT EXISTS (
  SELECT 1 FROM endeavor_access ea
  WHERE ea.endeavor_id = endeavor_id
    AND ea.user_id = cm.user_id
    AND ea.granted_via = 'context:' || c.id
);

-- 5. Update RLS policies (from the failed migration)
-- Enable RLS on endeavors table to use new access control
DROP POLICY IF EXISTS "Users can view their own endeavors" ON endeavors;
DROP POLICY IF EXISTS "Users can view endeavors in their contexts" ON endeavors;

DROP POLICY IF EXISTS "Users can view accessible endeavors" ON endeavors;
CREATE POLICY "Users can view accessible endeavors" ON endeavors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = endeavors.id
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "Users can update accessible endeavors with edit permission" ON endeavors;
CREATE POLICY "Users can update accessible endeavors with edit permission" ON endeavors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = endeavors.id
        AND ea.user_id = auth.uid()
        AND ea.access_type IN ('owner', 'editor')
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

-- Similar updates for edges and role_assertions tables
DROP POLICY IF EXISTS "Users can view their own edges" ON edges;
DROP POLICY IF EXISTS "Users can view accessible edges" ON edges;
CREATE POLICY "Users can view accessible edges" ON edges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE (ea.endeavor_id = edges.from_endeavor_id OR ea.endeavor_id = edges.to_endeavor_id)
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "Users can view their own role assertions" ON role_assertions;

DROP POLICY IF EXISTS "Users can view accessible role assertions" ON role_assertions;
CREATE POLICY "Users can view accessible role assertions" ON role_assertions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = role_assertions.endeavor_id
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );
