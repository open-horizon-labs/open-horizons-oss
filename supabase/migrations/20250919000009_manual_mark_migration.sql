-- Manually mark the problematic migration as applied without running it
-- This allows us to continue with the remaining migrations

-- Insert the migration record to mark 20250919000002 as applied
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
  '20250919000002',
  ARRAY[
    '-- Skipped due to production data format issues',
    '-- Will migrate ownership data via alternative method'
  ],
  '20250919000002_migrate_existing_data.sql'
)
ON CONFLICT (version) DO NOTHING;

-- Now do the essential ownership migration that was in the problematic migration
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT
  id as endeavor_id,
  user_id,
  'owner' as access_type,
  user_id as granted_by,
  'direct' as granted_via
FROM endeavors
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM endeavor_access ea
    WHERE ea.endeavor_id = endeavors.id
      AND ea.user_id = endeavors.user_id
      AND ea.access_type = 'owner'
      AND ea.granted_via = 'direct'
  );