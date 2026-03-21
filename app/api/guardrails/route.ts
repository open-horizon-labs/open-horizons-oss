import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/guardrails
 *
 * Create a new guardrail for an endeavor or context.
 */
export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()
    const {
      endeavor_id,
      context_id,
      title,
      description,
      severity = 'soft',
      enforcement = 'superego_question',
      tags = [],
      rationale
    } = body

    if (!title) {
      return Response.json({ error: 'title is required' }, { status: 400 })
    }

    if (!endeavor_id && !context_id) {
      return Response.json({ error: 'Either endeavor_id or context_id is required' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data, error } = await supabase
      .from('guardrails')
      .insert({
        endeavor_id,
        context_id,
        title,
        description,
        severity,
        enforcement,
        tags,
        rationale,
        created_by: user.id
      })
      .select('id')
      .single()

    if (error) {
      console.error('Failed to create guardrail:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ success: true, guardrail_id: data.id })
  } catch (error) {
    console.error('Create guardrail error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * GET /api/guardrails
 *
 * List guardrails for a context or endeavor.
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const { searchParams } = new URL(request.url)
    const endeavorId = searchParams.get('endeavor_id')
    const contextId = searchParams.get('context_id')

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    let query = supabase
      .from('guardrails')
      .select('*')
      .eq('status', 'active')

    if (endeavorId) {
      query = query.eq('endeavor_id', endeavorId)
    }
    if (contextId) {
      query = query.eq('context_id', contextId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to fetch guardrails:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ guardrails: data })
  } catch (error) {
    console.error('List guardrails error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})
