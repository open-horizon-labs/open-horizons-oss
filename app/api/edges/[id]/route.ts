import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'

export const dynamic = 'force-dynamic'

// Delete an edge
export const DELETE = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const edgeId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // First verify the edge exists and user has access
    const { data: edge, error: fetchError } = await supabase
      .from('edges')
      .select('*')
      .eq('id', edgeId)
      .single()

    if (fetchError || !edge) {
      return NextResponse.json(
        { error: 'Edge not found' },
        { status: 404 }
      )
    }

    // Delete the edge
    const { error: deleteError } = await supabase
      .from('edges')
      .delete()
      .eq('id', edgeId)

    if (deleteError) {
      console.error('Failed to delete edge:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete edge' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Edge deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
