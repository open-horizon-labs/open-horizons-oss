import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { query, queryOne, execute, getClient } from '../../../../../lib/db'

export const dynamic = 'force-dynamic'

interface ParentRequest {
  parentId: string
}

export const PUT = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    const body = await req.json() as ParentRequest
    const { parentId } = body

    // Verify endeavor exists
    const endeavor = await queryOne<{ id: string; title: string }>(
      'SELECT id, title FROM endeavors WHERE id = $1',
      [endeavorId]
    )

    if (!endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Reject self-parenting
    if (parentId === endeavorId) {
      return NextResponse.json({ error: 'Cannot set an endeavor as its own parent' }, { status: 400 })
    }

    const isRoot = !parentId || parentId === '' || parentId === 'null' || parentId === 'root'

    if (!isRoot) {
      // Verify new parent exists
      const parent = await queryOne('SELECT id FROM endeavors WHERE id = $1', [parentId])
      if (!parent) {
        return NextResponse.json({ error: 'Parent endeavor not found' }, { status: 404 })
      }

      // Check for circular dependency
      const allEdges = await query<{ from_endeavor_id: string; to_endeavor_id: string }>(
        'SELECT from_endeavor_id, to_endeavor_id FROM edges WHERE relationship = $1',
        ['contains']
      )

      const parentToChildrenMap = new Map<string, string[]>()
      for (const edge of allEdges) {
        const children = parentToChildrenMap.get(edge.from_endeavor_id) || []
        children.push(edge.to_endeavor_id)
        parentToChildrenMap.set(edge.from_endeavor_id, children)
      }

      const isDescendant = (nodeId: string, targetId: string, visited = new Set<string>()): boolean => {
        if (visited.has(nodeId)) return false
        visited.add(nodeId)
        const children = parentToChildrenMap.get(nodeId) || []
        if (children.includes(targetId)) return true
        return children.some(childId => isDescendant(childId, targetId, visited))
      }

      if (isDescendant(endeavorId, parentId)) {
        return NextResponse.json({ error: 'Cannot create circular dependency: target is a descendant' }, { status: 400 })
      }
    }

    // Get current parent edge for potential rollback
    const currentParentEdge = await queryOne<{ from_endeavor_id: string }>(
      'SELECT from_endeavor_id FROM edges WHERE to_endeavor_id = $1 AND relationship = $2',
      [endeavorId, 'contains']
    )

    const client = await getClient()
    try {
      await client.query('BEGIN')

      // Remove existing parent edge
      await client.query(
        'DELETE FROM edges WHERE to_endeavor_id = $1 AND relationship = $2',
        [endeavorId, 'contains']
      )

      // Create new parent edge if not root
      if (!isRoot) {
        await client.query(
          'INSERT INTO edges (from_endeavor_id, to_endeavor_id, relationship) VALUES ($1, $2, $3)',
          [parentId, endeavorId, 'contains']
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

    return NextResponse.json({
      success: true,
      message: 'Task parent updated successfully'
    })
  } catch (error) {
    console.error('Parent update endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
