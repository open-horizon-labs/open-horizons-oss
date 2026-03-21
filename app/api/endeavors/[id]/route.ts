import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { validateSuccessResponse } from '../../../../lib/contracts/endeavor-contract'

export const dynamic = 'force-dynamic'

// Check if ID looks like a full UUID vs short prefix
function isFullId(id: string): boolean {
  // Full UUIDs are 36 chars with dashes, or various prefixed formats
  return id.length > 16 || id.includes(':') || id.includes('-')
}

// Get a single endeavor by ID (supports short prefix matching like git)
export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key', { params }: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await params
    const endeavorId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    let endeavor, fetchError

    if (isFullId(endeavorId)) {
      // Exact match for full IDs
      const result = await supabase
        .from('endeavors')
        .select(`
          id,
          title,
          description,
          status,
          context_id,
          node_type,
          created_at,
          updated_at,
          metadata
        `)
        .eq('id', endeavorId)
        .single()
      endeavor = result.data
      fetchError = result.error
    } else {
      // Prefix match for short IDs (git-style)
      const result = await supabase
        .from('endeavors')
        .select(`
          id,
          title,
          description,
          status,
          context_id,
          node_type,
          created_at,
          updated_at,
          metadata
        `)
        .ilike('id', `${endeavorId}%`)
        .limit(2) // Get 2 to detect ambiguity

      if (result.data && result.data.length === 1) {
        endeavor = result.data[0]
      } else if (result.data && result.data.length > 1) {
        // Ambiguous - multiple matches
        return NextResponse.json({
          error: 'Ambiguous short ID - matches multiple endeavors',
          matches: result.data.map(e => ({ id: e.id, title: e.title }))
        }, { status: 400 })
      } else if (!result.data || result.data.length === 0) {
        // No matches found
        return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
      }
      fetchError = result.error
    }

    if (fetchError) {
      console.error('Failed to fetch endeavor:', fetchError)
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'Failed to fetch endeavor' }, { status: 500 })
    }

    // Compute parent_id from edges (unified graph model)
    let parentId: string | null = null
    if (endeavor) {
      const { data: parentEdge } = await supabase
        .from('edges')
        .select('from_endeavor_id')
        .eq('to_endeavor_id', endeavor.id)
        .eq('relationship', 'contains')
        .single()

      parentId = parentEdge?.from_endeavor_id || null
    }

    return NextResponse.json({
      endeavor: {
        ...endeavor,
        parent_id: parentId
      }
    })
  } catch (error) {
    console.error('Get endeavor error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// Delete an endeavor and all its associated data
export const DELETE = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id } = await context.params
    const endeavorId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Verify endeavor exists and belongs to user
    const { data: endeavor, error: fetchError } = await supabase
      .from('endeavors')
      .select('id, title')
      .eq('id', endeavorId)
      .eq('created_by', user.id)
      .single()

    if (fetchError || !endeavor) {
      return NextResponse.json({ error: 'Endeavor not found' }, { status: 404 })
    }

    // Delete the endeavor directly
    const { error: deleteError } = await supabase
      .from('endeavors')
      .delete()
      .eq('id', endeavorId)
      .eq('created_by', user.id)

    if (deleteError) {
      console.error('Failed to delete endeavor:', deleteError)
      return NextResponse.json({ error: 'Failed to delete endeavor' }, { status: 500 })
    }

    const response = validateSuccessResponse({
      success: true,
      message: `Endeavor "${endeavor.title || endeavorId}" has been permanently deleted`
    })
    return NextResponse.json(response)

  } catch (error) {
    console.error('Delete endpoint error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})