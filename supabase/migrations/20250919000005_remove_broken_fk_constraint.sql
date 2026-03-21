-- Remove the broken foreign key constraint that was added in the previous migration
-- This allows us to clean up orphaned data properly

-- Drop the foreign key constraint that's causing issues
ALTER TABLE context_invitations
DROP CONSTRAINT IF EXISTS context_invitations_context_id_fkey;

-- Remove any invitations that reference non-existent contexts
DELETE FROM context_invitations
WHERE context_id NOT IN (
  SELECT id FROM contexts
);

-- Add the foreign key constraint back properly
ALTER TABLE context_invitations
ADD CONSTRAINT context_invitations_context_id_fkey
FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE;