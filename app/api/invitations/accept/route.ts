import { NextRequest, NextResponse } from 'next/server'
import { withSimpleAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { acceptInvitation } from '../../../../lib/invitations/invitation-service'

export const POST = withSimpleAuth(async (request: NextRequest, user: AuthenticatedUser) => {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 })
    }

    // Validate token format (should be base64)
    if (!token || typeof token !== 'string' || token.length === 0) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 })
    }

    const result = await acceptInvitation(token, user.id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true, contextId: result.contextId, redirectUrl: result.redirectUrl })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
})