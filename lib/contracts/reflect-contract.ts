/**
 * Reflect Mode Contracts
 *
 * Zod schemas for the Reflect mode API endpoints that handle
 * metis/guardrail candidate extraction, review, and promotion.
 */

import { z } from 'zod'

// =============================================================================
// CORE TYPES
// =============================================================================

export const CandidateType = z.enum(['metis', 'guardrail'])
export type CandidateType = z.infer<typeof CandidateType>

export const CandidateStatus = z.enum(['pending', 'promoted', 'rejected', 'duplicate'])
export type CandidateStatus = z.infer<typeof CandidateStatus>

export const ConfidenceLevel = z.enum(['low', 'medium', 'high'])
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>

export const TriggerReason = z.enum(['item_threshold', 'time_threshold', 'manual', 'none'])
export type TriggerReason = z.infer<typeof TriggerReason>

export const Severity = z.enum(['hard', 'soft', 'advisory'])
export type Severity = z.infer<typeof Severity>

export const Freshness = z.enum(['recent', 'stale', 'historical'])
export type Freshness = z.infer<typeof Freshness>

// =============================================================================
// STRUCTURED FIELDS (per metis-guardrails-spec.md)
// =============================================================================

/**
 * Metis structured fields - required for promotion
 * Per spec: Must have violated_expectation, observed_reality, consequence
 */
export const MetisStructuredFields = z.object({
  violated_expectation: z.string().min(1, 'Must specify what was expected'),
  observed_reality: z.string().min(1, 'Must specify what actually happened'),
  consequence: z.string().min(1, 'Must specify why the difference mattered')
})
export type MetisStructuredFields = z.infer<typeof MetisStructuredFields>

/**
 * Guardrail structured fields - required for promotion
 * Per spec: Must be testable, scoped, enforceable with override protocol
 */
export const GuardrailStructuredFields = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  severity: Severity.default('soft'),
  enforcement: z.enum(['block', 'require_rationale', 'warn']).default('require_rationale'),
  override_protocol: z.string().min(1, 'Override protocol required - how to bypass when necessary')
})
export type GuardrailStructuredFields = z.infer<typeof GuardrailStructuredFields>

// =============================================================================
// CANDIDATE SCHEMAS
// =============================================================================

/**
 * Candidate extracted by LLM from logs
 */
export const ExtractedCandidate = z.object({
  type: CandidateType,
  content: z.string().min(10, 'Content must be substantive'),
  source_log_ids: z.array(z.string()).optional(),
  confidence: ConfidenceLevel.default('medium'),
  // Source endeavor title (LLM suggests which endeavor this belongs to)
  source_endeavor: z.string().optional(),
  // Structured metis fields (optional at extraction, required for promotion)
  violated_expectation: z.string().optional(),
  observed_reality: z.string().optional(),
  consequence: z.string().optional(),
  // Guardrail fields (optional at extraction, required for promotion)
  severity: Severity.optional(),
  override_protocol: z.string().optional()
})
export type ExtractedCandidate = z.infer<typeof ExtractedCandidate>

/**
 * Candidate from database (includes DB fields)
 */
export const StoredCandidate = z.object({
  id: z.string().uuid(),
  type: CandidateType,
  endeavor_id: z.string().nullable(),
  context_id: z.string().nullable(),
  content: z.string(),
  source_type: z.string(),
  source_id: z.string().nullable(),
  status: CandidateStatus,
  confidence: ConfidenceLevel.optional(),
  created_at: z.string(),
  // Metis fields
  violated_expectation: z.string().nullable().optional(),
  observed_reality: z.string().nullable().optional(),
  consequence: z.string().nullable().optional(),
  // Guardrail fields
  severity: Severity.nullable().optional(),
  override_protocol: z.string().nullable().optional()
})
export type StoredCandidate = z.infer<typeof StoredCandidate>

// =============================================================================
// API REQUEST SCHEMAS
// =============================================================================

/**
 * GET /api/reflect/status/[endeavorId]
 * No request body - endeavorId in URL
 */

/**
 * POST /api/reflect/extract - Generate candidates from logs
 */
export const ExtractCandidatesRequest = z.object({
  endeavor_id: z.string().min(1, 'endeavor_id required'),
  include_children: z.boolean().default(true),
  include_parent: z.boolean().default(true),
  include_siblings: z.boolean().default(true)
})
export type ExtractCandidatesRequest = z.infer<typeof ExtractCandidatesRequest>

/**
 * POST /api/reflect/promote - Promote candidate to metis/guardrail
 */
export const PromoteCandidateRequest = z.object({
  candidate_id: z.string().uuid(),
  type: CandidateType,
  // For metis - required on promotion
  title: z.string().min(1).optional(),
  violated_expectation: z.string().optional(),
  observed_reality: z.string().optional(),
  consequence: z.string().optional(),
  confidence: ConfidenceLevel.optional(),
  // For guardrails - required on promotion
  description: z.string().optional(),
  severity: Severity.optional(),
  enforcement: z.enum(['block', 'require_rationale', 'warn']).optional(),
  override_protocol: z.string().optional()
}).refine(
  (data) => {
    if (data.type === 'metis') {
      return data.title && data.violated_expectation && data.observed_reality && data.consequence
    }
    if (data.type === 'guardrail') {
      return data.title && data.override_protocol
    }
    return false
  },
  {
    message: 'Metis requires title, violated_expectation, observed_reality, consequence. Guardrail requires title, override_protocol.'
  }
)
export type PromoteCandidateRequest = z.infer<typeof PromoteCandidateRequest>

/**
 * POST /api/reflect/reject - Reject a candidate
 */
export const RejectCandidateRequest = z.object({
  candidate_id: z.string().uuid(),
  type: CandidateType,
  reason: z.string().min(1, 'Rejection reason required')
})
export type RejectCandidateRequest = z.infer<typeof RejectCandidateRequest>

/**
 * POST /api/reflect/complete - Mark review session complete
 */
export const CompleteReviewRequest = z.object({
  endeavor_id: z.string().min(1, 'endeavor_id required')
})
export type CompleteReviewRequest = z.infer<typeof CompleteReviewRequest>

// =============================================================================
// API RESPONSE SCHEMAS
// =============================================================================

/**
 * GET /api/reflect/status/[endeavorId] response
 */
export const ReviewStatusResponse = z.object({
  endeavor_id: z.string(),
  pending_candidates: z.number().int(),
  logs_since_review: z.number().int(),
  days_since_review: z.number().nullable(),
  last_reviewed_at: z.string().nullable(),
  should_trigger: z.boolean(),
  trigger_reason: TriggerReason
})
export type ReviewStatusResponse = z.infer<typeof ReviewStatusResponse>

/**
 * POST /api/reflect/extract response
 */
export const ExtractCandidatesResponse = z.object({
  success: z.boolean(),
  candidates_created: z.number().int(),
  candidates: z.array(StoredCandidate),
  tokens_used: z.number().int().optional(),
  logs_processed: z.number().int()
})
export type ExtractCandidatesResponse = z.infer<typeof ExtractCandidatesResponse>

/**
 * POST /api/reflect/promote response
 */
export const PromoteCandidateResponse = z.object({
  success: z.boolean(),
  promoted_id: z.string().uuid(),
  type: CandidateType
})
export type PromoteCandidateResponse = z.infer<typeof PromoteCandidateResponse>

/**
 * POST /api/reflect/reject response
 */
export const RejectCandidateResponse = z.object({
  success: z.boolean(),
  candidate_id: z.string().uuid()
})
export type RejectCandidateResponse = z.infer<typeof RejectCandidateResponse>

/**
 * POST /api/reflect/complete response
 */
export const CompleteReviewResponse = z.object({
  success: z.boolean(),
  endeavor_id: z.string(),
  last_reviewed_at: z.string()
})
export type CompleteReviewResponse = z.infer<typeof CompleteReviewResponse>

/**
 * GET /api/reflect/tree/[endeavorId] response
 * Returns candidates grouped by descendant endeavors
 */
export const EndeavorWithCandidates = z.object({
  endeavor: z.object({
    id: z.string(),
    title: z.string(),
    node_type: z.string(),
    parent_id: z.string().nullable()
  }),
  pending_count: z.number().int(),
  candidates: z.array(StoredCandidate)
})
export type EndeavorWithCandidates = z.infer<typeof EndeavorWithCandidates>

export const CandidateTreeResponse = z.object({
  root_endeavor_id: z.string(),
  total_pending: z.number().int(),
  endeavors_with_candidates: z.array(EndeavorWithCandidates)
})
export type CandidateTreeResponse = z.infer<typeof CandidateTreeResponse>

/**
 * GET /api/reflect/knowledge/[endeavorId] response
 */
export const ActiveKnowledgeResponse = z.object({
  endeavor_id: z.string(),
  metis: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    content: z.string(),
    confidence: ConfidenceLevel,
    freshness: Freshness,
    violated_expectation: z.string().nullable(),
    observed_reality: z.string().nullable(),
    consequence: z.string().nullable(),
    created_at: z.string()
  })),
  guardrails: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    description: z.string().nullable(),
    severity: z.string(),
    enforcement: z.string(),
    override_protocol: z.string().nullable(),
    created_at: z.string()
  })),
  pending_candidates: z.array(StoredCandidate)
})
export type ActiveKnowledgeResponse = z.infer<typeof ActiveKnowledgeResponse>

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export class ReflectContractViolationError extends Error {
  public details?: unknown
  constructor(message: string, details?: unknown) {
    super(message)
    this.name = 'ReflectContractViolationError'
    this.details = details
  }
}

export function validateExtractRequest(data: unknown): ExtractCandidatesRequest {
  const result = ExtractCandidatesRequest.safeParse(data)
  if (!result.success) {
    throw new ReflectContractViolationError('Invalid extract request', result.error.issues)
  }
  return result.data
}

export function validatePromoteRequest(data: unknown): PromoteCandidateRequest {
  const result = PromoteCandidateRequest.safeParse(data)
  if (!result.success) {
    throw new ReflectContractViolationError('Invalid promote request', result.error.issues)
  }
  return result.data
}

export function validateRejectRequest(data: unknown): RejectCandidateRequest {
  const result = RejectCandidateRequest.safeParse(data)
  if (!result.success) {
    throw new ReflectContractViolationError('Invalid reject request', result.error.issues)
  }
  return result.data
}

export function validateCompleteRequest(data: unknown): CompleteReviewRequest {
  const result = CompleteReviewRequest.safeParse(data)
  if (!result.success) {
    throw new ReflectContractViolationError('Invalid complete request', result.error.issues)
  }
  return result.data
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Number of pending items that triggers a review session */
export const ITEM_THRESHOLD = 5

/** Number of days since last review that triggers a session */
export const DAY_THRESHOLD = 3
