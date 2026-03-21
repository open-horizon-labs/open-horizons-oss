/**
 * POST /api/reflect/reject
 *
 * Reject a candidate with documented reason.
 * Preserves audit trail - candidates are never deleted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import {
  validateRejectRequest,
  RejectCandidateResponse,
  ReflectContractViolationError
} from '../../../../lib/contracts/reflect-contract'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()
    const validatedRequest = validateRejectRequest(body)

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { candidate_id, type, reason } = validatedRequest

    // Determine which table to update
    const tableName = type === 'metis' ? 'metis_candidates' : 'guardrail_candidates'

    // Verify candidate exists and is pending
    const { data: candidate, error: fetchError } = await supabase
      .from(tableName)
      .select('id, status')
      .eq('id', candidate_id)
      .single()

    if (fetchError || !candidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      )
    }

    if (candidate.status !== 'pending') {
      return NextResponse.json(
        { error: `Candidate already ${candidate.status}` },
        { status: 400 }
      )
    }

    // Update candidate to rejected
    const { error: updateError } = await supabase
      .from(tableName)
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', candidate_id)

    if (updateError) {
      console.error('Failed to reject candidate:', updateError)
      return NextResponse.json(
        { error: 'Failed to reject candidate', details: updateError.message },
        { status: 500 }
      )
    }

    const response: RejectCandidateResponse = {
      success: true,
      candidate_id
    }

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof ReflectContractViolationError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.details },
        { status: 400 }
      )
    }
    console.error('Reject error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
