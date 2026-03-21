-- Add reflection tracking to endeavors table
-- last_reviewed_at tracks when metis/guardrail candidates were last processed for this endeavor
-- Used for review session triggers (5+ items OR 3+ days since last review)

ALTER TABLE endeavors ADD COLUMN IF NOT EXISTS last_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN endeavors.last_reviewed_at IS
  'When metis/guardrail candidates were last reviewed for this endeavor. Used for reflection session triggers.';

-- Index for efficient querying of endeavors needing review
CREATE INDEX IF NOT EXISTS idx_endeavors_last_reviewed
  ON endeavors(last_reviewed_at)
  WHERE last_reviewed_at IS NOT NULL;
