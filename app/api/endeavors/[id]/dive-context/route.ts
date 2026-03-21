/**
 * Dive Context API Route
 *
 * GET /api/endeavors/:id/dive-context - Get context for creating a dive pack
 *
 * Returns the endeavor, its ancestors, siblings, children, related metis,
 * guardrails, and recent logs - everything needed to create a curated dive pack.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { validateDiveContextResponse, DivePackContractViolationError } from '../../../../../lib/contracts/dive-pack-contract'

export const dynamic = 'force-dynamic'

/**
 * GET /api/endeavors/:id/dive-context - Get dive context for pack creation
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: endeavorId } = await params

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Call the database function to get all context
    const { data, error } = await supabase.rpc('get_dive_context', {
      p_endeavor_id: endeavorId
    })

    if (error) {
      console.error('Database error getting dive context:', error)
      return NextResponse.json(
        { error: 'Failed to get dive context' },
        { status: 500 }
      )
    }

    // Function returns null if endeavor not found
    if (!data) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Validate and return the context
    const validatedResponse = validateDiveContextResponse(data)
    return NextResponse.json(validatedResponse)

  } catch (error) {
    console.error('Error in dive-context GET:', error)

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
