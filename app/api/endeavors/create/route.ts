import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  getActiveConfig,
  getNodeTypeByName,
  getNodeTypeBySlug,
  rowsToConfig,
  type StrategyConfig,
} from '../../../../lib/config'
import {
  ContractViolationError,
  validateCreateEndeavorRequest,
  validateCreateEndeavorResponse,
} from '../../../../lib/contracts/endeavor-contract'
import { query, queryOne, getClient } from '../../../../lib/db'

type RequestIssue = {
  field: string,
  message: string,
  received?: unknown,
}

function mapRequestIssues(issues: Array<{
  code?: string,
  path?: Array<string | number>,
  message: string,
  keys?: string[],
  input?: unknown,
}>): RequestIssue[] {
  return issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys' && Array.isArray(issue.keys)) {
      return issue.keys.map((key) => ({
        field: key,
        message: 'Unknown field. Use one of: title, type, description, contextId, parentId',
      }))
    }

    return [{
      field: issue.path?.join('.') || '',
      message: issue.message,
      received: issue.input,
    }]
  })
}

function requestValidationError(details: string, issues: RequestIssue[]) {
  return NextResponse.json({
    error: 'Contract violation: Request validation failed',
    details,
    issues,
  }, { status: 400 })
}

function isMissingNodeTypesRelation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === '42P01'
  )
}

async function getNodeTypeConfig(): Promise<StrategyConfig> {
  try {
    const rows = await query(
      'SELECT slug, name, description, icon, color, chip_classes, valid_children, valid_parents, sort_order FROM node_types ORDER BY sort_order ASC'
    )

    if (rows.length > 0) {
      return rowsToConfig(rows)
    }
  } catch (error) {
    if (!isMissingNodeTypesRelation(error)) {
      throw error
    }
  }

  return getActiveConfig()
}


export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    let requestBody: unknown

    try {
      requestBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 })
    }

    let validatedInput
    try {
      validatedInput = validateCreateEndeavorRequest(requestBody)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return requestValidationError(error.message, mapRequestIssues(error.zodError.issues as Array<{
          code?: string,
          path?: Array<string | number>,
          message: string,
          keys?: string[],
          input?: unknown,
        }>))
      }

      throw error
    }

    const nodeTypeConfig = await getNodeTypeConfig()
    const validType =
      getNodeTypeBySlug(nodeTypeConfig, validatedInput.type) ||
      getNodeTypeByName(nodeTypeConfig, validatedInput.type)

    if (!validType) {
      return requestValidationError(
        `Invalid node type "${validatedInput.type}". See GET /api/about for the authoritative create contract and valid type slugs.`,
        [{
          field: 'type',
          message: `Valid create-time type slugs: ${nodeTypeConfig.nodeTypes.map((nodeType) => nodeType.slug).join(', ')}`
        }]
      )
    }

    let effectiveContextId = validatedInput.contextId || null
    let parentEndeavor: { id: string, context_id: string } | null = null

    if (validatedInput.parentId) {
      parentEndeavor = await queryOne<{ id: string, context_id: string }>(
        'SELECT id, context_id FROM endeavors WHERE id = $1',
        [validatedInput.parentId]
      )

      if (!parentEndeavor) {
        return NextResponse.json({ error: 'Parent not found or not accessible' }, { status: 400 })
      }

      if (!effectiveContextId) {
        effectiveContextId = parentEndeavor.context_id
      }
    }

    const resolvedContextId = effectiveContextId || 'default'

    const contextExists = await queryOne('SELECT id FROM contexts WHERE id = $1', [resolvedContextId])
    if (!contextExists) {
      await query(
        'INSERT INTO contexts (id, title) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [resolvedContextId, resolvedContextId === 'default' ? 'Default Context' : resolvedContextId]
      )
    }

    if (parentEndeavor && parentEndeavor.context_id !== resolvedContextId) {
      return NextResponse.json({ error: 'Parent not available in target context' }, { status: 400 })
    }

    const endeavorId = crypto.randomUUID()
    const client = await getClient()

    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO endeavors (id, context_id, title, description, status, node_type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          endeavorId,
          resolvedContextId,
          validatedInput.title,
          validatedInput.description ?? '',
          'active',
          validType.name,
          '{}',
        ]
      )

      if (validatedInput.parentId) {
        await client.query(
          'INSERT INTO edges (from_endeavor_id, to_endeavor_id, relationship) VALUES ($1, $2, $3)',
          [validatedInput.parentId, endeavorId, 'contains']
        )
      }

      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')

    const response = validateCreateEndeavorResponse({ success: true, endeavorId })
    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ContractViolationError) {
      return NextResponse.json({
        error: 'Internal contract violation: Response format invalid',
        details: error.message,
      }, { status: 500 })
    }

    console.error('Error in endeavor creation:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
})
