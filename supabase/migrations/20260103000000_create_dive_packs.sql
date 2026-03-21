-- Dive Packs: Curated grounding context for working sessions
-- A "blanket" that wraps a coherent context around a dive
-- Immutable snapshots - if source changes, create a new pack

-------------------------------------------------------------------------------
-- DIVE PACKS TABLE
-------------------------------------------------------------------------------

CREATE TABLE dive_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Primary endeavor this pack is filed under (for navigation)
  -- NOTE: endeavors.id is TEXT not UUID (tech debt tracked in GH #36)
  primary_endeavor_id TEXT NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,

  -- Ownership
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),

  -- Source snapshot: IDs + timestamps at pack creation (for staleness detection)
  -- { endeavor_versions: { id: timestamp }, metis_ids: [], guardrail_ids: [] }
  source_snapshot JSONB NOT NULL,

  -- Curated content: constitutional + situational grounding
  -- {
  --   constitutional: { mission_context, standing_guardrails[] },
  --   endeavors: [{ id, title, type, role }],
  --   metis: [{ id, content, source_endeavor_id }],
  --   guardrails: [{ id, content, scope }],
  --   tools: [{ name, description, command? }],
  --   notes: string
  -- }
  content JSONB NOT NULL,

  -- Pre-rendered markdown for injection into WM (immutable with pack)
  rendered_md TEXT NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_dive_packs_primary_endeavor ON dive_packs(primary_endeavor_id);
CREATE INDEX idx_dive_packs_created_by ON dive_packs(created_by);
CREATE INDEX idx_dive_packs_created_at ON dive_packs(created_at DESC);
CREATE INDEX idx_dive_packs_status ON dive_packs(status);

-- Composite index for "list active packs for endeavor" query
CREATE INDEX idx_dive_packs_endeavor_status ON dive_packs(primary_endeavor_id, status, created_at DESC);

-------------------------------------------------------------------------------
-- RLS POLICIES
-------------------------------------------------------------------------------

ALTER TABLE dive_packs ENABLE ROW LEVEL SECURITY;

-- Users can read their own packs
CREATE POLICY "dive_packs_read_own" ON dive_packs
  FOR SELECT USING (created_by = auth.uid());

-- Users can read packs for endeavors in contexts they're members of
-- This covers shared contexts; personal endeavors are covered by read_own
CREATE POLICY "dive_packs_read_shared" ON dive_packs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON cm.context_id = e.context_id
      WHERE e.id = dive_packs.primary_endeavor_id
      AND cm.user_id = auth.uid()
    )
  );

-- Users can create packs (must set created_by to their own id)
CREATE POLICY "dive_packs_insert" ON dive_packs
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- Users can update their own packs (for archival/unarchival)
CREATE POLICY "dive_packs_update_own" ON dive_packs
  FOR UPDATE USING (created_by = auth.uid());

-- Users can delete their own packs
CREATE POLICY "dive_packs_delete_own" ON dive_packs
  FOR DELETE USING (created_by = auth.uid());

-------------------------------------------------------------------------------
-- HELPER FUNCTIONS
-------------------------------------------------------------------------------

-- Get dive context for creating a new pack
-- Returns endeavor + ancestors + metis + guardrails + recent logs
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
BEGIN
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

  -- Get ancestors (parent chain up to mission)
  WITH RECURSIVE ancestors AS (
    SELECT id, title, node_type, parent_id, 0 as depth
    FROM endeavors
    WHERE id = p_endeavor_id

    UNION ALL

    SELECT e.id, e.title, e.node_type, e.parent_id, a.depth + 1
    FROM endeavors e
    JOIN ancestors a ON e.id = a.parent_id
    WHERE a.parent_id IS NOT NULL
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', id, 'title', title, 'type', node_type)
    ORDER BY depth DESC
  ), '[]'::jsonb) INTO v_ancestors
  FROM ancestors
  WHERE id != p_endeavor_id;

  -- Get children
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', e.id, 'title', e.title, 'type', e.node_type)
  ), '[]'::jsonb) INTO v_children
  FROM endeavors e
  WHERE e.parent_id = p_endeavor_id;

  -- Get siblings (same parent, different id)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('id', e.id, 'title', e.title, 'type', e.node_type)
  ), '[]'::jsonb) INTO v_siblings
  FROM endeavors e
  WHERE e.parent_id = (SELECT parent_id FROM endeavors WHERE id = p_endeavor_id)
    AND e.id != p_endeavor_id;

  -- Get metis entries (from this endeavor and ancestors)
  WITH RECURSIVE endeavor_chain AS (
    SELECT id, parent_id FROM endeavors WHERE id = p_endeavor_id
    UNION ALL
    SELECT e.id, e.parent_id FROM endeavors e
    JOIN endeavor_chain ec ON e.id = ec.parent_id
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
    AND m.endeavor_id IN (SELECT id FROM endeavor_chain);

  -- Get guardrails (from this endeavor and ancestors)
  WITH RECURSIVE endeavor_chain AS (
    SELECT id, parent_id FROM endeavors WHERE id = p_endeavor_id
    UNION ALL
    SELECT e.id, e.parent_id FROM endeavors e
    JOIN endeavor_chain ec ON e.id = ec.parent_id
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
    AND g.endeavor_id IN (SELECT id FROM endeavor_chain);

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

-- Auto-archive old packs (callable by cron or on-demand)
-- Archives: packs older than 90 days, excess packs beyond 10 per endeavor
CREATE OR REPLACE FUNCTION auto_archive_old_dive_packs()
RETURNS INTEGER AS $$
DECLARE
  v_archived_count INTEGER := 0;
  v_excess_count INTEGER := 0;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
