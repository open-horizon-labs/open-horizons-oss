import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'
import { getSupabaseForAuthMethod } from '../../../lib/supabaseForAuth'
import { ensurePersonalContext } from '../../../lib/contexts/personal-context'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    console.log('🏠 Dashboard API - Starting request')
    console.log('🏠 Dashboard API - User:', user?.id, user?.email)

    const { searchParams } = new URL(request.url)
    const contextId = searchParams.get('contextId')
    console.log('🏠 Dashboard API - Context ID from URL:', contextId)

    // Get properly authenticated Supabase client that respects RLS
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Resolve context ID (handle 'personal' → actual personal context ID)
    const resolvedContextId = contextId === 'personal' ? `personal:${user.id}` : contextId

    // Only check personal context if we're actually trying to load it
    if (!contextId || contextId === 'personal' || resolvedContextId === `personal:${user.id}`) {
      // Only ensure personal context for personal context requests
      const personalContextResult = await ensurePersonalContext(user.id, supabase)
      if (!personalContextResult.success) {
        console.error('🏠 Dashboard API - Failed to ensure personal context:', personalContextResult.error)
      }
    }

    console.log('🏠 Dashboard API - Loading endeavors for context:', resolvedContextId || 'personal')

    // Load endeavors for the specific context (or personal if no contextId)
    const { data: endeavors, error: endeavorsError } = await supabase
      .from('endeavors')
      .select('*')
      .eq('context_id', resolvedContextId || `personal:${user.id}`)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    console.log('🏠 Dashboard API - Loaded endeavors:', endeavors?.length || 0, 'Error:', endeavorsError)

    if (endeavorsError) {
      console.error('🏠 Dashboard API - Error loading endeavors:', endeavorsError)
      return NextResponse.json({ nodes: [] })
    }

    // Convert to contract format
    const nodes = (endeavors || []).map((endeavor: any) => ({
      id: endeavor.id,
      node_type: endeavor.node_type,
      parent_id: endeavor.parent_id,
      title: endeavor.title,
      description: endeavor.description || '',
      status: endeavor.status,
      metadata: endeavor.metadata || {},
      created_at: endeavor.created_at,
      archived_at: endeavor.archived_at
    }))

    return NextResponse.json({ nodes })
  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    )
  }
})