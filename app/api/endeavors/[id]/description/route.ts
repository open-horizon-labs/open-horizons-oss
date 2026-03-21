import { NextRequest } from 'next/server'
import { withAuth, AuthenticatedUser } from '../../../../../lib/auth-api'

// Shared handler for description updates - RLS handles access control for shared contexts
const handleDescriptionUpdate = withAuth(async (
  request: NextRequest,
  user: AuthenticatedUser,
  authMethod,
  context
) => {
  try {
    const { id: endeavorId } = await context.params
    const { description } = await request.json()

    const { getSupabaseForAuthMethod } = await import('../../../../../lib/supabaseForAuth')
    const supabase = await getSupabaseForAuthMethod(authMethod, user.id)

    // Update the endeavor description - RLS handles access control for shared contexts
    // Removed .eq('user_id', user.id) which was breaking shared context updates
    const { data, error } = await supabase
      .from('endeavors')
      .update({
        description,
        updated_at: new Date().toISOString()
      })
      .eq('id', decodeURIComponent(endeavorId))
      .select('id')
      .single()

    if (error) {
      console.error('Error updating description:', error)
      if (error.code === 'PGRST116') {
        return Response.json({ error: 'Endeavor not found or not accessible' }, { status: 404 })
      }
      return Response.json({ error: 'Failed to update description' }, { status: 500 })
    }

    if (!data) {
      return Response.json({ error: 'Endeavor not found or not accessible' }, { status: 404 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Error in description update:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
})

// Support both PUT (existing UI) and PATCH (semantically correct)
export const PUT = handleDescriptionUpdate
export const PATCH = handleDescriptionUpdate