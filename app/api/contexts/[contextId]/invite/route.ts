import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'
import { createContextInvitation, generateInvitationUrl } from '../../../../../lib/invitations/invitation-service'

export const POST = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { contextId }: { contextId: string } = await context.params

    const { email, role = 'viewer' } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const result = await createContextInvitation(contextId, user.id, email, role, supabase)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.statusCode || 400 })
    }

    const inviteUrl = generateInvitationUrl(result.invitation!.token)

    return NextResponse.json({
      success: true,
      invitation: result.invitation,
      inviteUrl
    })
  } catch (error) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
})