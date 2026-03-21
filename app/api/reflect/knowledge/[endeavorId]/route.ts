/**
 * GET /api/reflect/knowledge/[endeavorId]
 *
 * Returns active metis, guardrails, and pending candidates for an endeavor.
 * Used by the Reflect mode UI to show current knowledge and review queue.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { ActiveKnowledgeResponse } from '../../../../../lib/contracts/reflect-contract'

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

    // Verify endeavor exists and user has access
    const { data: endeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id, context_id')
      .eq('id', endeavorId)
      .single()

    if (endeavorError || !endeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Get metis using helper function (includes inherited)
    const { data: metisRaw, error: metisError } = await supabase
      .rpc('get_endeavor_metis_summary', { p_endeavor_id: endeavorId })

    if (metisError) {
      console.error('Failed to fetch metis:', metisError)
    }

    // Get guardrails using helper function (includes inherited)
    const { data: guardrailsRaw, error: guardrailsError } = await supabase
      .rpc('get_endeavor_guardrails', { p_endeavor_id: endeavorId })

    if (guardrailsError) {
      console.error('Failed to fetch guardrails:', guardrailsError)
    }

    // Get pending metis candidates
    const { data: metisCandidates } = await supabase
      .from('metis_candidates')
      .select('*')
      .eq('endeavor_id', endeavorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Get pending guardrail candidates
    const { data: guardrailCandidates } = await supabase
      .from('guardrail_candidates')
      .select('*')
      .eq('endeavor_id', endeavorId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Format metis for response
    const metis = (metisRaw || []).map((m: any) => ({
      id: m.id,
      title: m.title,
      content: m.content,
      confidence: m.confidence || 'medium',
      freshness: m.freshness || 'recent',
      violated_expectation: m.violated_expectation || null,
      observed_reality: m.observed_reality || null,
      consequence: m.consequence || null,
      created_at: m.created_at
    }))

    // Format guardrails for response
    const guardrails = (guardrailsRaw || []).map((g: any) => ({
      id: g.id,
      title: g.title,
      description: g.description || null,
      severity: g.severity || 'soft',
      enforcement: g.enforcement || 'require_rationale',
      override_protocol: g.override_protocol || null,
      created_at: g.created_at
    }))

    // Format pending candidates
    const pendingCandidates = [
      ...(metisCandidates || []).map((c: any) => ({
        id: c.id,
        type: 'metis' as const,
        endeavor_id: c.endeavor_id,
        context_id: c.context_id,
        content: c.content,
        source_type: c.source_type || 'manual',
        source_id: c.source_id || null,
        status: c.status,
        created_at: c.created_at
      })),
      ...(guardrailCandidates || []).map((c: any) => ({
        id: c.id,
        type: 'guardrail' as const,
        endeavor_id: c.endeavor_id,
        context_id: c.context_id,
        content: c.content,
        source_type: c.source_type || 'manual',
        source_id: c.source_id || null,
        status: c.status,
        created_at: c.created_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const response: ActiveKnowledgeResponse = {
      endeavor_id: endeavorId,
      metis,
      guardrails,
      pending_candidates: pendingCandidates
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get reflect knowledge error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
