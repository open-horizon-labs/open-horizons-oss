/**
 * GET /api/reflect/tree/[endeavorId]
 *
 * Returns pending candidates from all descendant endeavors.
 * Used by the Reflect mode UI to show a rollup of candidates needing review
 * across the endeavor hierarchy.
 *
 * Query params:
 * - since: ISO date string to filter candidates created after this date
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { CandidateTreeResponse, EndeavorWithCandidates } from '../../../../../lib/contracts/reflect-contract'

export const dynamic = 'force-dynamic'

export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ endeavorId: string }> }
) => {
  try {
    const { endeavorId } = await params
    const { searchParams } = new URL(request.url)
    const since = searchParams.get('since')

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Verify root endeavor exists and user has access
    const { data: rootEndeavor, error: endeavorError } = await supabase
      .from('endeavors')
      .select('id, context_id')
      .eq('id', endeavorId)
      .single()

    if (endeavorError || !rootEndeavor) {
      return NextResponse.json(
        { error: 'Endeavor not found' },
        { status: 404 }
      )
    }

    // Get all descendants using recursive CTE function
    const { data: descendants, error: descendantsError } = await supabase
      .rpc('get_descendant_endeavors', { root_id: endeavorId })

    if (descendantsError) {
      console.error('Failed to fetch descendants:', descendantsError)
      return NextResponse.json(
        { error: 'Failed to fetch descendant endeavors' },
        { status: 500 }
      )
    }

    const descendantIds = (descendants || []).map((d: { id: string }) => d.id)

    if (descendantIds.length === 0) {
      const response: CandidateTreeResponse = {
        root_endeavor_id: endeavorId,
        total_pending: 0,
        endeavors_with_candidates: []
      }
      return NextResponse.json(response)
    }

    // Build candidate query with optional since filter
    let metisCandidatesQuery = supabase
      .from('metis_candidates')
      .select('*')
      .in('endeavor_id', descendantIds)
      .eq('status', 'pending')

    let guardrailCandidatesQuery = supabase
      .from('guardrail_candidates')
      .select('*')
      .in('endeavor_id', descendantIds)
      .eq('status', 'pending')

    if (since) {
      metisCandidatesQuery = metisCandidatesQuery.gte('created_at', since)
      guardrailCandidatesQuery = guardrailCandidatesQuery.gte('created_at', since)
    }

    const [
      { data: metisCandidates },
      { data: guardrailCandidates }
    ] = await Promise.all([
      metisCandidatesQuery,
      guardrailCandidatesQuery
    ])

    // Group candidates by endeavor_id
    const candidatesByEndeavor = new Map<string, {
      metis: typeof metisCandidates,
      guardrails: typeof guardrailCandidates
    }>()

    for (const c of (metisCandidates || [])) {
      if (!candidatesByEndeavor.has(c.endeavor_id)) {
        candidatesByEndeavor.set(c.endeavor_id, { metis: [], guardrails: [] })
      }
      candidatesByEndeavor.get(c.endeavor_id)!.metis!.push(c)
    }

    for (const c of (guardrailCandidates || [])) {
      if (!candidatesByEndeavor.has(c.endeavor_id)) {
        candidatesByEndeavor.set(c.endeavor_id, { metis: [], guardrails: [] })
      }
      candidatesByEndeavor.get(c.endeavor_id)!.guardrails!.push(c)
    }

    // Build response with endeavor metadata
    const endeavorsWithCandidates: EndeavorWithCandidates[] = []
    type DescendantRow = { id: string; title: string; node_type: string; parent_id: string | null }
    const endeavorMap = new Map<string, DescendantRow>(
      (descendants || []).map((d: DescendantRow) => [d.id, d])
    )

    for (const [endId, candidateGroups] of candidatesByEndeavor.entries()) {
      const endeavor = endeavorMap.get(endId)
      if (!endeavor) continue

      const allCandidates = [
        ...(candidateGroups.metis || []).map((c: any) => ({
          id: c.id,
          type: 'metis' as const,
          endeavor_id: c.endeavor_id,
          context_id: c.context_id,
          content: c.content,
          source_type: c.source_type || 'manual',
          source_id: c.source_id || null,
          status: c.status,
          confidence: c.confidence || undefined,
          violated_expectation: c.violated_expectation || undefined,
          observed_reality: c.observed_reality || undefined,
          consequence: c.consequence || undefined,
          created_at: c.created_at
        })),
        ...(candidateGroups.guardrails || []).map((c: any) => ({
          id: c.id,
          type: 'guardrail' as const,
          endeavor_id: c.endeavor_id,
          context_id: c.context_id,
          content: c.content,
          source_type: c.source_type || 'manual',
          source_id: c.source_id || null,
          status: c.status,
          severity: c.severity || undefined,
          override_protocol: c.override_protocol || undefined,
          created_at: c.created_at
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      endeavorsWithCandidates.push({
        endeavor: {
          id: endeavor.id,
          title: endeavor.title,
          node_type: endeavor.node_type,
          parent_id: endeavor.parent_id
        },
        pending_count: allCandidates.length,
        candidates: allCandidates
      })
    }

    // Sort by pending count descending
    endeavorsWithCandidates.sort((a, b) => b.pending_count - a.pending_count)

    const totalPending = endeavorsWithCandidates.reduce((sum, e) => sum + e.pending_count, 0)

    const response: CandidateTreeResponse = {
      root_endeavor_id: endeavorId,
      total_pending: totalPending,
      endeavors_with_candidates: endeavorsWithCandidates
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Get reflect tree error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
