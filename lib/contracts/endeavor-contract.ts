/**
 * Contract-First API Development: Endeavor Management
 *
 * This file defines the explicit contract between API routes and UI components.
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

/** User input node types (lowercase - what users send) */
export const UserNodeType = z.enum(['mission', 'aim', 'initiative', 'task'])
export type UserNodeType = z.infer<typeof UserNodeType>

/** Database node types (capitalized - stored format) */
export const DatabaseNodeType = z.enum(['Mission', 'Aim', 'Initiative', 'Task'])
export type DatabaseNodeType = z.infer<typeof DatabaseNodeType>

/** API response node types (capitalized - returned to UI) */
export const ApiNodeType = DatabaseNodeType
export type ApiNodeType = DatabaseNodeType

// Transform functions (centralized, tested)
export function userToDbNodeType(userType: UserNodeType): DatabaseNodeType {
  return (userType.charAt(0).toUpperCase() + userType.slice(1)) as DatabaseNodeType
}

export function dbToApiNodeType(dbType: DatabaseNodeType): ApiNodeType {
  return dbType // Same format
}

// ========================================
// REQUEST/RESPONSE CONTRACTS
// ========================================

/** Request: Create Endeavor */
export const CreateEndeavorRequest = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  type: UserNodeType,
  contextId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable()
})
export type CreateEndeavorRequest = z.infer<typeof CreateEndeavorRequest>

/** Response: Create Endeavor */
export const CreateEndeavorResponse = z.object({
  success: z.literal(true),
  endeavorId: z.string().min(1, 'endeavorId cannot be empty')
})
export type CreateEndeavorResponse = z.infer<typeof CreateEndeavorResponse>

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

/** Request: Archive Endeavor */
export const ArchiveEndeavorRequest = z.object({
  reason: z.string().max(500, 'Reason too long').optional()
})
export type ArchiveEndeavorRequest = z.infer<typeof ArchiveEndeavorRequest>

/** Request: Update Title */
export const UpdateTitleRequest = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long')
})
export type UpdateTitleRequest = z.infer<typeof UpdateTitleRequest>

/** Response: Success with message */
export const SuccessResponse = z.object({
  success: z.literal(true),
  message: z.string().optional()
})
export type SuccessResponse = z.infer<typeof SuccessResponse>

/** Metadata schema for endeavors */
export const EndeavorMetadata = z.object({
  archivedReason: z.string().optional(),
  legacy_artifact: z.object({
    frequency: z.string().optional(),
    practices: z.string().optional(),
    tags: z.array(z.string()).optional()
  }).optional()
}).catchall(z.unknown())

/** GraphNode for dashboard/UI consumption - matches database schema exactly */
export const GraphNode = z.object({
  id: z.string(),
  node_type: ApiNodeType,  // ✅ Use database field name
  parent_id: z.string().nullable(),  // ✅ Use database field name
  title: z.string(),
  description: z.string(),
  status: z.string(),
  metadata: EndeavorMetadata,
  created_at: z.string(),  // ✅ Use database field name
  archived_at: z.string().nullable(),  // ✅ Use database field name
  // Legacy fields for backward compatibility during migration
  rdfType: z.string().optional(),
  parent: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
  archivedReason: z.string().optional(),
  frequency: z.string().optional(),
  practices: z.string().optional()
})
export type GraphNode = z.infer<typeof GraphNode>

/** Dashboard API Response */
export const GetDashboardResponse = z.object({
  nodes: z.array(GraphNode),
  contextId: z.string()
})
export type GetDashboardResponse = z.infer<typeof GetDashboardResponse>

// ========================================
// ENDEAVOR CONTRACT (Interface)
// ========================================

/**
 * Primary contract that both API routes and UI must adhere to.
 * Changes here require updates to ALL implementing code.
 */
export interface EndeavorContract {
  create(request: CreateEndeavorRequest): Promise<CreateEndeavorResponse>
  getDashboard(contextId?: string): Promise<GetDashboardResponse>
}

// ========================================
// CONTRACT VALIDATION HELPERS
// ========================================

/** Enhanced validation that catches context ID mismatches */
export function validateCreateEndeavorRequestWithContext(data: unknown, authenticatedUserId: string): CreateEndeavorRequest {
  const validated = validateCreateEndeavorRequest(data)

  // Validate personal context ID format if provided
  if (validated.contextId && validated.contextId.startsWith('personal:')) {
    const contextUserId = validated.contextId.replace('personal:', '')
    if (contextUserId !== authenticatedUserId) {
      throw new ContractViolationError('CreateEndeavorRequest', {
        issues: [{
          path: ['contextId'],
          message: `Personal context ID mismatch: contextId '${validated.contextId}' does not match authenticated user '${authenticatedUserId}'. This indicates a session/authentication bug.`,
          code: 'custom'
        }]
      } as z.ZodError, 'request')
    }
  }

  return validated
}

/** Validate API request at route entry point */
export function validateCreateEndeavorRequest(data: unknown): CreateEndeavorRequest {
  try {
    return CreateEndeavorRequest.parse(data)
  } catch (error) {
    throw new ContractViolationError('CreateEndeavorRequest', error as z.ZodError)
  }
}

/** Validate API response before sending to UI */
export function validateCreateEndeavorResponse(data: unknown): CreateEndeavorResponse {
  try {
    return CreateEndeavorResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('CreateEndeavorResponse', error as z.ZodError)
  }
}

/** Validate GraphNode data before UI consumption */
export function validateGraphNode(data: unknown): GraphNode {
  try {
    return GraphNode.parse(data)
  } catch (error) {
    throw new ContractViolationError('GraphNode', error as z.ZodError)
  }
}

/** Validate dashboard response before UI consumption */
export function validateDashboardResponse(data: unknown): GetDashboardResponse {
  try {
    return GetDashboardResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('GetDashboardResponse', error as z.ZodError)
  }
}

/** Validate archive request */
export function validateArchiveRequest(data: unknown): ArchiveEndeavorRequest {
  try {
    return ArchiveEndeavorRequest.parse(data)
  } catch (error) {
    throw new ContractViolationError('ArchiveEndeavorRequest', error as z.ZodError)
  }
}

/** Validate title update request */
export function validateUpdateTitleRequest(data: unknown): UpdateTitleRequest {
  try {
    return UpdateTitleRequest.parse(data)
  } catch (error) {
    throw new ContractViolationError('UpdateTitleRequest', error as z.ZodError)
  }
}

/** Validate success response */
export function validateSuccessResponse(data: unknown): SuccessResponse {
  try {
    return SuccessResponse.parse(data)
  } catch (error) {
    throw new ContractViolationError('SuccessResponse', error as z.ZodError, 'response')
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
// CLIENT-SIDE CONTEXT UTILITIES
// ========================================

/**
 * Generate personal context ID for a user (client-safe)
 */
export function getPersonalContextId(userId: string): string {
  return `personal:${userId}`
}

/**
 * Check if a context ID is a personal context (client-safe)
 */
export function isPersonalContextId(contextId: string): boolean {
  return contextId.startsWith('personal:')
}

/**
 * Extract user ID from personal context ID (client-safe)
 */
export function getUserIdFromPersonalContext(contextId: string): string | null {
  if (!isPersonalContextId(contextId)) {
    return null
  }
  return contextId.replace('personal:', '')
}

// ========================================
// DATABASE TRANSFORMATION (Centralized)
// ========================================

/**
 * Transform validated user request to database format
 * This function is the SINGLE SOURCE OF TRUTH for the transformation logic
 */
export function transformToDatabase(
  validated: CreateEndeavorRequest,
  userId: string,
  resolvedContextId: string
) {
  const endeavorId = crypto.randomUUID()

  // Note: parent_id is NOT set here - parent relationships are stored as edges
  return {
    id: endeavorId,
    user_id: userId,
    created_by: userId,
    title: validated.title,
    description: '',
    status: 'active' as const,
    node_type: userToDbNodeType(validated.type),
    context_id: resolvedContextId
  }
}

