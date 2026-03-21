-- Drop conflicting policy that was already created by an earlier migration
-- This allows the remaining migrations to complete successfully

DROP POLICY IF EXISTS "Users can view accessible endeavors" ON endeavors;
DROP POLICY IF EXISTS "Users can update accessible endeavors with edit permission" ON endeavors;