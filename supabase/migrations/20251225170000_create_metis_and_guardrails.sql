-- Metis and Guardrails: Core primitives for organizational learning
-- Metis = accumulated practical wisdom (write-only, decays over time)
-- Guardrails = executable constraints (enforceable, propagate downward)

-------------------------------------------------------------------------------
-- METIS ENTRIES
-- Captures violated expectations and consequences (not recommendations)
-- Write-only: editing metis is revisionism - create new entries instead
-------------------------------------------------------------------------------

CREATE TABLE metis_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: which endeavor/context this applies to
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  context_id TEXT REFERENCES contexts(id) ON DELETE CASCADE,

  -- Content: strict format - violated expectations + consequences only
  title TEXT NOT NULL,                    -- Brief summary
  content TEXT NOT NULL,                  -- Full description (markdown)

  -- Source tracking
  source_type TEXT NOT NULL DEFAULT 'manual',  -- 'manual', 'log', 'session', 'harvested'
  source_id TEXT,                         -- Reference to source (log_id, session_id, etc.)

  -- Decay mechanics (per ChatGPT review)
  confidence TEXT NOT NULL DEFAULT 'medium',  -- 'low', 'medium', 'high'
  last_reinforced_at TIMESTAMPTZ DEFAULT now(),
  reinforcement_count INTEGER DEFAULT 1,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'historical', 'superseded'
  superseded_by UUID REFERENCES metis_entries(id),

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- At least one scope required
  CONSTRAINT metis_has_scope CHECK (endeavor_id IS NOT NULL OR context_id IS NOT NULL)
);

-- Indexes for common queries
CREATE INDEX idx_metis_endeavor ON metis_entries(endeavor_id) WHERE endeavor_id IS NOT NULL;
CREATE INDEX idx_metis_context ON metis_entries(context_id) WHERE context_id IS NOT NULL;
CREATE INDEX idx_metis_status ON metis_entries(status);
CREATE INDEX idx_metis_confidence ON metis_entries(confidence, last_reinforced_at DESC);

-------------------------------------------------------------------------------
-- GUARDRAILS
-- Executable constraints that can be enforced mechanically
-- Propagate downward through endeavor hierarchy
-------------------------------------------------------------------------------

CREATE TABLE guardrails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope: where this guardrail applies
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  context_id TEXT REFERENCES contexts(id) ON DELETE CASCADE,

  -- Constraint definition (must be testable)
  title TEXT NOT NULL,                    -- One sentence, testable
  description TEXT,                       -- Detailed explanation (markdown)

  -- Enforcement (per ChatGPT review)
  severity TEXT NOT NULL DEFAULT 'soft',  -- 'hard' (BLOCK), 'soft' (BLOCK unless override), 'advisory' (ASK/NOTE)
  enforcement TEXT NOT NULL DEFAULT 'superego_question',  -- 'superego_question', 'checklist_gate', 'automated_check', 'human_review'

  -- Scope tags for sideways propagation
  tags TEXT[] DEFAULT '{}',               -- e.g., ['auth', 'security', 'compliance']

  -- Retirement mechanics (per ChatGPT review)
  review_by TIMESTAMPTZ,                  -- When to review this guardrail
  sunset_condition TEXT,                  -- e.g., "After 3 overrides", "When system X removed"
  override_count INTEGER DEFAULT 0,       -- Track overrides for sunset

  -- Rationale (link to incident/metis)
  rationale TEXT,                         -- Why this guardrail exists
  rationale_metis_id UUID REFERENCES metis_entries(id),

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'under_review', 'retired', 'superseded'
  superseded_by UUID REFERENCES guardrails(id),

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- At least one scope required
  CONSTRAINT guardrail_has_scope CHECK (endeavor_id IS NOT NULL OR context_id IS NOT NULL)
);

-- Indexes for common queries
CREATE INDEX idx_guardrails_endeavor ON guardrails(endeavor_id) WHERE endeavor_id IS NOT NULL;
CREATE INDEX idx_guardrails_context ON guardrails(context_id) WHERE context_id IS NOT NULL;
CREATE INDEX idx_guardrails_status ON guardrails(status);
CREATE INDEX idx_guardrails_severity ON guardrails(severity);
CREATE INDEX idx_guardrails_tags ON guardrails USING gin(tags);

-------------------------------------------------------------------------------
-- CANDIDATE TABLES
-- Staging area before promotion to metis/guardrails
-------------------------------------------------------------------------------

CREATE TABLE metis_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source context
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  context_id TEXT REFERENCES contexts(id) ON DELETE CASCADE,

  -- Raw observation
  content TEXT NOT NULL,                  -- The observation/insight
  source_type TEXT NOT NULL DEFAULT 'session',  -- 'session', 'log', 'manual'
  source_id TEXT,                         -- session_id, log_id, etc.

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'promoted', 'rejected', 'duplicate'
  promoted_to UUID REFERENCES metis_entries(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE guardrail_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source context
  endeavor_id TEXT REFERENCES endeavors(id) ON DELETE CASCADE,
  context_id TEXT REFERENCES contexts(id) ON DELETE CASCADE,

  -- Raw constraint observation
  content TEXT NOT NULL,                  -- The constraint pattern observed
  source_type TEXT NOT NULL DEFAULT 'session',  -- 'session', 'log', 'manual'
  source_id TEXT,                         -- session_id, log_id, etc.

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'promoted', 'rejected', 'duplicate'
  promoted_to UUID REFERENCES guardrails(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,

  -- Ownership
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_metis_candidates_status ON metis_candidates(status);
CREATE INDEX idx_guardrail_candidates_status ON guardrail_candidates(status);

-------------------------------------------------------------------------------
-- RLS POLICIES
-------------------------------------------------------------------------------

ALTER TABLE metis_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE metis_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardrail_candidates ENABLE ROW LEVEL SECURITY;

-- Metis: readable by context members, writable by editors+
CREATE POLICY "metis_read" ON metis_entries
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = metis_entries.context_id
      AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON cm.context_id = e.context_id
      WHERE e.id = metis_entries.endeavor_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "metis_insert" ON metis_entries
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- Guardrails: same access pattern
CREATE POLICY "guardrails_read" ON guardrails
  FOR SELECT USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = guardrails.context_id
      AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM endeavors e
      JOIN context_memberships cm ON cm.context_id = e.context_id
      WHERE e.id = guardrails.endeavor_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "guardrails_insert" ON guardrails
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

CREATE POLICY "guardrails_update" ON guardrails
  FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = guardrails.context_id
      AND cm.user_id = auth.uid()
    )
  );

-- Candidates: same pattern
CREATE POLICY "metis_candidates_all" ON metis_candidates
  FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = metis_candidates.context_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "guardrail_candidates_all" ON guardrail_candidates
  FOR ALL USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = guardrail_candidates.context_id
      AND cm.user_id = auth.uid()
    )
  );

-------------------------------------------------------------------------------
-- HELPER FUNCTIONS
-------------------------------------------------------------------------------

-- Get all active guardrails for an endeavor (including inherited from ancestors)
CREATE OR REPLACE FUNCTION get_endeavor_guardrails(p_endeavor_id TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  severity TEXT,
  enforcement TEXT,
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

-- Get compressed metis summary for an endeavor
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
  SELECT id, parent_id, context_id, 0 as depth
  FROM endeavors
  WHERE id = p_endeavor_id

  UNION ALL

  SELECT e.id, e.parent_id, e.context_id, ea.depth + 1
  FROM endeavors e
  JOIN endeavor_ancestors ea ON e.id = ea.parent_id
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
