import { z } from 'zod'

/**
 * Metis Entry Contracts
 *
 * Zod schemas for metis API request/response validation.
 * Ensures type safety and consistency between API and consumers.
 */

// Common enums
export const confidenceLevels = ['low', 'medium', 'high'] as const
export const sourceTypes = ['manual', 'log', 'session', 'harvested'] as const
export const metisStatuses = ['active', 'historical', 'superseded'] as const

// POST /api/metis request schema
export const createMetisEntrySchema = z.object({
  endeavor_id: z.string().optional(),
  context_id: z.string().optional(),
  title: z.string().min(1, 'title is required'),
  content: z.string().min(1, 'content is required'),
  source_type: z.enum(sourceTypes).default('session'),
  source_id: z.string().optional(),
  confidence: z.enum(confidenceLevels).default('medium'),
  violated_expectation: z.string().optional(),
  observed_reality: z.string().optional(),
  consequence: z.string().optional()
}).refine(
  data => data.endeavor_id || data.context_id,
  { message: 'Either endeavor_id or context_id is required' }
)

export type CreateMetisEntryRequest = z.infer<typeof createMetisEntrySchema>

// POST /api/metis response schema
export const metisEntryResponseSchema = z.object({
  success: z.boolean(),
  metis_id: z.string().uuid(),
  title: z.string(),
  confidence: z.enum(confidenceLevels)
})

export type MetisEntryResponse = z.infer<typeof metisEntryResponseSchema>

// GET /api/metis query params schema
export const listMetisEntriesParamsSchema = z.object({
  endeavor_id: z.string().optional(),
  context_id: z.string().optional(),
  status: z.enum(metisStatuses).default('active'),
  limit: z.coerce.number().int().min(1).max(100).default(20)
})

export type ListMetisEntriesParams = z.infer<typeof listMetisEntriesParamsSchema>

// Individual metis entry in list response
export const metisEntryListItemSchema = z.object({
  id: z.string().uuid(),
  endeavor_id: z.string().nullable(),
  context_id: z.string().nullable(),
  title: z.string(),
  content: z.string(),
  confidence: z.enum(confidenceLevels),
  source_type: z.enum(sourceTypes),
  last_reinforced_at: z.string(),
  status: z.enum(metisStatuses),
  created_at: z.string()
})

export type MetisEntryListItem = z.infer<typeof metisEntryListItemSchema>

// GET /api/metis response schema
export const listMetisEntriesResponseSchema = z.object({
  entries: z.array(metisEntryListItemSchema)
})

export type ListMetisEntriesResponse = z.infer<typeof listMetisEntriesResponseSchema>

// Validation helpers
export function validateCreateMetisRequest(body: unknown): CreateMetisEntryRequest {
  return createMetisEntrySchema.parse(body)
}

export function validateMetisResponse(data: unknown): MetisEntryResponse {
  return metisEntryResponseSchema.parse(data)
}

export function validateListMetisParams(params: Record<string, string | null>): ListMetisEntriesParams {
  return listMetisEntriesParamsSchema.parse(params)
}

export function validateListMetisResponse(data: unknown): ListMetisEntriesResponse {
  return listMetisEntriesResponseSchema.parse(data)
}
