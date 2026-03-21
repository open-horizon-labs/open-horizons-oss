-- Fix circular recursion between contexts and context_memberships tables
-- The contexts table policies reference context_memberships, creating circular dependency

-- Drop the problematic policies on contexts table
DROP POLICY IF EXISTS "Users can view contexts they're members of" ON contexts;
DROP POLICY IF EXISTS "Context owners can update contexts" ON contexts;

-- Create new non-recursive policies for contexts table
CREATE POLICY "Users can view their own contexts" ON contexts
  FOR SELECT USING (created_by = auth.uid());

-- Skip recreating "Users can create contexts" since it already exists and is correct

CREATE POLICY "Context creators can update their contexts" ON contexts
  FOR UPDATE USING (created_by = auth.uid());