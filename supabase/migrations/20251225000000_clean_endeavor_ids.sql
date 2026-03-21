-- Migration: Clean up endeavor IDs to plain UUIDs
-- Old format: type:uuid:timestamp-random (e.g., mission:fc249f8a-...:1759174655862-1c42468f)
-- New format: plain UUID (e.g., a1b2c3d4-e5f6-7890-abcd-ef1234567890)
--
-- Tables with references to endeavors(id):
-- - endeavors.parent_id (FK)
-- - logs.entity_id (no FK, stores endeavor IDs when entity_type='endeavor')
--
-- Note: endeavor_access, role_assertions, and edges tables were dropped in earlier migrations

BEGIN;

-- Step 1: Drop FK constraint to allow ID updates
ALTER TABLE endeavors DROP CONSTRAINT IF EXISTS endeavors_parent_id_fkey;

-- Step 2: Create mapping table for old -> new IDs
-- Only IDs containing colons need migration
CREATE TEMP TABLE id_mapping AS
SELECT id as old_id, gen_random_uuid()::text as new_id
FROM endeavors WHERE id LIKE '%:%';

-- Step 3: Update FK columns BEFORE updating the primary key

-- endeavors.parent_id
UPDATE endeavors SET parent_id = m.new_id
FROM id_mapping m WHERE endeavors.parent_id = m.old_id;

-- logs.entity_id (no FK but stores endeavor IDs when entity_type='endeavor')
UPDATE logs SET entity_id = m.new_id
FROM id_mapping m WHERE logs.entity_id = m.old_id AND logs.entity_type = 'endeavor';

-- Step 4: Update the endeavor IDs themselves (primary key)
UPDATE endeavors SET id = m.new_id
FROM id_mapping m WHERE endeavors.id = m.old_id;

-- Step 5: Re-add FK constraint
ALTER TABLE endeavors
ADD CONSTRAINT endeavors_parent_id_fkey
FOREIGN KEY (parent_id) REFERENCES endeavors(id) ON DELETE SET NULL;

-- Step 6: Verify data integrity
DO $$
BEGIN
  -- Check for orphaned parent_id references
  IF EXISTS (
    SELECT 1 FROM endeavors
    WHERE parent_id IS NOT NULL
    AND parent_id NOT IN (SELECT id FROM endeavors)
  ) THEN
    RAISE EXCEPTION 'Migration failed: orphaned parent_id references detected';
  END IF;

  -- Check that no old-format IDs remain
  IF EXISTS (
    SELECT 1 FROM endeavors WHERE id LIKE '%:%'
  ) THEN
    RAISE EXCEPTION 'Migration failed: old-format IDs still exist';
  END IF;
END $$;

COMMIT;

COMMENT ON TABLE endeavors IS 'Endeavor IDs are plain UUIDs as of 2025-12-25. Old format (type:user:timestamp) migrated.';
