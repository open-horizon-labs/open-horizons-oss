-- Fix the RLS policy condition that shows e.user_id = e.user_id instead of e.user_id = user_id

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Allow owner access creation for endeavor creators" ON endeavor_access;

-- Create the corrected policy with proper table qualification
CREATE POLICY "Allow owner access creation for endeavor creators" ON endeavor_access
  FOR INSERT WITH CHECK (
    -- Allow owner access creation where the user being granted access
    -- is the same as the one creating the access entry
    -- and they are the creator of the endeavor
    user_id = granted_by
    AND access_type = 'owner'
    AND EXISTS (
      SELECT 1 FROM endeavors e
      WHERE e.id = endeavor_access.endeavor_id AND e.user_id = endeavor_access.user_id
    )
  );