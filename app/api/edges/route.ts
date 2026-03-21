import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const dynamic = 'force-dynamic'

interface CreateEdgeRequest {
  fromEndeavorId: string
  toEndeavorId: string
  relationship: string
  weight?: number
  context?: string
  metadata?: Record<string, unknown>
}

// Create a new edge
export const POST = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod
) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const body = await req.json() as CreateEdgeRequest
    const { fromEndeavorId, toEndeavorId, relationship, weight, context, metadata } = body

    // Validate required fields
    if (!fromEndeavorId || !toEndeavorId || !relationship) {
      return NextResponse.json(
        { error: 'fromEndeavorId, toEndeavorId, and relationship are required' },
        { status: 400 }
      )
    }

    // Reject self-referencing edges
    if (fromEndeavorId === toEndeavorId) {
      return NextResponse.json(
        { error: 'Cannot create edge to self' },
        { status: 400 }
      )
    }

    // Verify user has access to both endeavors
    const { data: fromEndeavor, error: fromError } = await supabase
      .from('endeavors')
      .select('id')
      .eq('id', fromEndeavorId)
      .single()

    if (fromError || !fromEndeavor) {
      return NextResponse.json(
        { error: 'From endeavor not found or not accessible' },
        { status: 404 }
      )
    }

    const { data: toEndeavor, error: toError } = await supabase
      .from('endeavors')
      .select('id')
      .eq('id', toEndeavorId)
      .single()

    if (toError || !toEndeavor) {
      return NextResponse.json(
        { error: 'To endeavor not found or not accessible' },
        { status: 404 }
      )
    }

    // Create the edge
    const { data: edge, error: insertError } = await supabase
      .from('edges')
      .insert({
        from_endeavor_id: fromEndeavorId,
        to_endeavor_id: toEndeavorId,
        relationship,
        weight: weight ?? 1.0,
        context: context ?? null,
        metadata: metadata ?? {},
        created_by: user.id
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to create edge:', insertError)

      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Edge already exists' },
          { status: 409 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to create edge' },
        { status: 500 }
      )
    }

    return NextResponse.json({ edge }, { status: 201 })

  } catch (error) {
    console.error('Edge creation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// Query edges
export const GET = withAuth(async (
  req: NextRequest,
  user: AuthenticatedUser,
  authMethod
) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { searchParams } = new URL(req.url)
    const endeavorId = searchParams.get('endeavorId')
    const relationship = searchParams.get('relationship')
    const direction = searchParams.get('direction') // 'incoming', 'outgoing', or null for both

    if (!endeavorId) {
      return NextResponse.json(
        { error: 'endeavorId query parameter is required' },
        { status: 400 }
      )
    }

    // Build query based on direction
    let query = supabase.from('edges').select('*')

    if (direction === 'incoming') {
      query = query.eq('to_endeavor_id', endeavorId)
    } else if (direction === 'outgoing') {
      query = query.eq('from_endeavor_id', endeavorId)
    } else {
      // Both directions
      query = query.or(`from_endeavor_id.eq.${endeavorId},to_endeavor_id.eq.${endeavorId}`)
    }

    if (relationship) {
      query = query.eq('relationship', relationship)
    }

    const { data: edges, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to query edges:', error)
      return NextResponse.json({ error: 'Failed to query edges' }, { status: 500 })
    }

    return NextResponse.json({ edges: edges || [] })

  } catch (error) {
    console.error('Edge query error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})
