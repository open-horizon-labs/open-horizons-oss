-- Fix get_endeavor_guardrails to return override_protocol and created_at
-- These fields exist in the guardrails table but were missing from the function

-- Must DROP first because PostgreSQL doesn't allow changing return type with CREATE OR REPLACE
DROP FUNCTION IF EXISTS get_endeavor_guardrails(TEXT);

CREATE FUNCTION get_endeavor_guardrails(p_endeavor_id TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  severity TEXT,
  enforcement TEXT,
  override_protocol TEXT,
  created_at TIMESTAMPTZ,
  tags TEXT[],
  source_endeavor_id TEXT,
  inheritance_depth INTEGER
) AS $$
WITH RECURSIVE endeavor_ancestors AS (
  -- Base: the endeavor itself
  SELECT id, parent_id, context_id, 0 as depth
  FROM endeavors
  WHERE id = p_endeavor_id

  UNION ALL

  -- Recursive: parent endeavors
  SELECT e.id, e.parent_id, e.context_id, ea.depth + 1
  FROM endeavors e
  JOIN endeavor_ancestors ea ON e.id = ea.parent_id
)
SELECT DISTINCT ON (g.id)
  g.id,
  g.title,
  g.description,
  g.severity,
  g.enforcement,
  g.override_protocol,
  g.created_at,
  g.tags,
  COALESCE(g.endeavor_id, 'context:' || g.context_id) as source_endeavor_id,
  ea.depth as inheritance_depth
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
