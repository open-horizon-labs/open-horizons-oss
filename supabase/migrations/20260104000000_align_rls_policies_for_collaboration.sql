-- Align RLS policies across all entity types for consistent collaboration access
--
-- PROBLEM: Different entities have inconsistent RLS policies:
-- - endeavors: includes context owners ✓
-- - metis_entries, guardrails, dive_packs, edges: only check context_memberships ✗
-- - edges helper function uses wrong column (user_id instead of created_by)
--
-- SOLUTION: Create a reusable helper function and update all policies to use it.
-- This ensures future entities can use the same function for consistency.

BEGIN;

-------------------------------------------------------------------------------
-- HELPER FUNCTION: Unified access check for collaboration
--
-- Returns TRUE if user has access to an endeavor via:
-- 1. User created the endeavor (created_by)
-- 2. User is a member of the endeavor's context (context_memberships)
-- 3. User owns the context (contexts.created_by)
--
-- USE THIS FUNCTION for all RLS policies on entities related to endeavors.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_has_endeavor_access(p_user_id UUID, p_endeavor_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM endeavors e
    LEFT JOIN context_memberships cm ON cm.context_id = e.context_id AND cm.user_id = p_user_id
    LEFT JOIN contexts c ON c.id = e.context_id
    WHERE e.id = p_endeavor_id
      AND (
        e.created_by = p_user_id                    -- User created the endeavor
        OR e.context_id = 'personal:' || p_user_id  -- Personal context
        OR cm.user_id IS NOT NULL                   -- Context member
        OR c.created_by = p_user_id                 -- Context owner
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION user_has_endeavor_access(UUID, TEXT) IS
'Unified access check for collaboration. Use in RLS policies for any entity related to endeavors.
Returns TRUE if user: created the endeavor, owns the context, or is a context member.';

-------------------------------------------------------------------------------
-- HELPER FUNCTION: Check if user has access to a context
--
-- Returns TRUE if user has access to a context via:
-- 1. User owns the context (contexts.created_by)
-- 2. User is a member of the context (context_memberships)
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION user_has_context_access(p_user_id UUID, p_context_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    -- Personal context
    p_context_id = 'personal:' || p_user_id
    OR
    -- Context owner
    EXISTS (
      SELECT 1 FROM contexts c
      WHERE c.id = p_context_id
      AND c.created_by = p_user_id
    )
    OR
    -- Context member
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = p_context_id
      AND cm.user_id = p_user_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_has_context_access(UUID, TEXT) IS
'Check if user has access to a context. Use for entities with direct context_id FK.
Returns TRUE if user: owns the context or is a context member.';

-------------------------------------------------------------------------------
-- FIX: EDGES RLS (was using wrong column and missing context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "edges_select" ON edges;
DROP POLICY IF EXISTS "edges_insert" ON edges;
DROP POLICY IF EXISTS "edges_delete" ON edges;

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
-- FIX: METIS_ENTRIES RLS (add context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "metis_read" ON metis_entries;

CREATE POLICY "metis_read" ON metis_entries
  FOR SELECT USING (
    created_by = auth.uid()
    OR user_has_context_access(auth.uid(), context_id)
    OR user_has_endeavor_access(auth.uid(), endeavor_id)
  );

-------------------------------------------------------------------------------
-- FIX: GUARDRAILS RLS (add context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "guardrails_read" ON guardrails;
DROP POLICY IF EXISTS "guardrails_update" ON guardrails;

CREATE POLICY "guardrails_read" ON guardrails
  FOR SELECT USING (
    created_by = auth.uid()
    OR user_has_context_access(auth.uid(), context_id)
    OR user_has_endeavor_access(auth.uid(), endeavor_id)
  );

CREATE POLICY "guardrails_update" ON guardrails
  FOR UPDATE USING (
    created_by = auth.uid()
    OR user_has_context_access(auth.uid(), context_id)
  );

-------------------------------------------------------------------------------
-- FIX: METIS_CANDIDATES RLS (add context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "metis_candidates_all" ON metis_candidates;

CREATE POLICY "metis_candidates_all" ON metis_candidates
  FOR ALL USING (
    created_by = auth.uid()
    OR user_has_context_access(auth.uid(), context_id)
  );

-------------------------------------------------------------------------------
-- FIX: GUARDRAIL_CANDIDATES RLS (add context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "guardrail_candidates_all" ON guardrail_candidates;

CREATE POLICY "guardrail_candidates_all" ON guardrail_candidates
  FOR ALL USING (
    created_by = auth.uid()
    OR user_has_context_access(auth.uid(), context_id)
  );

-------------------------------------------------------------------------------
-- FIX: DIVE_PACKS RLS (add context owner check)
-------------------------------------------------------------------------------

DROP POLICY IF EXISTS "dive_packs_read_shared" ON dive_packs;

-- Users can read packs for endeavors in contexts they have access to
CREATE POLICY "dive_packs_read_shared" ON dive_packs
  FOR SELECT USING (
    user_has_endeavor_access(auth.uid(), primary_endeavor_id)
  );

COMMIT;
