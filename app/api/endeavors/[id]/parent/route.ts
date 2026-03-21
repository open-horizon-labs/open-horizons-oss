import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'

export const dynamic = 'force-dynamic'

interface ParentRequest {
  parentId: string
}

// Update an endeavor's parent (uses edges table internally)
export const PUT = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const userId = user.id
    const body = await req.json() as ParentRequest
    const { parentId } = body

    // Verify endeavor exists and user has access
    const { data: endeavor, error: fetchError } = await supabase
      .from('endeavors')
      .select('id, title')
      .eq('id', endeavorId)
      .single()

    if (fetchError || !endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Explicitly reject self-parenting
    if (parentId === endeavorId) {
      return NextResponse.json({ error: 'Cannot set an endeavor as its own parent' }, { status: 400 })
    }

    // Handle "root" case (no parent)
    const isRoot = !parentId || parentId === '' || parentId === 'null' || parentId === 'root'

    if (!isRoot) {
      // Verify new parent exists and user has access
      const { data: parent, error: parentError } = await supabase
        .from('endeavors')
        .select('id')
        .eq('id', parentId)
        .single()

      if (parentError || !parent) {
        return NextResponse.json({ error: 'Parent endeavor not found' }, { status: 404 })
      }

      // Check for circular dependency using edges
      const { data: allEdges, error: edgesError } = await supabase
        .from('edges')
        .select('from_endeavor_id, to_endeavor_id')
        .eq('relationship', 'contains')

      if (edgesError) {
        return NextResponse.json({ error: 'Failed to check for circular dependencies' }, { status: 500 })
      }

      // Build parent-to-children mapping from edges
      const parentToChildrenMap = new Map<string, string[]>()
      for (const edge of allEdges || []) {
        const parent = edge.from_endeavor_id
        const child = edge.to_endeavor_id
        if (!parentToChildrenMap.has(parent)) {
          parentToChildrenMap.set(parent, [])
        }
        parentToChildrenMap.get(parent)!.push(child)
      }

      // Check if parentId is a descendant of endeavorId (would create cycle)
      const isDescendant = (nodeId: string, targetId: string, visited = new Set<string>()): boolean => {
        if (visited.has(nodeId)) return false // Prevent infinite recursion
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
    const { data: currentParentEdge } = await supabase
      .from('edges')
      .select('from_endeavor_id')
      .eq('to_endeavor_id', endeavorId)
      .eq('relationship', 'contains')
      .single()

    // Remove existing parent edge (if any)
    const { error: deleteError } = await supabase
      .from('edges')
      .delete()
      .eq('to_endeavor_id', endeavorId)
      .eq('relationship', 'contains')

    if (deleteError) {
      console.error('Failed to remove old parent edge:', deleteError)
      return NextResponse.json({ error: `Failed to update parent relationship: ${deleteError.message}` }, { status: 500 })
    }

    // Create new parent edge (if not root)
    if (!isRoot) {
      const { error: insertError } = await supabase
        .from('edges')
        .insert({
          from_endeavor_id: parentId,
          to_endeavor_id: endeavorId,
          relationship: 'contains',
          created_by: userId
        })

      if (insertError) {
        console.error('Failed to create parent edge:', insertError)
        // Attempt to restore previous parent edge
        if (currentParentEdge?.from_endeavor_id) {
          const { error: rollbackError } = await supabase
            .from('edges')
            .insert({
              from_endeavor_id: currentParentEdge.from_endeavor_id,
              to_endeavor_id: endeavorId,
              relationship: 'contains',
              created_by: userId
            })
          if (rollbackError) {
            console.error('Failed to rollback parent edge:', rollbackError)
          }
        }
        return NextResponse.json({ error: `Failed to update parent relationship: ${insertError.message}` }, { status: 500 })
      }
    }

    // Revalidate pages that show endeavor data
    const { revalidatePath } = await import('next/cache')
    revalidatePath('/dashboard')
    revalidatePath('/endeavors', 'layout')
    revalidatePath('/daily', 'layout')

    return NextResponse.json({
      success: true,
      message: `Task parent updated successfully`
    })

  } catch (error) {
    console.error('Parent update endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})