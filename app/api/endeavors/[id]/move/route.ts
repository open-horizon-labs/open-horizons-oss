import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { query, queryOne, getClient } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

interface MoveRequest {
  targetContextId: string
  moveSubgraph?: boolean
}

/**
 * Collect all descendant endeavor IDs by walking the 'contains' edges.
 */
function collectDescendants(
  endeavorId: string,
  parentToChildren: Map<string, string[]>
): string[] {
  const result: string[] = []
  const stack = [endeavorId]
  const visited = new Set<string>()

  while (stack.length > 0) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    result.push(current)
    const children = parentToChildren.get(current) || []
    for (const child of children) {
      stack.push(child)
    }
  }

  return result
}

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const endeavorId = decodeURIComponent(id)

    const body = await request.json() as MoveRequest
    const { targetContextId, moveSubgraph = true } = body

    if (!targetContextId) {
      return NextResponse.json({ error: 'targetContextId is required' }, { status: 400 })
    }

    // Verify endeavor exists
    const endeavor = await queryOne<{ id: string; title: string; context_id: string }>(
      'SELECT id, title, context_id FROM endeavors WHERE id = $1',
      [endeavorId]
    )

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Verify target context exists
    const targetContext = await queryOne<{ id: string }>(
      'SELECT id FROM contexts WHERE id = $1',
      [targetContextId]
    )

    if (!targetContext) {
      return NextResponse.json({ error: 'Target context not found' }, { status: 404 })
    }

    // Already in target context
    if (endeavor.context_id === targetContextId && !moveSubgraph) {
      return NextResponse.json({
        success: true,
        message: 'Endeavor is already in the target context',
        movedToContext: targetContextId
      })
    }

    const client = await getClient()
    try {
      await client.query('BEGIN')

      if (moveSubgraph) {
        // Build parent-to-children map from edges
        const allEdges = await query<{ from_endeavor_id: string; to_endeavor_id: string }>(
          'SELECT from_endeavor_id, to_endeavor_id FROM edges WHERE relationship = $1',
          ['contains']
        )

        const parentToChildren = new Map<string, string[]>()
        for (const edge of allEdges) {
          const children = parentToChildren.get(edge.from_endeavor_id) || []
          children.push(edge.to_endeavor_id)
          parentToChildren.set(edge.from_endeavor_id, children)
        }

        const movedIds = collectDescendants(endeavorId, parentToChildren)

        // Update all descendants' context_id
        if (movedIds.length > 0) {
          const placeholders = movedIds.map((_, i) => `$${i + 2}`).join(', ')
          await client.query(
            `UPDATE endeavors SET context_id = $1 WHERE id IN (${placeholders})`,
            [targetContextId, ...movedIds]
          )
        }

        await client.query('COMMIT')

        const { revalidatePath } = await import('next/cache')
        revalidatePath('/dashboard')

        return NextResponse.json({
          success: true,
          message: `Moved ${movedIds.length} endeavor(s) to target context`,
          moveType: 'subgraph',
          movedEndeavors: movedIds,
          movedToContext: targetContextId
        })
      } else {
        // Move only the single endeavor
        await client.query(
          'UPDATE endeavors SET context_id = $1 WHERE id = $2',
          [targetContextId, endeavorId]
        )

        await client.query('COMMIT')

        const { revalidatePath } = await import('next/cache')
        revalidatePath('/dashboard')

        return NextResponse.json({
          success: true,
          message: `Endeavor "${endeavor.title || endeavorId}" moved to target context`,
          movedToContext: targetContextId
        })
      }
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Move endeavor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
