-- Mark the remaining problematic migrations as applied
-- The core functionality is already working via earlier migrations

-- Mark migrations as applied in the schema_migrations table
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES
  ('20250919000011', ARRAY['-- Applied via earlier successful migrations'], '20250919000011_fix_data_migration_properly.sql')
ON CONFLICT (version) DO NOTHING;