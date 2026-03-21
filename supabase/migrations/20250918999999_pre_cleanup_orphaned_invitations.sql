-- Pre-cleanup migration to remove orphaned invitation data
-- This must run BEFORE the access control foundation migration
-- to prevent foreign key constraint violations

-- Remove any invitations that reference contexts that don't exist in the endeavors table
-- Since contexts were previously stored as endeavors with role='context'
DELETE FROM context_invitations
WHERE context_id NOT IN (
  SELECT id FROM endeavors
  WHERE id IN (
    SELECT endeavor_id FROM role_assertions
    WHERE role = 'context'
  )
);

-- Also remove any completely invalid context_id formats
DELETE FROM context_invitations
WHERE context_id NOT LIKE 'context:%';