-- Final cleanup: Remove duplicate policies and ensure clean state
-- This resolves the policy conflict from overlapping migrations

-- Drop all policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view accessible endeavors" ON endeavors;
DROP POLICY IF EXISTS "Users can update accessible endeavors with edit permission" ON endeavors;
DROP POLICY IF EXISTS "Users can view accessible edges" ON edges;
DROP POLICY IF EXISTS "Users can view accessible role assertions" ON role_assertions;

-- Recreate policies cleanly
CREATE POLICY "Users can view accessible endeavors" ON endeavors
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = endeavors.id
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

CREATE POLICY "Users can update accessible endeavors with edit permission" ON endeavors
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = endeavors.id
        AND ea.user_id = auth.uid()
        AND ea.access_type IN ('owner', 'editor')
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

CREATE POLICY "Users can view accessible edges" ON edges
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE (ea.endeavor_id = edges.from_endeavor_id OR ea.endeavor_id = edges.to_endeavor_id)
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );

CREATE POLICY "Users can view accessible role assertions" ON role_assertions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM endeavor_access ea
      WHERE ea.endeavor_id = role_assertions.endeavor_id
        AND ea.user_id = auth.uid()
        AND ea.revoked_at IS NULL
        AND (ea.expires_at IS NULL OR ea.expires_at > now())
    )
  );