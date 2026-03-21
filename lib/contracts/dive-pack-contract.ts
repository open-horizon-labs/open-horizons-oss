/**
 * Dive Pack Contract
 *
 * Defines the schema and validation for Dive Packs - curated grounding context
 * for working sessions. A Dive Pack is a "blanket" that wraps coherent context
 * around a dive.
 */

import { z } from 'zod'

// ============================================================================
// Core Types
// ============================================================================

export const EndeavorRefSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.string(),
  role: z.enum(['primary', 'secondary', 'reference'])
})

export const MetisRefSchema = z.object({
  id: z.string(),
  content: z.string(),
  source_endeavor_id: z.string().optional()
})

export const GuardrailRefSchema = z.object({
  id: z.string(),
  content: z.string(),
  scope: z.enum(['constitutional', 'situational']).optional()
})

export const ToolRefSchema = z.object({
  name: z.string(),
  description: z.string(),
  command: z.string().optional()
})

export const ConstitutionalContentSchema = z.object({
  mission_context: z.string(),
  standing_guardrails: z.array(z.string())
})

export const DivePackContentSchema = z.object({
  constitutional: ConstitutionalContentSchema,
  endeavors: z.array(EndeavorRefSchema).optional().default([]),
  metis: z.array(MetisRefSchema).optional().default([]),
  guardrails: z.array(GuardrailRefSchema).optional().default([]),
  tools: z.array(ToolRefSchema).optional().default([]),
  notes: z.string().optional().default('')
})

export const SourceSnapshotSchema = z.object({
  endeavor_versions: z.record(z.string(), z.string()).optional().default({}),
  metis_ids: z.array(z.string()).optional().default([]),
  guardrail_ids: z.array(z.string()).optional().default([])
})

// ============================================================================
// Request/Response Schemas
// ============================================================================

export const CreateDivePackRequestSchema = z.object({
  primary_endeavor_id: z.string().min(1, 'primary_endeavor_id is required'),
  source_snapshot: SourceSnapshotSchema,
  content: DivePackContentSchema,
  rendered_md: z.string().min(1, 'rendered_md is required')
})

export const UpdateDivePackRequestSchema = z.object({
  status: z.enum(['active', 'archived'])
})

export const DivePackResponseSchema = z.object({
  id: z.string(),
  primary_endeavor_id: z.string(),
  created_by: z.string(),
  created_at: z.string(),
  status: z.enum(['active', 'archived']),
  source_snapshot: SourceSnapshotSchema,
  content: DivePackContentSchema,
  rendered_md: z.string()
})

export const DivePackListItemSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  status: z.enum(['active', 'archived']),
  notes_preview: z.string().optional()
})

export const ListDivePacksResponseSchema = z.object({
  dive_packs: z.array(DivePackListItemSchema),
  total: z.number().optional()
})

// ============================================================================
// Dive Context Types (for pack creation)
// ============================================================================

export const DiveContextEndeavorSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  type: z.string().nullable(),
  description: z.string().nullable(),
  updated_at: z.string().nullable(),
  context_id: z.string().nullable()
})

export const DiveContextAncestorSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  type: z.string().nullable()
})

export const DiveContextMetisSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  content: z.string().nullable(),
  confidence: z.string().nullable(),
  endeavor_id: z.string().nullable()
})

export const DiveContextGuardrailSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  severity: z.string().nullable(),
  endeavor_id: z.string().nullable()
})

export const DiveContextLogSchema = z.object({
  id: z.string(),
  content: z.string().nullable(),
  log_date: z.string().nullable(),
  endeavor_id: z.string().nullable()
})

export const DiveContextResponseSchema = z.object({
  endeavor: DiveContextEndeavorSchema,
  ancestors: z.array(DiveContextAncestorSchema),
  children: z.array(DiveContextAncestorSchema),
  siblings: z.array(DiveContextAncestorSchema),
  metis: z.array(DiveContextMetisSchema),
  guardrails: z.array(DiveContextGuardrailSchema),
  recent_logs: z.array(DiveContextLogSchema)
})

// ============================================================================
// Type Exports
// ============================================================================

export type EndeavorRef = z.infer<typeof EndeavorRefSchema>
export type MetisRef = z.infer<typeof MetisRefSchema>
export type GuardrailRef = z.infer<typeof GuardrailRefSchema>
export type ToolRef = z.infer<typeof ToolRefSchema>
export type ConstitutionalContent = z.infer<typeof ConstitutionalContentSchema>
export type DivePackContent = z.infer<typeof DivePackContentSchema>
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>

export type CreateDivePackRequest = z.infer<typeof CreateDivePackRequestSchema>
export type UpdateDivePackRequest = z.infer<typeof UpdateDivePackRequestSchema>
export type DivePackResponse = z.infer<typeof DivePackResponseSchema>
export type DivePackListItem = z.infer<typeof DivePackListItemSchema>
export type ListDivePacksResponse = z.infer<typeof ListDivePacksResponseSchema>
export type DiveContextResponse = z.infer<typeof DiveContextResponseSchema>

// ============================================================================
// Validation Functions
// ============================================================================

export class DivePackContractViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DivePackContractViolationError'
  }
}

export function validateCreateDivePackRequest(data: unknown): CreateDivePackRequest {
  const result = CreateDivePackRequestSchema.safeParse(data)
  if (!result.success) {
    throw new DivePackContractViolationError(
      `Invalid create dive pack request: ${result.error.message}`
    )
  }
  return result.data
}

export function validateUpdateDivePackRequest(data: unknown): UpdateDivePackRequest {
  const result = UpdateDivePackRequestSchema.safeParse(data)
  if (!result.success) {
    throw new DivePackContractViolationError(
      `Invalid update dive pack request: ${result.error.message}`
    )
  }
  return result.data
}

export function validateDivePackResponse(data: unknown): DivePackResponse {
  const result = DivePackResponseSchema.safeParse(data)
  if (!result.success) {
    throw new DivePackContractViolationError(
      `Invalid dive pack response: ${result.error.message}`
    )
  }
  return result.data
}

export function validateListDivePacksResponse(data: unknown): ListDivePacksResponse {
  const result = ListDivePacksResponseSchema.safeParse(data)
  if (!result.success) {
    throw new DivePackContractViolationError(
      `Invalid list dive packs response: ${result.error.message}`
    )
  }
  return result.data
}

export function validateDiveContextResponse(data: unknown): DiveContextResponse {
  const result = DiveContextResponseSchema.safeParse(data)
  if (!result.success) {
    throw new DivePackContractViolationError(
      `Invalid dive context response: ${result.error.message}`
    )
  }
  return result.data
}

// ============================================================================
// Transform Functions
// ============================================================================

export function transformToDatabase(
  request: CreateDivePackRequest,
  userId: string
): Record<string, unknown> {
  return {
    primary_endeavor_id: request.primary_endeavor_id,
    created_by: userId,
    source_snapshot: request.source_snapshot,
    content: request.content,
    rendered_md: request.rendered_md,
    status: 'active'
  }
}

export function transformFromDatabase(data: Record<string, unknown>): DivePackResponse {
  return {
    id: data.id as string,
    primary_endeavor_id: data.primary_endeavor_id as string,
    created_by: data.created_by as string,
    created_at: data.created_at as string,
    status: data.status as 'active' | 'archived',
    source_snapshot: data.source_snapshot as SourceSnapshot,
    content: data.content as DivePackContent,
    rendered_md: data.rendered_md as string
  }
}

export function transformToListItem(data: Record<string, unknown>): DivePackListItem {
  const content = data.content as DivePackContent | undefined
  return {
    id: data.id as string,
    created_at: data.created_at as string,
    status: data.status as 'active' | 'archived',
    notes_preview: content?.notes?.substring(0, 100)
  }
}
