-- Fix endeavor_access schema for single-context model

-- 1. Add context_id column to endeavor_access table
ALTER TABLE endeavor_access
ADD COLUMN IF NOT EXISTS context_id text REFERENCES contexts(id) ON DELETE CASCADE;

-- 2. Update existing endeavor_access entries to populate context_id from granted_via
-- For personal contexts: granted_via = 'personal:user_id' -> context_id = 'personal:user_id'
-- For other contexts: granted_via = 'context:context_id' -> context_id = 'context_id'
UPDATE endeavor_access
SET context_id = CASE
  WHEN granted_via LIKE 'personal:%' THEN granted_via
  WHEN granted_via LIKE 'context:%' THEN SUBSTRING(granted_via FROM 9) -- Remove 'context:' prefix
  ELSE NULL -- Keep NULL for other grant types like 'direct', 'invitation:token'
END
WHERE context_id IS NULL;

-- 3. Create index for better performance on context_id lookups
CREATE INDEX IF NOT EXISTS idx_endeavor_access_context_id ON endeavor_access(context_id);
CREATE INDEX IF NOT EXISTS idx_endeavor_access_user_context ON endeavor_access(user_id, context_id);

-- 4. Add helpful comments
COMMENT ON COLUMN endeavor_access.context_id IS 'The context where this endeavor access grant applies (single-context model)';
COMMENT ON INDEX idx_endeavor_access_context_id IS 'Performance index for context-based endeavor access queries';
COMMENT ON INDEX idx_endeavor_access_user_context IS 'Performance index for user-context endeavor access queries';