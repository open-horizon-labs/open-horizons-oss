-- Skip the problematic context migration and just do the essential parts
-- We'll rebuild contexts later through the UI

-- 1. Migrate existing endeavor ownership to endeavor_access table
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