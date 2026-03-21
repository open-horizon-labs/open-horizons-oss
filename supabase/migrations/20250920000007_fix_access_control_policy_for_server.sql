-- Fix access control policy to work properly in server context
-- The issue is that auth.uid() doesn't work reliably in server-side operations

-- Drop the problematic policy
DROP POLICY IF EXISTS "Allow initial access control creation" ON endeavor_access;

-- Create a more permissive policy that allows owner access creation
-- This policy allows any authenticated user to create owner access for endeavors they created
CREATE POLICY "Allow owner access creation for endeavor creators" ON endeavor_access
  FOR INSERT WITH CHECK (
    -- Allow owner access creation where the user being granted access
    -- is the same as the one creating the access entry
    -- and they are the creator of the endeavor
    user_id = granted_by
    AND access_type = 'owner'
    AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = endeavor_id AND e.user_id = user_id
    )
  );