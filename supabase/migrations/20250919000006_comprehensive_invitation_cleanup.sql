-- Comprehensive cleanup of orphaned invitations
-- This migration removes the broken foreign key constraint and cleans up all orphaned data

-- First, drop the problematic foreign key constraint that was just added
ALTER TABLE context_invitations
DROP CONSTRAINT IF EXISTS context_invitations_context_id_fkey;

-- Remove ALL invitations that reference non-existent contexts
-- Since we just created the contexts table, it's likely empty, so this removes all orphaned invitations
DELETE FROM context_invitations
WHERE context_id NOT IN (
    SELECT id FROM contexts
);

-- For safety, also remove any invitations with malformed context IDs
DELETE FROM context_invitations
WHERE context_id IS NULL
   OR context_id = ''
   OR NOT (context_id LIKE 'context:%');

-- Now safely add the foreign key constraint back
ALTER TABLE context_invitations
ADD CONSTRAINT context_invitations_context_id_fkey
FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE;