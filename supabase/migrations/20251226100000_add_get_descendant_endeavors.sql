-- Migration: Add get_descendant_endeavors function
-- Used by /api/reflect/tree to fetch all descendants of an endeavor
-- for rolling up pending candidates across the hierarchy

CREATE OR REPLACE FUNCTION get_descendant_endeavors(root_id text)
RETURNS TABLE(
  id text,
  title text,
  node_type text,
  parent_id text
) AS $$
  WITH RECURSIVE descendants AS (
    -- Base case: direct children of root
    SELECT e.id, e.title, e.node_type, e.parent_id
    FROM endeavors e
    WHERE e.parent_id = root_id

    UNION ALL

    -- Recursive case: children of descendants
    SELECT e.id, e.title, e.node_type, e.parent_id
    FROM endeavors e
    INNER JOIN descendants d ON e.parent_id = d.id
  )
  SELECT * FROM descendants;
$$ LANGUAGE sql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_descendant_endeavors(text) TO authenticated;

COMMENT ON FUNCTION get_descendant_endeavors IS
  'Returns all descendant endeavors (children, grandchildren, etc.) of a given root endeavor.
   Used by Reflect mode to roll up pending candidates across the hierarchy.';
