-- Restore edges table for unified graph model
-- All relationships (including parent-child) are stored as edges
-- This enables cross-context connections and arbitrary relationship types

BEGIN;

-------------------------------------------------------------------------------
-- EDGES TABLE
-- Unified storage for all relationships between endeavors
-------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Endpoints (both required)
  from_endeavor_id TEXT NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,
  to_endeavor_id TEXT NOT NULL REFERENCES endeavors(id) ON DELETE CASCADE,

  -- Relationship type
  -- 'contains' = parent-child (replaces parent_id column)
  -- 'relates_to' = general association
  -- 'references' = one mentions/links to the other
  -- 'blocks' = one blocks progress on the other
  -- 'enables' = one enables/unblocks the other
  relationship TEXT NOT NULL,

  -- Optional metadata
  weight REAL DEFAULT 1.0,           -- Strength/importance of relationship
  context TEXT,                       -- Additional qualifier
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Ownership and timestamps
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT edges_no_self_reference CHECK (from_endeavor_id != to_endeavor_id),
  CONSTRAINT edges_unique_relationship UNIQUE (from_endeavor_id, to_endeavor_id, relationship)
);

-- Indexes for common queries
CREATE INDEX idx_edges_from ON edges(from_endeavor_id);
CREATE INDEX idx_edges_to ON edges(to_endeavor_id);
CREATE INDEX idx_edges_relationship ON edges(relationship);
CREATE INDEX idx_edges_contains ON edges(from_endeavor_id, to_endeavor_id) WHERE relationship = 'contains';

-------------------------------------------------------------------------------
-- RLS POLICIES
-- User can see/create edges if they have access to BOTH endpoints
-------------------------------------------------------------------------------

ALTER TABLE edges ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user has access to an endeavor
CREATE OR REPLACE FUNCTION user_has_endeavor_access(p_user_id UUID, p_endeavor_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM endeavors e
    LEFT JOIN context_memberships cm ON cm.context_id = e.context_id AND cm.user_id = p_user_id
    WHERE e.id = p_endeavor_id
      AND (
        e.user_id = p_user_id                          -- Owner
        OR e.context_id = 'personal:' || p_user_id     -- Personal context
        OR cm.user_id IS NOT NULL                      -- Context member
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Read: can see edges where user has access to both endpoints
CREATE POLICY "edges_select" ON edges
  FOR SELECT USING (
    user_has_endeavor_access(auth.uid(), from_endeavor_id)
    AND user_has_endeavor_access(auth.uid(), to_endeavor_id)
  );

-- Insert: can create edges where user has access to both endpoints
CREATE POLICY "edges_insert" ON edges
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND user_has_endeavor_access(auth.uid(), from_endeavor_id)
    AND user_has_endeavor_access(auth.uid(), to_endeavor_id)
  );

-- Delete: can delete edges user created, or where user has access to both endpoints
CREATE POLICY "edges_delete" ON edges
  FOR DELETE USING (
    created_by = auth.uid()
    OR (
      user_has_endeavor_access(auth.uid(), from_endeavor_id)
      AND user_has_endeavor_access(auth.uid(), to_endeavor_id)
    )
  );

-------------------------------------------------------------------------------
-- HELPER FUNCTIONS
-------------------------------------------------------------------------------

-- Get parent of an endeavor (via contains edge)
CREATE OR REPLACE FUNCTION get_endeavor_parent(p_endeavor_id TEXT)
RETURNS TEXT AS $$
  SELECT from_endeavor_id
  FROM edges
  WHERE to_endeavor_id = p_endeavor_id
    AND relationship = 'contains'
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- Get children of an endeavor (via contains edges)
CREATE OR REPLACE FUNCTION get_endeavor_children(p_endeavor_id TEXT)
RETURNS TABLE(endeavor_id TEXT) AS $$
  SELECT to_endeavor_id
  FROM edges
  WHERE from_endeavor_id = p_endeavor_id
    AND relationship = 'contains';
$$ LANGUAGE SQL STABLE;

-- Get all edges for an endeavor (both directions)
CREATE OR REPLACE FUNCTION get_endeavor_edges(
  p_endeavor_id TEXT,
  p_relationship TEXT DEFAULT NULL,
  p_direction TEXT DEFAULT NULL  -- 'incoming', 'outgoing', or NULL for both
)
RETURNS TABLE(
  id UUID,
  from_endeavor_id TEXT,
  to_endeavor_id TEXT,
  relationship TEXT,
  weight REAL,
  context TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ
) AS $$
  SELECT e.id, e.from_endeavor_id, e.to_endeavor_id, e.relationship,
         e.weight, e.context, e.metadata, e.created_at
  FROM edges e
  WHERE (
    (p_direction IS NULL OR p_direction = 'outgoing') AND e.from_endeavor_id = p_endeavor_id
    OR
    (p_direction IS NULL OR p_direction = 'incoming') AND e.to_endeavor_id = p_endeavor_id
  )
  AND (p_relationship IS NULL OR e.relationship = p_relationship);
$$ LANGUAGE SQL STABLE;

COMMIT;
