/**
 * POST /api/reflect/complete
 *
 * Mark a review session as complete by updating last_reviewed_at on the endeavor.
 * This resets the trigger logic for the next review cycle.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateCompleteRequest,
  CompleteReviewResponse,
  ReflectContractViolationError
} from '../../../../lib/contracts/reflect-contract'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()
    const validatedRequest = validateCompleteRequest(body)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { endeavor_id } = validatedRequest
    const now = new Date().toISOString()

    // Verify endeavor exists and user has access
    const { data: endeavor, error: fetchError } = await supabase
      .from('endeavors')
      .select('id')
      .eq('id', endeavor_id)
      .single()

    if (fetchError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Update last_reviewed_at
    const { error: updateError } = await supabase
      .from('endeavors')
      .update({ last_reviewed_at: now })
      .eq('id', endeavor_id)

    if (updateError) {
      console.error('Failed to update endeavor:', updateError)
      return NextResponse.json(
        { error: 'Failed to complete review', details: updateError.message },
        { status: 500 }
      )
    }

    const response: CompleteReviewResponse = {
      success: true,
      endeavor_id,
      last_reviewed_at: now
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ReflectContractViolationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.details },
        { status: 400 }
      )
    }
    console.error('Complete review error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
