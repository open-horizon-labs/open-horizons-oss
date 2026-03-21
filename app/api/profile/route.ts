import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseForAuthMethod } from '../../../lib/supabaseForAuth'
import { withAuth, AuthenticatedUser } from '../../../lib/auth-api'

export const GET = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('about_me, llm_personalization')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json(profile || {})
  } catch (error) {
    console.error('Error in GET /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})

export const POST = withAuth(async (request: NextRequest, user: AuthenticatedUser, authMethod: 'session' | 'api_key') => {
  try {
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    const body = await request.json()
    const { about_me, llm_personalization } = body

    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        about_me,
        llm_personalization
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving profile:', error)
      return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in POST /api/profile:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
})