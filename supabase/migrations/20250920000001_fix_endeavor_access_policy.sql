-- Fix endeavor access policy to allow creators to grant initial access
-- This addresses the chicken-and-egg problem where users can't grant access to endeavors
-- they just created because they don't have access records yet

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can grant access to endeavors they own" ON endeavor_access;

DROP POLICY IF EXISTS "Users can grant access to endeavors they own or created" ON endeavor_access;
-- Create new policy that allows:
-- 1. Users to grant access to endeavors they have access to (existing behavior)
-- 2. Users to grant access to endeavors they created (new behavior for initial access)
CREATE POLICY "Users can grant access to endeavors they own or created" ON endeavor_access
  FOR INSERT WITH CHECK (
    auth.uid() = granted_by AND (
      -- Allow if user already has owner access (existing behavior)
      has_endeavor_access(auth.uid(), endeavor_id, 'owner')
      OR
      -- Allow if user is the creator of the endeavor (new behavior for initial access)
      EXISTS (
        SELECT 1 FROM endeavors e
        WHERE e.id = endeavor_id AND e.user_id = auth.uid()
      )
    )
  );
