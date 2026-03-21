import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { getSupabaseForAuthMethod } from '../../../../../lib/supabaseForAuth'
import { resolveContextId } from '../../../../../lib/contexts/personal-context'

/**
 * Move endeavor from one context to another
 * Simple 1:1 context relationship using endeavors.context_id column
 */
export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    console.log('🚚 Move endpoint called with context:', context)
    const { id: endeavorId } = await context.params
    const { targetContextId, moveSubgraph = false } = await request.json()
    console.log('🚚 Move request:', { endeavorId, targetContextId, moveSubgraph })

    if (!targetContextId) {
      return NextResponse.json(
        { error: 'targetContextId is required' },
        { status: 400 }
      )
    }

    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Resolve target context ID (handle 'personal' → actual personal context ID)
    const resolvedTargetContextId = resolveContextId(targetContextId, user.id)

    // Verify endeavor exists and user has access
    const { data: endeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id, context_id, created_by')
      .eq('id', endeavorId)
      .single()

    if (endeavorError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found or access denied' },
        { status: 404 }
      )
    }

    // Only the creator can move endeavors
    if (endeavor.created_by !== user.id) {
      return NextResponse.json(
        { error: 'Only endeavor creators can move endeavors' },
        { status: 403 }
      )
    }

    // Don't move if already in target context
    if (endeavor.context_id === resolvedTargetContextId) {
      return NextResponse.json(
        { error: 'Endeavor is already in the target context' },
        { status: 400 }
      )
    }

    // Collect endeavors to move (parent + optional subgraph)
    let endeavorsToMove = [endeavorId]

    if (moveSubgraph) {
      // Find all descendant endeavors using the database function
      console.log('🔍 Finding descendants of:', endeavorId)
      const { data: descendants, error: descendantsError } = await supabase
        .rpc('get_endeavor_children_recursive', { root_endeavor_id: endeavorId })

      if (descendantsError) {
        console.error('🔍 Error getting descendants:', descendantsError)
        return NextResponse.json(
          { error: 'Failed to get endeavor descendants' },
          { status: 500 }
        )
      }

      const descendantIds = descendants?.map((row: any) => row.endeavor_id) || []
      console.log('🔍 Found descendants:', descendantIds)
      endeavorsToMove = [endeavorId, ...descendantIds]
      console.log('🔍 Total endeavors to move:', endeavorsToMove)
    }

    // Move all endeavors by updating their context_id
    const { error: moveError } = await supabase
      .from('endeavors')
      .update({ context_id: resolvedTargetContextId })
      .in('id', endeavorsToMove)
      .eq('created_by', user.id)

    if (moveError) {
      console.error('Error moving endeavors:', moveError)
      return NextResponse.json(
        { error: 'Failed to move endeavor(s)' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      movedToContext: resolvedTargetContextId,
      movedEndeavors: endeavorsToMove,
      moveType: moveSubgraph ? 'subgraph' : 'single'
    })

  } catch (error) {
    console.error('Error in move endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

