import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { getSupabaseForAuthMethod } from '../../../../lib/supabaseForAuth'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    // Get properly authenticated Supabase client
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Load all personal endeavors (no context filtering)
    const { data: endeavors } = await supabase
      .from('endeavors')
      .select('*')
      .eq('context_id', `personal:${user.id}`)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

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
      archived_at: endeavor.archived_at
    }))

    return NextResponse.json({ nodes })
  } catch (error) {
    console.error('Personal endeavors API error:', error)
    return NextResponse.json(
      { error: 'Failed to load personal endeavors' },
      { status: 500 }
    )
  }
})