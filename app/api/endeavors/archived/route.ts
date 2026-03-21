import { NextRequest } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { getSupabaseForAuthMethod } from '../../../../lib/supabaseForAuth'

export const GET = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { searchParams } = new URL(request.url)
    const contextId = searchParams.get('contextId')

    // Get properly authenticated Supabase client
    const supabase = await getSupabaseForAuthMethod('session', user.id)

    // Resolve context ID (handle 'personal' → actual personal context ID)
    const resolvedContextId = contextId === 'personal' ? `personal:${user.id}` : contextId

    // Load archived endeavors for the specific context (or personal if no contextId)
    const { data: endeavors, error } = await supabase
      .from('endeavors')
      .select('*')
      .eq('context_id', resolvedContextId || `personal:${user.id}`)
      .not('archived_at', 'is', null) // Only archived endeavors
      .order('archived_at', { ascending: false }) // Most recently archived first

    if (error) {
      console.error('Error loading archived endeavors:', error)
      return Response.json({ nodes: [] })
    }

    // Convert to contract format
    const nodes = (endeavors || []).map(endeavor => ({
      id: endeavor.id,
      node_type: endeavor.node_type,
      parent_id: endeavor.parent_id,
      title: endeavor.title,
      description: endeavor.description || '',
      status: endeavor.status,
      metadata: endeavor.metadata || {},
      created_at: endeavor.created_at,
      archived_at: endeavor.archived_at,
      archived_reason: endeavor.archived_reason
    }))

    return Response.json({ nodes })
  } catch (error) {
    console.error('Archived endeavors API error:', error)
    return Response.json(
      { error: 'Failed to load archived endeavors' },
      { status: 500 }
    )
  }
})