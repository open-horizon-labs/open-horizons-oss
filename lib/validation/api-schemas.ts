import { z } from 'zod'
import { UserNodeType, DatabaseNodeType } from '../contracts/endeavor-contract'

/**
 * Parameter validation schemas - validate user input BEFORE processing
 * Uses contract constants to ensure consistency
 */

// Valid node types that users can specify (lowercase) - from contract
export const UserNodeTypeSchema = UserNodeType

// Valid node types in database (capitalized) - from contract
export const DatabaseNodeTypeSchema = DatabaseNodeType

// User input for creating endeavors
export const CreateEndeavorRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title too long'),
  type: UserNodeTypeSchema,
  contextId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable()
})

// Database format for endeavors
export const DatabaseEndeavorSchema = z.object({
  id: z.string(),
  user_id: z.string().uuid('Invalid user ID format'),
  created_by: z.string().uuid('Invalid created_by format'),
  title: z.string().min(1),
  description: z.string(),
  status: z.literal('active'),
  node_type: DatabaseNodeTypeSchema,
  context_id: z.string().regex(/^(personal:[\w-]+|context:[\w-]+:.+)$/, 'Invalid context ID format'),
  parent_id: z.string().nullable()
})

// GraphNode format for API responses
export const GraphNodeResponseSchema = z.object({
  id: z.string(),
  node_type: DatabaseNodeTypeSchema,
  parent_id: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  status: z.string(),
  metadata: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  archived_at: z.string().nullable()
})

export const DashboardResponseSchema = z.object({
  nodes: z.array(GraphNodeResponseSchema)
})

/**
 * Transform user input to database format with validation
 */
export function transformCreateEndeavorRequest(
  userInput: unknown,
  userId: string,
  resolvedContextId: string
): z.infer<typeof DatabaseEndeavorSchema> {
  // Validate user input first
  const validated = CreateEndeavorRequestSchema.parse(userInput)

  // Generate endeavor ID
  const endeavorId = `${validated.type}:${userId}:${Date.now()}-${crypto.randomUUID().substring(0, 8)}`

  // Transform to database format
  const dbData = {
    id: endeavorId,
    user_id: userId,
    created_by: userId,
    title: validated.title,
    description: '',
    status: 'active' as const,
    node_type: (validated.type.charAt(0).toUpperCase() + validated.type.slice(1)) as z.infer<typeof DatabaseNodeTypeSchema>,
    context_id: resolvedContextId,
    parent_id: validated.parentId || null
  }

  // Validate database format before returning
  return DatabaseEndeavorSchema.parse(dbData)
}

/**
 * Transform database data to GraphNode format with validation
 */
export function transformDatabaseToGraphNode(dbData: unknown): z.infer<typeof GraphNodeResponseSchema> {
  // This will throw if database returns unexpected format
  const endeavor = z.object({
    id: z.string(),
    node_type: DatabaseNodeTypeSchema,
    parent_id: z.string().nullable(),
    title: z.string(),
    description: z.string(),
    status: z.string(),
    metadata: z.record(z.string(), z.unknown()).nullable(),
    created_at: z.string(),
    archived_at: z.string().nullable()
  }).parse(dbData)

  const graphNode = {
    id: endeavor.id,
    node_type: endeavor.node_type,
    parent_id: endeavor.parent_id,
    title: endeavor.title,
    description: endeavor.description || '',
    status: endeavor.status,
    metadata: endeavor.metadata || {},
    created_at: endeavor.created_at,
    archived_at: endeavor.archived_at
  }

  // Validate final GraphNode format
  return GraphNodeResponseSchema.parse(graphNode)
}

/**
 * Validation error with detailed information
 */
export class ValidationError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    public layer: 'input' | 'database' | 'output'
  ) {
    super(`Validation failed at ${layer} layer: ${issues.map(i => i.message).join(', ')}`)
    this.name = 'ValidationError'
  }
}