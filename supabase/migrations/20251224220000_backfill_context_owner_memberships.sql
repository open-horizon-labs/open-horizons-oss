-- Backfill context_memberships for context owners
-- Fixes RLS issue where context owners can't access their own contexts/endeavors
-- because the membership entry is missing (contexts created before auto-membership code)

-- Insert membership for each context owner who doesn't already have one
INSERT INTO context_memberships (context_id, user_id)
SELECT c.id, c.created_by
FROM contexts c
WHERE c.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM context_memberships cm
    WHERE cm.context_id = c.id
    AND cm.user_id = c.created_by
  );

-- Log how many were added (visible in migration output)
DO $$
DECLARE
  count_added INTEGER;
BEGIN
  GET DIAGNOSTICS count_added = ROW_COUNT;
  RAISE NOTICE 'Backfilled % context owner memberships', count_added;
END $$;
