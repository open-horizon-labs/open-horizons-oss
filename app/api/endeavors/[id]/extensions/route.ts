import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'

export const dynamic = 'force-dynamic'

/**
 * GET /api/endeavors/[id]/extensions
 *
 * Returns guardrails and metis for an endeavor (including inherited from ancestors).
 * Primary consumer: Superego - for injecting constraints and wisdom into evaluation.
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key',
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params
    const endeavorId = decodeURIComponent(id)

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Get guardrails using the helper function (includes inheritance)
    const { data: guardrails, error: guardrailsError } = await supabase
      .rpc('get_endeavor_guardrails', { p_endeavor_id: endeavorId })

    if (guardrailsError) {
      console.error('Failed to fetch guardrails:', guardrailsError)
    }

    // Get metis summary using the helper function
    const { data: metis, error: metisError } = await supabase
      .rpc('get_endeavor_metis_summary', { p_endeavor_id: endeavorId })

    if (metisError) {
      console.error('Failed to fetch metis:', metisError)
    }

    // Format for superego consumption
    return Response.json({
      endeavor_id: endeavorId,
      guardrails: (guardrails || []).map((g: any) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        severity: g.severity,        // 'hard' | 'soft' | 'advisory'
        enforcement: g.enforcement,  // 'superego_question' | 'checklist_gate' | etc.
        tags: g.tags || [],
        inherited_from: g.source_endeavor_id,
        depth: g.inheritance_depth
      })),
      metis: (metis || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        confidence: m.confidence,    // 'low' | 'medium' | 'high'
        freshness: m.freshness,      // 'recent' | 'stale' | 'historical'
        source: m.source_endeavor_id
      }))
    })
  } catch (error) {
    console.error('Get extensions error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})
