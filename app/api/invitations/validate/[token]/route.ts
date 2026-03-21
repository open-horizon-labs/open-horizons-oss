import { NextRequest, NextResponse } from 'next/server'
import { getInvitationByToken } from '../../../../../lib/invitations/invitation-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    if (!token) {
      return NextResponse.json({ valid: false, error: 'Token is required' }, { status: 400 })
    }

    const invitation = await getInvitationByToken(token)

    if (!invitation) {
      return NextResponse.json({ valid: false, error: 'Invalid or expired invitation token' }, { status: 404 })
    }

    return NextResponse.json({
      valid: true,
      contextTitle: invitation.contextTitle,
      inviteeEmail: invitation.inviteeEmail,
      role: invitation.role,
      contextId: invitation.contextId
    })
  } catch (error) {
    console.error('Error validating invitation token:', error)
    return NextResponse.json(
      { valid: false, error: 'Failed to validate invitation token' },
      { status: 500 }
    )
  }
}