-- Implement proper context-aware access control for endeavor creation
-- This supports both personal endeavors and context-based endeavors

-- Drop the current policy
DROP POLICY IF EXISTS "Allow owner access creation for endeavor creators" ON endeavor_access;

-- Create a comprehensive policy that supports both personal and context-based access
CREATE POLICY "Allow access control creation for endeavor creators" ON endeavor_access
  FOR INSERT WITH CHECK (
    -- Allow access control creation where:
    user_id = granted_by AND (
      -- Case 1: Personal endeavor access - user owns the endeavor directly
      (access_type = 'owner' AND granted_via = 'personal' AND EXISTS (
        SELECT 1 FROM endeavors e
        WHERE e.id = endeavor_access.endeavor_id AND e.user_id = endeavor_access.user_id
      ))
      OR
      -- Case 2: Context-based endeavor access - user has membership in the context
      (granted_via LIKE 'context:%' AND EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = SUBSTRING(endeavor_access.granted_via FROM 9) -- Extract context ID from 'context:{id}'
          AND cm.user_id = endeavor_access.user_id
      ))
    )
  );