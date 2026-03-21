import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/candidates
 *
 * Create a metis or guardrail candidate (staging before promotion).
 * Used by superego to report observations during sessions.
 */
export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()
    const {
      type,           // 'metis' | 'guardrail'
      endeavor_id,
      context_id,
      content,
      source_type = 'session',
      source_id
    } = body

    if (!type || !['metis', 'guardrail'].includes(type)) {
      return Response.json({ error: 'type must be "metis" or "guardrail"' }, { status: 400 })
    }

    if (!content) {
      return Response.json({ error: 'content is required' }, { status: 400 })
    }

    if (!endeavor_id && !context_id) {
      return Response.json({ error: 'Either endeavor_id or context_id is required' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const table = type === 'metis' ? 'metis_candidates' : 'guardrail_candidates'

    const { data, error } = await supabase
      .from(table)
      .insert({
        endeavor_id,
        context_id,
        content,
        source_type,
        source_id,
        created_by: user.id
      })
      .select('id')
      .single()

    if (error) {
      console.error(`Failed to create ${type} candidate:`, error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, candidate_id: data.id, type })
  } catch (error) {
    console.error('Create candidate error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})
