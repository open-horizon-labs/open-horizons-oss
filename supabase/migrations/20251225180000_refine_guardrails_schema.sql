-- Refine guardrails schema to match operational spec
-- Add override_protocol field and normalize enforcement values

-------------------------------------------------------------------------------
-- ADD OVERRIDE_PROTOCOL
-- Defines how to override this guardrail when necessary
-------------------------------------------------------------------------------

ALTER TABLE guardrails ADD COLUMN IF NOT EXISTS override_protocol TEXT;

COMMENT ON COLUMN guardrails.override_protocol IS
  'How to override this guardrail. E.g., "Document rationale in commit", "Requires tech lead approval"';

-------------------------------------------------------------------------------
-- NORMALIZE ENFORCEMENT VALUES
-- Spec requires: block, require_rationale, warn
-- Current: superego_question, checklist_gate, automated_check, human_review
-------------------------------------------------------------------------------

-- Add check constraint for new values (loose for migration compatibility)
-- Old values still allowed until data migrated

COMMENT ON COLUMN guardrails.enforcement IS
  'Enforcement type: block (hard stop), require_rationale (soft stop with documented override), warn (advisory note)';

-------------------------------------------------------------------------------
-- ADD STRUCTURED METIS FIELDS (optional, for gradual migration)
-- These support the spec's structured format without breaking existing data
-------------------------------------------------------------------------------

ALTER TABLE metis_entries ADD COLUMN IF NOT EXISTS violated_expectation TEXT;
ALTER TABLE metis_entries ADD COLUMN IF NOT EXISTS observed_reality TEXT;
ALTER TABLE metis_entries ADD COLUMN IF NOT EXISTS consequence TEXT;

COMMENT ON COLUMN metis_entries.violated_expectation IS
  'What was expected before action (spec requirement)';
COMMENT ON COLUMN metis_entries.observed_reality IS
  'What actually happened after contact with reality';
COMMENT ON COLUMN metis_entries.consequence IS
  'Why the difference mattered (cost, delay, rework)';

-------------------------------------------------------------------------------
-- ADD REJECTION TRACKING FOR CANDIDATES
-------------------------------------------------------------------------------

ALTER TABLE metis_candidates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE guardrail_candidates ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN metis_candidates.rejection_reason IS
  'Why this candidate was rejected (if status=rejected)';
COMMENT ON COLUMN guardrail_candidates.rejection_reason IS
  'Why this candidate was rejected (if status=rejected)';
