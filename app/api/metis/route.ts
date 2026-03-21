import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import {
  createMetisEntrySchema,
  metisEntryResponseSchema,
  listMetisEntriesParamsSchema,
  listMetisEntriesResponseSchema
} from '../../../lib/contracts/metis'

export const dynamic = 'force-dynamic'

/**
 * POST /api/metis
 *
 * Create a direct metis entry (bypassing candidate stage).
 * Use for trusted sources like superego observations that pass quality gates.
 *
 * Required fields:
 * - endeavor_id OR context_id (at least one)
 * - title: Brief summary
 * - content: Full description (markdown)
 *
 * Optional fields:
 * - source_type: 'manual' | 'log' | 'session' | 'harvested' (default: 'session')
 * - source_id: Reference to source
 * - confidence: 'low' | 'medium' | 'high' (default: 'medium')
 */
export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const body = await request.json()

    // Contract validation
    const parseResult = createMetisEntrySchema.safeParse(body)
    if (!parseResult.success) {
      return Response.json({
        error: 'Validation failed',
        details: parseResult.error.issues
      }, { status: 400 })
    }

    const validatedBody = parseResult.data

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data, error } = await supabase
      .from('metis_entries')
      .insert({
        endeavor_id: validatedBody.endeavor_id,
        context_id: validatedBody.context_id,
        title: validatedBody.title,
        content: validatedBody.content,
        source_type: validatedBody.source_type,
        source_id: validatedBody.source_id,
        confidence: validatedBody.confidence,
        violated_expectation: validatedBody.violated_expectation,
        observed_reality: validatedBody.observed_reality,
        consequence: validatedBody.consequence,
        created_by: user.id,
        last_reinforced_at: new Date().toISOString(),
        reinforcement_count: 1,
        status: 'active'
      })
      .select('id, title, confidence')
      .single()

    if (error) {
      console.error('Failed to create metis entry:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Validate response against contract
    const responseData = {
      success: true,
      metis_id: data.id,
      title: data.title,
      confidence: data.confidence
    }

    return Response.json(metisEntryResponseSchema.parse(responseData))
  } catch (error) {
    console.error('Create metis error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})

/**
 * GET /api/metis
 *
 * List metis entries for the authenticated user.
 * Query params:
 * - endeavor_id: Filter by endeavor
 * - context_id: Filter by context
 * - status: 'active' | 'historical' | 'superseded'
 * - limit: Max entries (default 20)
 */
export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod: 'session' | 'api_key'
) => {
  try {
    const { searchParams } = new URL(request.url)

    // Contract validation for query params
    const paramsResult = listMetisEntriesParamsSchema.safeParse({
      endeavor_id: searchParams.get('endeavor_id') || undefined,
      context_id: searchParams.get('context_id') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined
    })

    if (!paramsResult.success) {
      return Response.json({
        error: 'Invalid query parameters',
        details: paramsResult.error.issues
      }, { status: 400 })
    }

    const { endeavor_id, context_id, status, limit } = paramsResult.data

    const { getSupabaseForAuthMethod } = await import('../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    let query = supabase
      .from('metis_entries')
      .select('id, endeavor_id, context_id, title, content, confidence, source_type, last_reinforced_at, status, created_at')
      .eq('status', status)
      .order('last_reinforced_at', { ascending: false })
      .limit(limit)

    if (endeavor_id) {
      query = query.eq('endeavor_id', endeavor_id)
    }

    if (context_id) {
      query = query.eq('context_id', context_id)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch metis entries:', error)
      return Response.json({ error: error.message }, { status: 500 })
    }

    // Validate response against contract
    return Response.json(listMetisEntriesResponseSchema.parse({ entries: data }))
  } catch (error) {
    console.error('Get metis error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})
