-- Phase 1b: Migrate Existing Data
-- Migrate current ownership and context data to new schema

-- 1. Migrate existing endeavor ownership to access control system
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT
  e.id,
  e.user_id,
  'owner',
  e.user_id, -- self-granted
  'direct'
FROM endeavors e
WHERE NOT EXISTS (
  SELECT 1 FROM endeavor_access ea
  WHERE ea.endeavor_id = e.id AND ea.user_id = e.user_id AND ea.access_type = 'owner'
);

-- 2. Migrate existing contexts from endeavors table to contexts table
-- First, identify context endeavors via role_assertions
INSERT INTO contexts (id, created_by, title, description, root_endeavor_ids, ui_config)
SELECT
  e.id,
  e.user_id,
  e.title,
  e.description,
  COALESCE(
    (e.metadata->>'sharedEndeavors')::text[],
    ARRAY[]::text[]
  ) as root_endeavor_ids,
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
  );

-- 3. Create context memberships for context owners
INSERT INTO context_memberships (context_id, user_id, role, invited_by)
SELECT
  c.id,
  c.created_by,
  'owner',
  c.created_by
FROM contexts c
WHERE NOT EXISTS (
  SELECT 1 FROM context_memberships cm
  WHERE cm.context_id = c.id AND cm.user_id = c.created_by
);

-- 4. Migrate accepted context invitations to context memberships
INSERT INTO context_memberships (context_id, user_id, role, invited_by, invitation_token)
SELECT
  ci.context_id,
  ci.accepted_by_user_id,
  ci.role,
  ci.inviter_user_id,
  ci.token
FROM context_invitations ci
WHERE ci.accepted_at IS NOT NULL
  AND ci.accepted_by_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = ci.context_id AND cm.user_id = ci.accepted_by_user_id
  );

-- 5. Grant access to shared endeavors based on context memberships
-- For each context membership, grant access to all endeavors in that context
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT DISTINCT
  unnest(c.root_endeavor_ids) as endeavor_id,
  cm.user_id,
  CASE
    WHEN cm.role = 'owner' THEN 'editor'
    WHEN cm.role = 'editor' THEN 'editor'
    ELSE 'viewer'
  END as access_type,
  c.created_by as granted_by,
  'context:' || c.id as granted_via
FROM contexts c
JOIN context_memberships cm ON cm.context_id = c.id
WHERE array_length(c.root_endeavor_ids, 1) > 0
  AND cm.user_id != c.created_by -- Don't duplicate owner access
  AND NOT EXISTS (
    SELECT 1 FROM endeavor_access ea
    WHERE ea.endeavor_id = ANY(c.root_endeavor_ids)
      AND ea.user_id = cm.user_id
      AND ea.granted_via = 'context:' || c.id
  );

-- 6. Update endeavors RLS to use new access control system
-- Drop old ownership-based policies
DROP POLICY IF EXISTS "Enable read for owners" ON endeavors;
DROP POLICY IF EXISTS "Enable insert for owners" ON endeavors;
DROP POLICY IF EXISTS "Enable update for owners" ON endeavors;
DROP POLICY IF EXISTS "Enable delete for owners" ON endeavors;

-- Create new access-based policies
CREATE POLICY "Users can view accessible endeavors" ON endeavors
  FOR SELECT USING (
    has_endeavor_access(auth.uid(), id, 'viewer')
  );

CREATE POLICY "Users can create endeavors" ON endeavors
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update endeavors they can edit" ON endeavors
  FOR UPDATE USING (
    has_endeavor_access(auth.uid(), id, 'editor')
  );

CREATE POLICY "Users can delete endeavors they own" ON endeavors
  FOR DELETE USING (
    has_endeavor_access(auth.uid(), id, 'owner')
  );

-- 7. Update edges RLS to use new access control system
-- Drop old ownership-based policies
DROP POLICY IF EXISTS "Enable read for owners" ON edges;
DROP POLICY IF EXISTS "Enable insert for owners" ON edges;
DROP POLICY IF EXISTS "Enable update for owners" ON edges;
DROP POLICY IF EXISTS "Enable delete for owners" ON edges;

-- Create new access-based policies
CREATE POLICY "Users can view edges between accessible endeavors" ON edges
  FOR SELECT USING (
    has_endeavor_access(auth.uid(), from_endeavor_id, 'viewer') AND
    has_endeavor_access(auth.uid(), to_endeavor_id, 'viewer')
  );

CREATE POLICY "Users can create edges for endeavors they can edit" ON edges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), from_endeavor_id, 'editor') AND
    has_endeavor_access(auth.uid(), to_endeavor_id, 'viewer')
  );

CREATE POLICY "Users can update edges they created" ON edges
  FOR UPDATE USING (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), from_endeavor_id, 'editor')
  );

CREATE POLICY "Users can delete edges they created" ON edges
  FOR DELETE USING (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), from_endeavor_id, 'editor')
  );

-- 8. Update role_assertions RLS to use new access control system
-- Drop old ownership-based policies
DROP POLICY IF EXISTS "Enable read for owners" ON role_assertions;
DROP POLICY IF EXISTS "Enable insert for owners" ON role_assertions;
DROP POLICY IF EXISTS "Enable update for owners" ON role_assertions;
DROP POLICY IF EXISTS "Enable delete for owners" ON role_assertions;

-- Create new access-based policies
CREATE POLICY "Users can view role assertions for accessible endeavors" ON role_assertions
  FOR SELECT USING (
    has_endeavor_access(auth.uid(), endeavor_id, 'viewer')
  );

CREATE POLICY "Users can create role assertions for endeavors they can edit" ON role_assertions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), endeavor_id, 'editor')
  );

CREATE POLICY "Users can update their own role assertions" ON role_assertions
  FOR UPDATE USING (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), endeavor_id, 'editor')
  );

CREATE POLICY "Users can delete their own role assertions" ON role_assertions
  FOR DELETE USING (
    auth.uid() = user_id AND
    has_endeavor_access(auth.uid(), endeavor_id, 'editor')
  );