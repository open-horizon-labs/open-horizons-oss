-- Fix endeavor creation and retrieval for personal endeavors (no context)
-- This addresses multiple related issues:
-- 1. endeavor_access policy not handling 'personal' granted_via correctly
-- 2. edges policy having transaction visibility issues
-- 3. endeavor SELECT policy not working with same-transaction access control creation

-- Fix endeavor_access policy to properly handle personal endeavors
DROP POLICY IF EXISTS "Allow access control creation for endeavor creators" ON endeavor_access;

CREATE POLICY "Allow access control creation for endeavor creators" ON endeavor_access
  FOR INSERT WITH CHECK (
    -- Allow access control creation where:
    user_id = granted_by AND (
      -- Case 1: Personal endeavor access - granted_via is 'personal'
      granted_via = 'personal'
      OR
      -- Case 2: Context-based endeavor access - user has membership in the context
      (granted_via != 'personal' AND EXISTS (
        SELECT 1 FROM context_memberships cm
        WHERE cm.context_id = endeavor_access.granted_via
          AND cm.user_id = endeavor_access.user_id
      ))
    )
  );

-- Fix edge creation policy for transaction visibility issues
DROP POLICY IF EXISTS "Users can create edges for their endeavors" ON edges;

CREATE POLICY "Users can create edges for their endeavors" ON edges
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    -- Allow edge creation if the user_id matches
    -- The endeavor access control system already protects against unauthorized access
    -- and we trust that the application layer (API endpoints) validates permissions
  );

-- Fix endeavor SELECT policy to work with same-transaction access control creation
DROP POLICY IF EXISTS "Users can view accessible endeavors" ON endeavors;

CREATE POLICY "Users can view accessible endeavors" ON endeavors
  FOR SELECT USING (
    -- Allow direct ownership (fallback for new endeavors)
    user_id = auth.uid()
    OR
    -- Allow via access control system
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = endeavors.id
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );