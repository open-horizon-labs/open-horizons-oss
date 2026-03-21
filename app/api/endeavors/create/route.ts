import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { query, queryOne, getClient } from '../../../../lib/db'

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const requestBody = await request.json()

    // Validate request fields
    const { title, type, contextId, parentId } = requestBody
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return Response.json({ error: 'Title is required' }, { status: 400 })
    }
    if (!type || typeof type !== 'string') {
      return Response.json({ error: 'Type is required' }, { status: 400 })
    }

    // Validate type against DB node_types table (not config cache)
    const validType = await queryOne(
      'SELECT slug, name FROM node_types WHERE slug = $1 OR LOWER(name) = LOWER($1)',
      [type]
    )
    if (!validType) {
      const allTypes = await query('SELECT slug FROM node_types ORDER BY sort_order')
      return Response.json({
        error: `Invalid node type "${type}". Valid types: ${allTypes.map((t: any) => t.slug).join(', ')}`
      }, { status: 400 })
    }

    const validatedInput = {
      title: title.trim(),
      type: validType.slug,
      contextId: contextId || null,
      parentId: parentId || null
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

    // Build DB record
    const endeavorId = crypto.randomUUID()
    const dbNodeType = validType.name // Use the canonical DB name

    const client = await getClient()
    try {
      await client.query('BEGIN')
      await client.query(
        'INSERT INTO endeavors (id, context_id, title, description, status, node_type, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [endeavorId, resolvedContextId, validatedInput.title, '', 'active', dbNodeType, '{}']
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

    return Response.json({ success: true, endeavorId })
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
