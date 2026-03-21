-- Add metadata JSONB column to api_keys table
-- This supports enhanced API key features like permissions, environment, description, etc.

ALTER TABLE api_keys
ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS idx_api_keys_metadata ON api_keys USING gin(metadata);

-- Update existing records to have empty metadata object
UPDATE api_keys
SET metadata = '{}'::jsonb
WHERE metadata IS NULL;

-- Add constraint to ensure metadata is always an object (not null)
ALTER TABLE api_keys
ADD CONSTRAINT api_keys_metadata_not_null CHECK (metadata IS NOT NULL);