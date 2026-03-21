-- Fix the second recursive policy on context_memberships
-- The "Context owners can manage memberships" policy also has infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Context owners can manage memberships" ON context_memberships;

-- Create a new non-recursive policy that checks ownership through contexts table
CREATE POLICY "Context owners can manage memberships" ON context_memberships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM contexts c
      WHERE c.id = context_id AND c.created_by = auth.uid()
    )
  );