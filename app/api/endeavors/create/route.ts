import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateCreateEndeavorRequestWithContext,
  validateCreateEndeavorResponse,
  transformToDatabase,
  ContractViolationError
} from '../../../../lib/contracts/endeavor-contract'
import { query, queryOne, getClient } from '../../../../lib/db'

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const requestBody = await request.json()

    let validatedInput
    try {
      validatedInput = validateCreateEndeavorRequestWithContext(requestBody, user.id)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return Response.json({
          error: 'Contract violation: Request validation failed',
          details: error.message,
          issues: error.zodError.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message,
            ...(('received' in issue) && { received: issue.received })
          }))
        }, { status: 400 })
      }
      throw error
    }

    // Determine effective contextId - inherit from parent if not explicitly provided
    let effectiveContextId = validatedInput.contextId
    let parentEndeavor: { id: string; context_id: string } | null = null

    if (validatedInput.parentId) {
      parentEndeavor = await queryOne<{ id: string; context_id: string }>(
        'SELECT id, context_id FROM endeavors WHERE id = $1',
        [validatedInput.parentId]
      )

      if (!parentEndeavor) {
        return Response.json({ error: 'Parent not found or not accessible' }, { status: 400 })
      }

      if (!effectiveContextId) {
        effectiveContextId = parentEndeavor.context_id
      }
    }

    // Resolve context: default to 'default' if none specified
    const resolvedContextId = effectiveContextId || 'default'

    // Verify context exists, auto-create if needed
    const contextExists = await queryOne('SELECT id FROM contexts WHERE id = $1', [resolvedContextId])
    if (!contextExists) {
      await query(
        'INSERT INTO contexts (id, title) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
        [resolvedContextId, resolvedContextId === 'default' ? 'Default Context' : resolvedContextId]
      )
    }

    // If parent exists, verify it is in the resolved context
    if (parentEndeavor && parentEndeavor.context_id !== resolvedContextId) {
      return Response.json({ error: 'Parent not available in target context' }, { status: 400 })
    }

    const dbRecord = transformToDatabase(validatedInput, user.id, resolvedContextId)

    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO endeavors (id, context_id, title, description, status, node_type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [dbRecord.id, dbRecord.context_id, dbRecord.title, dbRecord.description, dbRecord.status, dbRecord.node_type, '{}']
      )

      if (validatedInput.parentId) {
        await client.query(
          'INSERT INTO edges (from_endeavor_id, to_endeavor_id, relationship) VALUES ($1, $2, $3)',
          [validatedInput.parentId, dbRecord.id, 'contains']
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

    const responseData = { success: true as const, endeavorId: dbRecord.id }
    try {
      const validatedResponse = validateCreateEndeavorResponse(responseData)
      return Response.json(validatedResponse)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        return Response.json({
          error: 'Internal contract violation: Response format invalid',
          details: error.message
        }, { status: 500 })
      }
      throw error
    }
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      return Response.json({
        error: 'Invalid request format',
        issues: error.issues.map((issue: any) => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      }, { status: 400 })
    }

    console.error('Error in endeavor creation:', error)
    return Response.json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error'
    }, { status: 500 })
  }
})
