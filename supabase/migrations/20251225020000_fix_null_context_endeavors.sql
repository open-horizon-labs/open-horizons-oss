-- Fix endeavors with null context_id that were created via API
-- The create API wasn't properly inheriting context_id from parent

-- These are all OH System endeavors - verified via parent_id chain
-- Set context_id and created_by for all null-context endeavors owned by this user

UPDATE endeavors
SET
  context_id = 'context:fc249f8a-92d1-46b7-855f-eb39285e774b:1758641268850',
  created_by = COALESCE(created_by, user_id, 'fc249f8a-92d1-46b7-855f-eb39285e774b'::uuid)
WHERE context_id IS NULL
  AND user_id = 'fc249f8a-92d1-46b7-855f-eb39285e774b'::uuid;
