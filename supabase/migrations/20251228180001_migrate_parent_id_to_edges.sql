-- Migrate parent_id data to edges table
-- This creates 'contains' edges for all existing parent-child relationships

BEGIN;

-------------------------------------------------------------------------------
-- MIGRATE EXISTING PARENT RELATIONSHIPS TO EDGES
-------------------------------------------------------------------------------

-- Insert contains edges for all endeavors that have a parent_id
INSERT INTO edges (from_endeavor_id, to_endeavor_id, relationship, created_by, created_at)
SELECT
  e.parent_id,           -- parent is the "from" (container)
  e.id,                  -- child is the "to" (contained)
  'contains',
  e.user_id,             -- created_by = endeavor owner
  e.created_at           -- preserve original creation time
FROM endeavors e
WHERE e.parent_id IS NOT NULL
ON CONFLICT (from_endeavor_id, to_endeavor_id, relationship) DO NOTHING;

-------------------------------------------------------------------------------
-- UPDATE GUARDRAILS HELPER TO USE EDGES
-------------------------------------------------------------------------------

-- Drop and recreate get_endeavor_guardrails to use edges instead of parent_id
DROP FUNCTION IF EXISTS get_endeavor_guardrails(TEXT);

CREATE OR REPLACE FUNCTION get_endeavor_guardrails(p_endeavor_id TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  severity TEXT,
  enforcement TEXT,
  tags TEXT[],
  source_endeavor_id TEXT,
  inheritance_depth INTEGER,
  override_protocol TEXT,
  created_at TIMESTAMPTZ
) AS $$
WITH RECURSIVE endeavor_ancestors AS (
  -- Base: the endeavor itself
  SELECT e.id, e.context_id, 0 as depth
  FROM endeavors e
  WHERE e.id = p_endeavor_id

  UNION ALL

  -- Recursive: parent endeavors via edges
  SELECT e.id, e.context_id, ea.depth + 1
  FROM endeavors e
  JOIN edges ed ON ed.from_endeavor_id = e.id AND ed.relationship = 'contains'
  JOIN endeavor_ancestors ea ON ed.to_endeavor_id = ea.id
  WHERE ea.depth < 10  -- Prevent infinite recursion
)
SELECT DISTINCT ON (g.id)
  g.id,
  g.title,
  g.description,
  g.severity,
  g.enforcement,
  g.tags,
  COALESCE(g.endeavor_id, 'context:' || g.context_id) as source_endeavor_id,
  ea.depth as inheritance_depth,
  g.override_protocol,
  g.created_at
FROM guardrails g
LEFT JOIN endeavor_ancestors ea ON g.endeavor_id = ea.id
WHERE g.status = 'active'
  AND (
    -- Direct endeavor match or ancestor
    g.endeavor_id IN (SELECT id FROM endeavor_ancestors)
    -- Or context-level guardrail
    OR g.context_id IN (SELECT context_id FROM endeavor_ancestors WHERE context_id IS NOT NULL)
  )
ORDER BY g.id, ea.depth NULLS LAST;
$$ LANGUAGE SQL STABLE;

-------------------------------------------------------------------------------
-- UPDATE METIS HELPER TO USE EDGES
-------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS get_endeavor_metis_summary(TEXT);

CREATE OR REPLACE FUNCTION get_endeavor_metis_summary(p_endeavor_id TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  confidence TEXT,
  freshness TEXT,
  source_endeavor_id TEXT
) AS $$
WITH RECURSIVE endeavor_ancestors AS (
  SELECT e.id, e.context_id, 0 as depth
  FROM endeavors e
  WHERE e.id = p_endeavor_id

  UNION ALL

  SELECT e.id, e.context_id, ea.depth + 1
  FROM endeavors e
  JOIN edges ed ON ed.from_endeavor_id = e.id AND ed.relationship = 'contains'
  JOIN endeavor_ancestors ea ON ed.to_endeavor_id = ea.id
  WHERE ea.depth < 10
)
SELECT
  m.id,
  m.title,
  m.content,
  m.confidence,
  CASE
    WHEN m.last_reinforced_at > now() - interval '7 days' THEN 'recent'
    WHEN m.last_reinforced_at > now() - interval '30 days' THEN 'stale'
    ELSE 'historical'
  END as freshness,
  COALESCE(m.endeavor_id, 'context:' || m.context_id) as source_endeavor_id
FROM metis_entries m
LEFT JOIN endeavor_ancestors ea ON m.endeavor_id = ea.id
WHERE m.status = 'active'
  AND (
    m.endeavor_id IN (SELECT id FROM endeavor_ancestors)
    OR m.context_id IN (SELECT context_id FROM endeavor_ancestors WHERE context_id IS NOT NULL)
  )
ORDER BY
  CASE m.confidence WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
  m.last_reinforced_at DESC
LIMIT 10;
$$ LANGUAGE SQL STABLE;

-------------------------------------------------------------------------------
-- UPDATE DESCENDANT FUNCTIONS TO USE EDGES
-------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS get_endeavor_descendants(TEXT);

CREATE OR REPLACE FUNCTION get_endeavor_descendants(root_endeavor_id TEXT)
RETURNS TABLE(endeavor_id TEXT)
LANGUAGE sql
AS $$
  WITH RECURSIVE descendants AS (
    -- Start with the root endeavor
    SELECT id as endeavor_id FROM endeavors WHERE id = root_endeavor_id
    UNION ALL
    -- Find all children recursively via edges
    SELECT ed.to_endeavor_id as endeavor_id
    FROM edges ed
    JOIN descendants d ON ed.from_endeavor_id = d.endeavor_id
    WHERE ed.relationship = 'contains'
  )
  SELECT endeavor_id FROM descendants;
$$;

DROP FUNCTION IF EXISTS get_endeavor_children_recursive(TEXT);

CREATE OR REPLACE FUNCTION get_endeavor_children_recursive(root_endeavor_id TEXT)
RETURNS TABLE(endeavor_id TEXT)
LANGUAGE sql
AS $$
  WITH RECURSIVE descendants AS (
    -- Start with direct children of root
    SELECT to_endeavor_id as endeavor_id
    FROM edges
    WHERE from_endeavor_id = root_endeavor_id AND relationship = 'contains'
    UNION ALL
    -- Find their children recursively
    SELECT ed.to_endeavor_id as endeavor_id
    FROM edges ed
    JOIN descendants d ON ed.from_endeavor_id = d.endeavor_id
    WHERE ed.relationship = 'contains'
  )
  SELECT endeavor_id FROM descendants;
$$;

DROP FUNCTION IF EXISTS get_descendant_endeavors(TEXT);

CREATE OR REPLACE FUNCTION get_descendant_endeavors(root_id TEXT)
RETURNS TABLE (
  id TEXT,
  title TEXT,
  node_type TEXT,
  parent_id TEXT  -- Computed from edges for backward compatibility
) AS $$
  WITH RECURSIVE descendants AS (
    SELECT e.id, e.title, e.node_type, get_endeavor_parent(e.id) as parent_id
    FROM endeavors e
    JOIN edges ed ON ed.to_endeavor_id = e.id
    WHERE ed.from_endeavor_id = root_id
      AND ed.relationship = 'contains'
      AND e.archived_at IS NULL

    UNION ALL

    SELECT e.id, e.title, e.node_type, get_endeavor_parent(e.id) as parent_id
    FROM endeavors e
    JOIN edges ed ON ed.to_endeavor_id = e.id
    INNER JOIN descendants d ON ed.from_endeavor_id = d.id
    WHERE ed.relationship = 'contains'
      AND e.archived_at IS NULL
  )
  SELECT id, title, node_type, parent_id FROM descendants;
$$ LANGUAGE SQL STABLE;

COMMIT;
