import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'
import { revokeApiKey } from '../../../../lib/api-keys/service'

export const DELETE = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { keyId }: { keyId: string } = await context.params

    const { reason } = await request.json().catch(() => ({}))

    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const result = await revokeApiKey(user.id, keyId, reason, supabase)
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/api-keys/[keyId]:', error)
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    )
  }
})