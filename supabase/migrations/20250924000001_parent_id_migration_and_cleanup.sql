-- Migration: Replace edges table with parent_id column and cleanup obsolete structures
-- This simplifies the design: context_id for ownership, parent_id for hierarchy

BEGIN;

-- Step 1: Add parent_id column to endeavors
ALTER TABLE endeavors ADD COLUMN parent_id TEXT REFERENCES endeavors(id) ON DELETE SET NULL;

-- Step 2: Migrate existing edge data to parent_id column
-- Only migrate 'supports' relationships (child supports parent)
UPDATE endeavors
SET parent_id = (
  SELECT e.to_endeavor_id
  FROM edges e
  WHERE e.from_endeavor_id = endeavors.id
  AND e.relationship = 'supports'
  LIMIT 1
);

-- Step 3: Create index for performance
CREATE INDEX idx_endeavors_parent_id ON endeavors(parent_id);

-- Step 4: Drop the edges table (we no longer need it)
DROP TABLE IF EXISTS edges CASCADE;

-- Step 5: Create recursive function to get endeavor descendants
CREATE OR REPLACE FUNCTION get_endeavor_descendants(root_endeavor_id TEXT)
RETURNS TABLE(endeavor_id TEXT)
LANGUAGE sql
AS $$
  WITH RECURSIVE descendants AS (
    -- Start with the root endeavor
    SELECT id as endeavor_id FROM endeavors WHERE id = root_endeavor_id
    UNION ALL
    -- Find all children recursively
    SELECT e.id as endeavor_id
    FROM endeavors e
    JOIN descendants d ON e.parent_id = d.endeavor_id
  )
  SELECT endeavor_id FROM descendants;
$$;

-- Step 6: Create function to get just the descendants (excluding root)
CREATE OR REPLACE FUNCTION get_endeavor_children_recursive(root_endeavor_id TEXT)
RETURNS TABLE(endeavor_id TEXT)
LANGUAGE sql
AS $$
  WITH RECURSIVE descendants AS (
    -- Start with direct children of root
    SELECT id as endeavor_id FROM endeavors WHERE parent_id = root_endeavor_id
    UNION ALL
    -- Find their children recursively
    SELECT e.id as endeavor_id
    FROM endeavors e
    JOIN descendants d ON e.parent_id = d.endeavor_id
  )
  SELECT endeavor_id FROM descendants;
$$;

-- Step 7: Drop obsolete functions that were based on edges/role_assertions/endeavor_access
DROP FUNCTION IF EXISTS get_accessible_endeavors(uuid) CASCADE;
DROP FUNCTION IF EXISTS get_accessible_subgraph(uuid, text[], integer, text[]) CASCADE;
DROP FUNCTION IF EXISTS get_context_subgraph(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS get_endeavor_with_context(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS has_endeavor_access(uuid, text, text) CASCADE;

-- Note: Invitation functions are preserved as they are still needed:
-- - get_context_pending_invitations
-- - get_user_pending_invitations
-- - create_context_invitation
-- - revoke_context_invitation

COMMIT;