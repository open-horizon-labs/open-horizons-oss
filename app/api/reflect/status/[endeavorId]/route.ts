/**
 * GET /api/reflect/status/[endeavorId]
 *
 * Check if a review session should be triggered for an endeavor.
 * Returns pending candidate count, days since last review, and trigger status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import {
  ReviewStatusResponse,
  ITEM_THRESHOLD,
  DAY_THRESHOLD,
  TriggerReason
} from '../../../../../lib/contracts/reflect-contract'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ endeavorId: string }> }
) => {
  try {
    const { endeavorId } = await params
    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Get endeavor with last_reviewed_at
    const { data: endeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id, last_reviewed_at, context_id')
      .eq('id', endeavorId)
      .single()

    if (endeavorError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Count pending metis candidates
    const { count: metisCount } = await supabase
      .from('metis_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('endeavor_id', endeavorId)
      .eq('status', 'pending')

    // Count pending guardrail candidates
    const { count: guardrailCount } = await supabase
      .from('guardrail_candidates')
      .select('id', { count: 'exact', head: true })
      .eq('endeavor_id', endeavorId)
      .eq('status', 'pending')

    const pendingCandidates = (metisCount || 0) + (guardrailCount || 0)

    // Count logs since last review
    let logsSinceReview = 0
    const logsQuery = supabase
      .from('logs')
      .select('id', { count: 'exact', head: true })
      .eq('entity_type', 'endeavor')
      .eq('entity_id', endeavorId)

    if (endeavor.last_reviewed_at) {
      const { count } = await logsQuery.gt('created_at', endeavor.last_reviewed_at)
      logsSinceReview = count || 0
    } else {
      const { count } = await logsQuery
      logsSinceReview = count || 0
    }

    // Calculate days since review
    let daysSinceReview: number | null = null
    if (endeavor.last_reviewed_at) {
      const lastReview = new Date(endeavor.last_reviewed_at)
      const now = new Date()
      daysSinceReview = Math.floor((now.getTime() - lastReview.getTime()) / (1000 * 60 * 60 * 24))
    }

    // Determine trigger status
    let shouldTrigger = false
    let triggerReason: TriggerReason = 'none'

    if (pendingCandidates >= ITEM_THRESHOLD) {
      shouldTrigger = true
      triggerReason = 'item_threshold'
    } else if (daysSinceReview !== null && daysSinceReview >= DAY_THRESHOLD) {
      shouldTrigger = true
      triggerReason = 'time_threshold'
    } else if (daysSinceReview === null && logsSinceReview > 0) {
      // Never reviewed but has logs - consider triggering after threshold
      if (logsSinceReview >= ITEM_THRESHOLD) {
        shouldTrigger = true
        triggerReason = 'item_threshold'
      }
    }

    const response: ReviewStatusResponse = {
      endeavor_id: endeavorId,
      pending_candidates: pendingCandidates,
      logs_since_review: logsSinceReview,
      days_since_review: daysSinceReview,
      last_reviewed_at: endeavor.last_reviewed_at,
      should_trigger: shouldTrigger,
      trigger_reason: triggerReason
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get reflect status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
