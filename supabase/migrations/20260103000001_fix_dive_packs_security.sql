-- Fix Dive Packs Security Issues
-- 1. Add access check to get_dive_context (prevent exfiltration)
-- 2. Use edges table for hierarchy traversal (not parent_id)
-- 3. Tighten INSERT policy to check primary_endeavor_id access
-- 4. Restrict auto_archive to service role only

BEGIN;

-------------------------------------------------------------------------------
-- FIX 1: Update get_dive_context with access check
-- Uses user_has_endeavor_access helper from edges migration
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_dive_context(p_endeavor_id TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_endeavor JSONB;
  v_ancestors JSONB;
  v_children JSONB;
  v_siblings JSONB;
  v_metis JSONB;
  v_guardrails JSONB;
  v_recent_logs JSONB;
  v_user_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();

  -- Access check: user must have access to the endeavor
  IF v_user_id IS NULL OR NOT user_has_endeavor_access(v_user_id, p_endeavor_id) THEN
    RETURN NULL;
  END IF;

  -- Get the endeavor itself
  SELECT jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'type', e.node_type,
    'description', e.description,
    'updated_at', e.updated_at,
    'context_id', e.context_id
  ) INTO v_endeavor
  FROM endeavors e
  WHERE e.id = p_endeavor_id;

  IF v_endeavor IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get ancestors via edges (relationship='contains')
  -- Parent is from_endeavor_id where to_endeavor_id is child
  WITH RECURSIVE ancestors AS (
    -- Start with the parent of our endeavor
    SELECT ed.from_endeavor_id as id, e.title, e.node_type, 0 as depth
    FROM edges ed
    JOIN endeavors e ON e.id = ed.from_endeavor_id
    WHERE ed.to_endeavor_id = p_endeavor_id
      AND ed.relationship = 'contains'

    UNION ALL

    -- Recurse up the tree (depth limit prevents infinite cycles)
    SELECT ed.from_endeavor_id as id, e.title, e.node_type, a.depth + 1
    FROM edges ed
    JOIN endeavors e ON e.id = ed.from_endeavor_id
    JOIN ancestors a ON ed.to_endeavor_id = a.id
    WHERE ed.relationship = 'contains'
      AND a.depth < 20
  )
  -- Deduplicate ancestors (graph may have multiple paths), keep shortest path
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'title', title, 'type', node_type)
    ORDER BY depth DESC
  ), '[]'::jsonb) INTO v_ancestors
  FROM (
    SELECT DISTINCT ON (id) id, title, node_type, depth
    FROM ancestors
    ORDER BY id, depth ASC
  ) deduped;

  -- Get children via edges (relationship='contains')
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', e.id, 'title', e.title, 'type', e.node_type)
  ), '[]'::jsonb) INTO v_children
  FROM edges ed
  JOIN endeavors e ON e.id = ed.to_endeavor_id
  WHERE ed.from_endeavor_id = p_endeavor_id
    AND ed.relationship = 'contains';

  -- Get siblings (same parent via edges, different id)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', e.id, 'title', e.title, 'type', e.node_type)
  ), '[]'::jsonb) INTO v_siblings
  FROM edges parent_edge
  JOIN edges sibling_edge ON sibling_edge.from_endeavor_id = parent_edge.from_endeavor_id
  JOIN endeavors e ON e.id = sibling_edge.to_endeavor_id
  WHERE parent_edge.to_endeavor_id = p_endeavor_id
    AND parent_edge.relationship = 'contains'
    AND sibling_edge.relationship = 'contains'
    AND sibling_edge.to_endeavor_id != p_endeavor_id;

  -- Get metis entries (from this endeavor and ancestors)
  WITH RECURSIVE endeavor_chain AS (
    SELECT p_endeavor_id as id, 0 as depth
    UNION ALL
    SELECT ed.from_endeavor_id as id, ec.depth + 1
    FROM edges ed
    JOIN endeavor_chain ec ON ed.to_endeavor_id = ec.id
    WHERE ed.relationship = 'contains'
      AND ec.depth < 20
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'title', m.title,
      'content', m.content,
      'confidence', m.confidence,
      'endeavor_id', m.endeavor_id
    )
  ), '[]'::jsonb) INTO v_metis
  FROM metis_entries m
  WHERE m.status = 'active'
    AND m.endeavor_id IN (SELECT DISTINCT id FROM endeavor_chain);

  -- Get guardrails (from this endeavor and ancestors)
  WITH RECURSIVE endeavor_chain AS (
    SELECT p_endeavor_id as id, 0 as depth
    UNION ALL
    SELECT ed.from_endeavor_id as id, ec.depth + 1
    FROM edges ed
    JOIN endeavor_chain ec ON ed.to_endeavor_id = ec.id
    WHERE ed.relationship = 'contains'
      AND ec.depth < 20
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', g.id,
      'title', g.title,
      'description', g.description,
      'severity', g.severity,
      'endeavor_id', g.endeavor_id
    )
  ), '[]'::jsonb) INTO v_guardrails
  FROM guardrails g
  WHERE g.status = 'active'
    AND g.endeavor_id IN (SELECT DISTINCT id FROM endeavor_chain);

  -- Get recent logs (last 7 days)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'content', l.content,
      'log_date', l.log_date,
      'endeavor_id', l.entity_id
    )
    ORDER BY l.log_date DESC
  ), '[]'::jsonb) INTO v_recent_logs
  FROM logs l
  WHERE l.entity_type = 'endeavor'
    AND l.entity_id = p_endeavor_id
    AND l.log_date >= CURRENT_DATE - INTERVAL '7 days';

  -- Build result
  v_result := jsonb_build_object(
    'endeavor', v_endeavor,
    'ancestors', v_ancestors,
    'children', v_children,
    'siblings', v_siblings,
    'metis', v_metis,
    'guardrails', v_guardrails,
    'recent_logs', v_recent_logs
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-------------------------------------------------------------------------------
-- FIX 2: Tighten INSERT policy to require access to primary_endeavor_id
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "dive_packs_insert" ON dive_packs;
DROP POLICY IF EXISTS "dive_packs_update_own" ON dive_packs;

CREATE POLICY "dive_packs_insert" ON dive_packs
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND user_has_endeavor_access(auth.uid(), primary_endeavor_id)
  );

-- FIX 2b: Add WITH CHECK to update policy
CREATE POLICY "dive_packs_update_own" ON dive_packs
  FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-------------------------------------------------------------------------------
-- FIX 3: Restrict auto_archive to service role only
-- Drop old function and recreate with SECURITY INVOKER (no DEFINER)
-- This means only service role (or explicit permission) can run it
-------------------------------------------------------------------------------

DROP FUNCTION IF EXISTS auto_archive_old_dive_packs();

CREATE OR REPLACE FUNCTION auto_archive_old_dive_packs()
RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_excess_count INTEGER := 0;
BEGIN
  -- This function should only be called by service role (cron jobs)
  -- With SECURITY INVOKER, RLS applies - service role bypasses RLS

  -- Archive packs older than 90 days
  UPDATE dive_packs
  SET status = 'archived'
  WHERE status = 'active'
    AND created_at < now() - INTERVAL '90 days';

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  -- Archive excess packs per endeavor (keep max 10 active per endeavor)
  WITH ranked_packs AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY primary_endeavor_id
             ORDER BY created_at DESC
           ) as rn
    FROM dive_packs
    WHERE status = 'active'
  )
  UPDATE dive_packs
  SET status = 'archived'
  WHERE id IN (
    SELECT id FROM ranked_packs WHERE rn > 10
  );

  GET DIAGNOSTICS v_excess_count = ROW_COUNT;

  RETURN v_archived_count + v_excess_count;
END;
$$ LANGUAGE plpgsql;  -- No SECURITY DEFINER = SECURITY INVOKER (RLS applies)

-- Revoke execute from public, only service role should call this
REVOKE EXECUTE ON FUNCTION auto_archive_old_dive_packs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION auto_archive_old_dive_packs() FROM authenticated;

COMMIT;
