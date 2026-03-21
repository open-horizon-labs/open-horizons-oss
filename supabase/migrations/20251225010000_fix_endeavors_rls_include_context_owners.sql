-- Fix RLS policy to include context owners (not just members)
-- Context owners should be able to access all endeavors in their contexts
-- even if they don't have an explicit context_memberships entry

-- Drop existing policy
DROP POLICY IF EXISTS "endeavors_context_access" ON endeavors;

-- Create updated policy that includes context owners
CREATE POLICY "endeavors_context_access" ON endeavors
  FOR ALL USING (
    -- User created the endeavor
    created_by = auth.uid()
    OR
    -- User is a member of the endeavor's context
    EXISTS (
      SELECT 1 FROM context_memberships cm
      WHERE cm.context_id = endeavors.context_id
      AND cm.user_id = auth.uid()
    )
    OR
    -- User owns the context the endeavor belongs to
    EXISTS (
      SELECT 1 FROM contexts c
      WHERE c.id = endeavors.context_id
      AND c.created_by = auth.uid()
    )
  );
