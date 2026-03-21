-- Cleanup orphaned invitation data before applying foreign key constraints
-- This fixes the foreign key constraint violation in production

-- Remove any invitations that reference non-existent contexts
DELETE FROM context_invitations
WHERE context_id NOT IN (
  SELECT id FROM contexts
);

-- Now we can safely add the foreign key constraint
-- (This was failing in the original migration)
ALTER TABLE context_invitations
DROP CONSTRAINT IF EXISTS context_invitations_context_id_fkey;

ALTER TABLE context_invitations
ADD CONSTRAINT context_invitations_context_id_fkey
FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE;