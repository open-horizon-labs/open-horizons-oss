-- Fix array parsing issues in context migration
-- The sharedEndeavors field contains JSON strings that need proper parsing

-- First, let's handle the context migration more carefully
INSERT INTO contexts (id, created_by, title, description, root_endeavor_ids, ui_config)
SELECT
  e.id,
  e.user_id,
  e.title,
  e.description,
  -- Parse the JSON array string properly
  CASE
    WHEN e.metadata->>'sharedEndeavors' IS NULL THEN ARRAY[]::text[]
    WHEN e.metadata->>'sharedEndeavors' = '[]' THEN ARRAY[]::text[]
    ELSE
      -- Convert JSON array to PostgreSQL array
      ARRAY(
        SELECT json_array_elements_text(
          (e.metadata->>'sharedEndeavors')::json
        )
      )
  END as root_endeavor_ids,
  COALESCE(
    jsonb_build_object(
      'typeMappings', COALESCE(e.metadata->'typeMappings', '{}'::jsonb),
      'labels', COALESCE(e.metadata->'labels', '{}'::jsonb),
      'rituals', COALESCE(e.metadata->'rituals', '{}'::jsonb)
    ),
    '{}'::jsonb
  ) as ui_config
FROM endeavors e
JOIN role_assertions ra ON ra.endeavor_id = e.id
WHERE ra.role = 'context'
  AND NOT EXISTS (
    SELECT 1 FROM contexts c WHERE c.id = e.id
  )
ON CONFLICT (id) DO NOTHING;