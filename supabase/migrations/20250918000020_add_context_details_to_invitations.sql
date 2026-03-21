-- Add context title and description to invitations
-- This allows invitees to see context details without needing access to the context

ALTER TABLE context_invitations
ADD COLUMN context_title text,
ADD COLUMN context_description text;

-- Update existing invitations with context details (if any exist)
-- This is a one-time migration to populate existing records
UPDATE context_invitations
SET
  context_title = e.title,
  context_description = e.description
FROM endeavors e
WHERE context_invitations.context_id = e.id
  AND context_invitations.context_title IS NULL;