-- Fix infinite recursion in context_memberships RLS policies
-- The original policy has a recursive dependency that causes infinite loops

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view memberships in their contexts" ON context_memberships;

-- Create a new non-recursive policy
-- Users can view their own membership records OR memberships in contexts they own
CREATE POLICY "Users can view context memberships" ON context_memberships
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM contexts c
      WHERE c.id = context_id AND c.created_by = auth.uid()
    )
  );