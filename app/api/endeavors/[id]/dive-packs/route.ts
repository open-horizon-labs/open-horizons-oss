/**
 * Endeavor Dive Packs API Route
 *
 * GET /api/endeavors/:id/dive-packs - List dive packs for an endeavor
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { transformToListItem, validateListDivePacksResponse, DivePackContractViolationError } from '../../../../../lib/contracts/dive-pack-contract'

export const dynamic = 'force-dynamic'

/**
 * GET /api/endeavors/:id/dive-packs - List dive packs for an endeavor
 * Query params: status (active|archived|all), limit
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: endeavorId } = await params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'active'
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Build query
    let query = supabase
      .from('dive_packs')
      .select('id, created_at, status, content')
      .eq('primary_endeavor_id', endeavorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error listing dive packs:', error)
      return NextResponse.json(
        { error: 'Failed to list dive packs' },
        { status: 500 }
      )
    }

    // Transform and validate results
    const divePacks = (data || []).map(transformToListItem)
    const responseData = {
      dive_packs: divePacks,
      total: divePacks.length
    }
    const validatedResponse = validateListDivePacksResponse(responseData)

    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Error in endeavor dive-packs GET:', error)

    if (error instanceof DivePackContractViolationError) {
      return NextResponse.json(
        { error: 'Contract validation failed', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
