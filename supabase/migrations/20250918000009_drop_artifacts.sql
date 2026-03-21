-- Drop artifacts table migration
-- Remove artifacts table and related elements as it's no longer used

-- Drop trigger first (if exists)
DROP TRIGGER IF EXISTS update_artifacts_updated_at ON public.artifacts;

-- Drop function (if no other tables use it)
-- Note: Keep function as other tables might use it
-- DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_artifacts_user_id;
DROP INDEX IF EXISTS idx_artifacts_parent;
DROP INDEX IF EXISTS idx_artifacts_rdf_type;

-- Drop table
DROP TABLE IF EXISTS public.artifacts;