/**
 * Contract-First API Development: Endeavor Management
 *
 * This file defines the explicit contract between API routes and UI components.
 * ALL API routes and UI code must use these contracts to prevent schema drift.
 *
 * Node types are now derived from the active strategy configuration.
 * Changing STRATEGY_PRESET changes the valid types throughout the app.
 *
 * Philosophy:
 * - API tests validate against contracts
 * - API routes implement contracts
 * - UI components consume contracts
 * - TypeScript enforces consistency
 */

import { z } from 'zod'
import { getActiveConfig } from '../config'

// ========================================
// CORE TYPE DEFINITIONS (Derived from Config)
// ========================================

/**
 * Build Zod enum schemas dynamically from the active configuration.
 *
 * UserNodeType  = slugs   (lowercase, what users send)
 * DatabaseNodeType = names (capitalized, stored/returned format)
 *
 * We cache the result so repeated imports share one schema instance.
 */
function buildNodeTypeSchemas() {
  const config = getActiveConfig()
  const slugs = config.nodeTypes.map(nt => nt.slug) as [string, ...string[]]
  const names = config.nodeTypes.map(nt => nt.name) as [string, ...string[]]

  return {
    userSchema: z.enum(slugs),
    dbSchema: z.enum(names)
  }
}

// Lazy-initialised cache so the config is read once per process
let _schemas: ReturnType<typeof buildNodeTypeSchemas> | null = null
function getSchemas() {
  if (!_schemas) _schemas = buildNodeTypeSchemas()
  return _schemas
}

/** User input node types (slugs - what users send, e.g. "mission", "strategic_bet") */
export const UserNodeType: z.ZodEnum<[string, ...string[]]> = z.lazy(() => getSchemas().userSchema) as unknown as z.ZodEnum<[string, ...string[]]>
export type UserNodeType = string

/** Database node types (names - stored format, e.g. "Mission", "Strategic Bet") */
export const DatabaseNodeType: z.ZodEnum<[string, ...string[]]> = z.lazy(() => getSchemas().dbSchema) as unknown as z.ZodEnum<[string, ...string[]]>
export type DatabaseNodeType = string

/** API response node types (same as database format) */
export const ApiNodeType = DatabaseNodeType
export type ApiNodeType = DatabaseNodeType

/**
 * Expose the enum-like `.enum` accessor that existing code uses
 * (e.g. `DatabaseNodeType.enum.Mission`).
 *
 * We build a proxy object so any valid name resolves to itself.
 */
function buildEnumProxy(values: string[]): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const v of values) obj[v] = v
  return obj
}

// Attach .enum to the Zod schema objects so existing code like
// `DatabaseNodeType.enum.Mission` still works.
;(DatabaseNodeType as any).enum = new Proxy(
  buildEnumProxy(getActiveConfig().nodeTypes.map(nt => nt.name)),
  { get: (target, prop) => target[prop as string] }
)
;(UserNodeType as any).enum = new Proxy(
  buildEnumProxy(getActiveConfig().nodeTypes.map(nt => nt.slug)),
  { get: (target, prop) => target[prop as string] }
)

// Transform functions (centralized, tested)
export function userToDbNodeType(userSlug: UserNodeType): DatabaseNodeType {
  const config = getActiveConfig()
  const found = config.nodeTypes.find(nt => nt.slug === userSlug)
  if (!found) {
    throw new Error(`Unknown user node type slug: "${userSlug}". Valid: ${config.nodeTypes.map(nt => nt.slug).join(', ')}`)
  }
  return found.name as DatabaseNodeType
}

export function dbToUserNodeType(dbName: DatabaseNodeType): UserNodeType {
  const config = getActiveConfig()
  const found = config.nodeTypes.find(nt => nt.name === dbName)
  if (!found) {
    throw new Error(`Unknown database node type: "${dbName}". Valid: ${config.nodeTypes.map(nt => nt.name).join(', ')}`)
  }
  return found.slug as UserNodeType
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
  type: z.string().refine(
    (val) => getActiveConfig().nodeTypes.some(nt => nt.slug === val),
    (val) => ({ message: `Invalid node type "${val}". Valid types: ${getActiveConfig().nodeTypes.map(nt => nt.slug).join(', ')}` })
  ),
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
  node_type: z.string().refine(
    (val) => getActiveConfig().nodeTypes.some(nt => nt.name === val),
    (val) => ({ message: `Invalid node type "${val}". Valid types: ${getActiveConfig().nodeTypes.map(nt => nt.name).join(', ')}` })
  ),
  parent_id: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  metadata: EndeavorMetadata,
  created_at: z.string(),
  archived_at: z.string().nullable(),
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
    title: validated.title,
    description: '',
    status: 'active' as const,
    node_type: userToDbNodeType(validated.type),
    context_id: resolvedContextId
  }
}
