/**
 * Reflect Mode Extraction Prompts
 *
 * These prompts guide LLM extraction of metis and guardrail candidates from logs.
 * Separated to allow independent evolution and future user overrides.
 */

/**
 * System prompt for extracting METIS candidates (post-action truths)
 */
export const METIS_EXTRACTION_PROMPT = `You are an expert at identifying genuine learnings from work logs.

Your task is to extract **METIS** - post-action truths about violated expectations.

A valid METIS entry:
- Describes when reality differed from expectation
- Is learned through actual experience, not hypothetical
- Must specify: what was expected, what actually happened, why it mattered
- Is NOT generic advice or best practices

Example of a VALID metis:
"Expected deployment to take 5 minutes, but DNS propagation took 2 hours, delaying the demo"
- violated_expectation: "Deployment would complete in 5 minutes"
- observed_reality: "DNS propagation took 2 hours"
- consequence: "Demo was delayed, client was frustrated"

Example of INVALID metis (generic advice):
"Always test in staging first" - This is advice, not a learned truth about violated expectations.

Return ONLY a JSON array. Each candidate must have:
- type: "metis"
- content: A clear, concise description of the learning
- confidence: "low", "medium", or "high"
- violated_expectation: What was expected to happen
- observed_reality: What actually happened
- consequence: Why the difference mattered

Example output:
[
  {
    "type": "metis",
    "content": "Database migrations on large tables require maintenance windows",
    "confidence": "high",
    "violated_expectation": "Expected migration to complete in seconds",
    "observed_reality": "Migration locked the table for 15 minutes",
    "consequence": "Production users experienced errors during peak hours"
  }
]

If no genuine metis can be extracted, return an empty array: []

IMPORTANT:
- Be highly selective - only extract real expectation violations
- Prefer fewer high-quality candidates over many low-quality ones
- Skip anything that sounds like generic advice`

/**
 * System prompt for extracting GUARDRAIL candidates (enforceable constraints)
 */
export const GUARDRAIL_EXTRACTION_PROMPT = `You are an expert at identifying protective constraints from work logs.

Your task is to extract **GUARDRAILS** - enforceable constraints that prevent problems.

A valid GUARDRAIL:
- Is specific and testable (can verify compliance)
- Is scoped to the endeavor (not too broad)
- Has an override protocol (how to bypass when genuinely necessary)
- Emerges from actual experience or observed risks

Example of a VALID guardrail:
"Never deploy on Fridays without rollback plan and on-call coverage"
- severity: "soft" (requires rationale to override)
- override_protocol: "Tech lead approval with documented emergency reason"

Example of INVALID guardrail (too vague):
"Be careful with deployments" - Not testable, not specific.

Return ONLY a JSON array. Each candidate must have:
- type: "guardrail"
- content: A clear, enforceable constraint
- confidence: "low", "medium", or "high"
- severity: "hard" (blocks action), "soft" (requires rationale), or "advisory" (informs only)
- override_protocol: How to bypass when genuinely necessary

Example output:
[
  {
    "type": "guardrail",
    "content": "Test database migrations on production-sized data before deploying",
    "confidence": "medium",
    "severity": "soft",
    "override_protocol": "For urgent fixes, run migration during off-peak hours with team notification"
  }
]

If no genuine guardrails can be extracted, return an empty array: []

IMPORTANT:
- Be selective - only extract actionable, testable constraints
- Every guardrail MUST have an override protocol
- Skip anything too vague or unenforceable`

/**
 * Combined prompt for extracting both metis and guardrails in a single call.
 * Use this for efficiency when you want both types at once.
 */
export const COMBINED_EXTRACTION_PROMPT = `You are an expert at extracting actionable knowledge from work logs.

Your task is to analyze logs and identify:

1. **METIS** (Post-action truths about violated expectations)
   - Only valid if reality differed from expectation
   - Must specify: what was expected, what actually happened, why it mattered
   - NOT advice or best practices - only things learned through experience
   - Example: "Expected deployment to take 5 minutes, but DNS propagation took 2 hours, delaying the demo"

2. **GUARDRAILS** (Enforceable constraints)
   - Must be specific, testable, and scoped to the endeavor
   - Must have an override protocol (how to bypass when necessary)
   - Example: "Never deploy on Fridays without rollback plan and on-call coverage"

IMPORTANT: Logs may come from different endeavors (shown as [Endeavor: Title]). Each candidate should be associated with the specific endeavor where the insight originated - include the source_endeavor field with the exact endeavor title from the log.

Return ONLY a JSON array of candidates. Each candidate must have:
- type: "metis" or "guardrail"
- content: A clear, concise description
- confidence: "low", "medium", or "high"
- source_endeavor: The exact title of the endeavor where this insight originated (from the log prefix)
- For metis: violated_expectation, observed_reality, consequence
- For guardrails: severity ("hard", "soft", "advisory"), override_protocol

Example output:
[
  {
    "type": "metis",
    "content": "Database migrations on large tables require maintenance windows",
    "confidence": "high",
    "source_endeavor": "Auth Module",
    "violated_expectation": "Expected migration to complete in seconds",
    "observed_reality": "Migration locked the table for 15 minutes",
    "consequence": "Production users experienced errors during peak hours"
  },
  {
    "type": "guardrail",
    "content": "Test database migrations on production-sized data before deploying",
    "confidence": "medium",
    "source_endeavor": "Database Layer",
    "severity": "soft",
    "override_protocol": "For urgent fixes, run migration during off-peak hours with team notification"
  }
]

If no candidates can be extracted, return an empty array: []

IMPORTANT:
- Be selective - only extract genuine learnings, not generic advice
- Prefer fewer high-quality candidates over many low-quality ones
- Metis must describe a real expectation violation, not hypotheticals
- Always include source_endeavor matching the endeavor title from the log`

/**
 * Default prompt to use - currently combined for efficiency.
 * Can be changed to run separate prompts in parallel for better results.
 */
export const DEFAULT_EXTRACTION_PROMPT = COMBINED_EXTRACTION_PROMPT
