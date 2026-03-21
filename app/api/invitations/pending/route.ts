import { NextRequest, NextResponse } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../lib/auth-api'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod) => {
  try {
    const { getSupabaseForAuthMethod } = await import('../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)
    const { data, error } = await supabase.rpc('get_user_pending_invitations', {
      p_user_email: user.email
    })

    if (error) {
      console.error('Error fetching user invitations:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Error in pending invitations API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})