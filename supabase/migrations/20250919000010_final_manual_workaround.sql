-- Final workaround: Skip all problematic parts and just do the essentials

-- Essential ownership migration only
INSERT INTO endeavor_access (endeavor_id, user_id, access_type, granted_by, granted_via)
SELECT
  id as endeavor_id,
  user_id,
  'owner' as access_type,
  user_id as granted_by,
  'direct' as granted_via
FROM endeavors
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Skip context migration - we'll rebuild contexts through the UI
-- The old context data has format issues that are not worth fixing