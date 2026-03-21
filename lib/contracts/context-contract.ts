/**
 * Contract-First API Development: Context Management
 *
 * This file defines the explicit contract between API routes and UI components
 * for context operations (create, read, update, delete).
 * ALL API routes and UI code must use these contracts to prevent schema drift.
 *
 * Philosophy:
 * - API tests validate against contracts
 * - API routes implement contracts
 * - UI components consume contracts
 * - TypeScript enforces consistency
 */

import { z } from 'zod'

// ========================================
// CORE TYPE DEFINITIONS (Source of Truth)
// ========================================

/** Request: Update Context */
export const UpdateContextRequest = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional()
})
export type UpdateContextRequest = z.infer<typeof UpdateContextRequest>

/** Response: Update Context */
export const UpdateContextResponse = z.object({
  success: z.literal(true),
  contextId: z.string().min(1, 'contextId cannot be empty')
})
export type UpdateContextResponse = z.infer<typeof UpdateContextResponse>

/** Request: Create Context */
export const CreateContextRequest = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  endeavorIds: z.array(z.string()).optional() // Optional list of endeavors to move to this context
})
export type CreateContextRequest = z.infer<typeof CreateContextRequest>

/** Response: Create Context */
export const CreateContextResponse = z.object({
  success: z.literal(true),
  contextId: z.string().min(1, 'contextId cannot be empty')
})
export type CreateContextResponse = z.infer<typeof CreateContextResponse>

/** Context data for UI consumption */
export const ContextNode = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  created_by: z.string(),
  created_at: z.string(),
  is_owner: z.boolean(),
  ui_config: z.record(z.string(), z.unknown()).optional()
})
export type ContextNode = z.infer<typeof ContextNode>

/** Response: List Contexts */
export const ListContextsResponse = z.object({
  contexts: z.array(ContextNode)
})
export type ListContextsResponse = z.infer<typeof ListContextsResponse>

/** Error Response (standardized across all APIs) */
export const ApiErrorResponse = z.object({
  error: z.string(),
  details: z.unknown().optional(),
  issues: z.array(z.object({
    field: z.string(),
    message: z.string(),
    received: z.unknown().optional()
  })).optional()
})
export type ApiErrorResponse = z.infer<typeof ApiErrorResponse>

// ========================================
// CONTEXT CONTRACT (Interface)
// ========================================

/**
 * Primary contract that both API routes and UI must adhere to.
 * Changes here require updates to ALL implementing code.
 */
export interface ContextContract {
  create(request: CreateContextRequest): Promise<CreateContextResponse>
  update(contextId: string, request: UpdateContextRequest): Promise<UpdateContextResponse>
  list(): Promise<ListContextsResponse>
  delete(contextId: string): Promise<{ success: boolean }>
}

// ========================================
// CONTRACT VALIDATION HELPERS
// ========================================

/** Validate API request for context creation */
export function validateCreateContextRequest(data: unknown): CreateContextRequest {
  try {
    return CreateContextRequest.parse(data)
  } catch (error) {
    throw new ContractViolationError('CreateContextRequest', error as z.ZodError)
  }
}

/** Validate API response for context creation */
export function validateCreateContextResponse(data: unknown): CreateContextResponse {
  try {
    return CreateContextResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('CreateContextResponse', error as z.ZodError)
  }
}

/** Validate API request for context updates */
export function validateUpdateContextRequest(data: unknown): UpdateContextRequest {
  try {
    return UpdateContextRequest.parse(data)
  } catch (error) {
    throw new ContractViolationError('UpdateContextRequest', error as z.ZodError)
  }
}

/** Validate API response for context updates */
export function validateUpdateContextResponse(data: unknown): UpdateContextResponse {
  try {
    return UpdateContextResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('UpdateContextResponse', error as z.ZodError)
  }
}

/** Validate contexts list response */
export function validateListContextsResponse(data: unknown): ListContextsResponse {
  try {
    return ListContextsResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('ListContextsResponse', error as z.ZodError)
  }
}

/** Validate context node data */
export function validateContextNode(data: unknown): ContextNode {
  try {
    return ContextNode.parse(data)
  } catch (error) {
    throw new ContractViolationError('ContextNode', error as z.ZodError)
  }
}

// ========================================
// CONTRACT VIOLATION ERROR
// ========================================

export class ContractViolationError extends Error {
  constructor(
    public contractName: string,
    public zodError: z.ZodError,
    public layer: 'request' | 'response' | 'database' | 'ui' = 'request'
  ) {
    super(`Contract violation in ${contractName} at ${layer} layer: ${zodError.issues.map(i => i.message).join(', ')}`)
    this.name = 'ContractViolationError'
  }
}

// ========================================
// CONTEXT UTILITIES
// ========================================

/**
 * Check if a context ID represents a personal context
 */
export function isPersonalContext(contextId: string): boolean {
  return contextId.startsWith('personal:')
}

/**
 * Extract user ID from personal context ID
 */
export function getUserIdFromPersonalContext(contextId: string): string | null {
  if (!isPersonalContext(contextId)) {
    return null
  }
  return contextId.replace('personal:', '')
}

/**
 * Check if a user owns a personal context
 */
export function userOwnsPersonalContext(contextId: string, userId: string): boolean {
  if (!isPersonalContext(contextId)) {
    return false
  }
  const contextUserId = getUserIdFromPersonalContext(contextId)
  return contextUserId === userId
}

// ========================================
// CLIENT-SIDE UI HELPERS
// ========================================

/**
 * Client-side helper to update a context via API
 */
export async function updateContext(contextId: string, request: UpdateContextRequest): Promise<UpdateContextResponse> {
  const response = await fetch(`/api/contexts/${encodeURIComponent(contextId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.details || errorData.error || 'Failed to update context')
  }

  const data = await response.json()
  return validateUpdateContextResponse(data)
}

/**
 * Client-side helper to delete a context via API
 */
export async function deleteContext(contextId: string): Promise<{ success: boolean }> {
  const response = await fetch(`/api/contexts/${encodeURIComponent(contextId)}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.details || errorData.error || 'Failed to delete context')
  }

  return await response.json()
}

/**
 * Client-side helper to create a context via API
 */
export async function createContext(request: CreateContextRequest): Promise<CreateContextResponse> {
  const response = await fetch('/api/contexts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  })

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.details || errorData.error || 'Failed to create context')
  }

  const data = await response.json()
  return validateCreateContextResponse(data)
}

/**
 * Client-side helper to list contexts via API
 */
export async function listContexts(): Promise<ListContextsResponse> {
  const response = await fetch('/api/contexts')

  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.details || errorData.error || 'Failed to list contexts')
  }

  const data = await response.json()
  return validateListContextsResponse(data)
}