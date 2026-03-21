import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { createContextInvitation } from '../../../../../lib/invitations/invitation-service'

export const GET = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { contextId }: { contextId: string } = await context.params

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const { data, error } = await supabase.rpc('get_context_pending_invitations', {
      p_context_id: contextId,
      p_user_id: user.id
    })

    if (error) {
      console.error('Error fetching context invitations:', error)
      if (error.message.includes('No access')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error fetching invitations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { contextId }: { contextId: string } = await context.params
    const body = await request.json()
    const { inviteeEmail, role = 'viewer' } = body

    if (!inviteeEmail) {
      return NextResponse.json({ error: 'inviteeEmail is required' }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteeEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate role
    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be owner, editor, or viewer' }, { status: 400 })
    }

    const result = await createContextInvitation(contextId, user.id, inviteeEmail, role)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 })
    }

    return NextResponse.json({
      success: true,
      invitationId: result.invitation!.id,
      token: result.invitation!.token
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { invitationId } = await request.json()

    if (!invitationId) {
      return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const { data, error } = await supabase.rpc('revoke_context_invitation', {
      p_invitation_id: invitationId,
      p_revoker_user_id: user.id
    })

    if (error) {
      console.error('Error revoking invitation:', error)
      if (error.message.includes('Insufficient permissions')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error revoking invitation:', error)
    return NextResponse.json(
      { error: 'Failed to revoke invitation' },
      { status: 500 }
    )
  }
})