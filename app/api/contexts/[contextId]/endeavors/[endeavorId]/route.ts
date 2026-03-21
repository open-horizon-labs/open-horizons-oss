import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../../lib/auth-api'

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const params: { contextId: string; endeavorId: string } = await context.params
    const { contextId, endeavorId } = params

    const { getSupabaseForAuthMethod } = await import('../../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Load the context
    const { data: contextData, error: loadError } = await supabase
      .from('endeavors')
      .select('metadata')
      .eq('id', contextId)
      .single()

    if (loadError || !contextData) {
      return NextResponse.json({ error: 'Context not found' }, { status: 404 })
    }

    // Check permissions (need to import the helper function properly)
    const participants = contextData.metadata?.participants || []
    const participant = participants.find((p: any) => p.userId === user.id)
    const permission = participant?.role || null

    if (permission !== 'owner' && permission !== 'editor') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Remove endeavor from shared list
    const metadata = contextData.metadata || {}
    const sharedEndeavors = (metadata.sharedEndeavors || []).filter(
      (id: string) => id !== endeavorId
    )
    const typeMappings = metadata.typeMappings || {}
    delete typeMappings[endeavorId]

    const updatedMetadata = {
      ...metadata,
      sharedEndeavors,
      typeMappings
    }

    const { error } = await supabase
      .from('endeavors')
      .update({ metadata: updatedMetadata })
      .eq('id', contextId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing endeavor from context:', error)
    return NextResponse.json(
      { error: 'Failed to remove endeavor from context' },
      { status: 500 }
    )
  }
})