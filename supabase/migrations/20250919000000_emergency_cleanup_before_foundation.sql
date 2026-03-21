-- Emergency cleanup before access control foundation migration
-- This removes ALL orphaned invitation data that would cause foreign key violations

-- Drop any existing foreign key constraints on context_invitations
ALTER TABLE context_invitations
DROP CONSTRAINT IF EXISTS context_invitations_context_id_fkey;

-- Remove all invitation records that reference non-existent contexts
-- This is safe because we're about to rebuild the entire context system
DELETE FROM context_invitations;