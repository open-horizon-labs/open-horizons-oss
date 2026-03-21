import { supabaseServer } from '../supabaseServer'
// Helper to generate user node ID
function getUserNodeId(userId: string): string {
  return `user:${userId}`
}
import { ensurePersonalContext, getPersonalContextId } from '../contexts/personal-context'
import type { User } from '@supabase/supabase-js'

/**
 * Ensure user has a user identity node in the graph.
 * This should be called after successful authentication.
 */
export async function ensureUserNode(userId: string, supabaseClient?: any): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseClient || await supabaseServer()
  const userNodeId = getUserNodeId(userId)
  
  try {
    // Get user profile data for title
    const { data: { user } } = await supabase.auth.getUser()
    const userTitle = user?.user_metadata?.full_name ||
                     user?.user_metadata?.name ||
                     user?.email?.split('@')[0] ||
                     'User'

    // Try to create user endeavor node (will fail gracefully if already exists)
    const { error: endeavorError } = await supabase
      .from('endeavors')
      .insert({
        id: userNodeId,
        user_id: userId,
        created_by: userId,  // Add created_by field
        title: userTitle,
        description: 'Global user node for daily logs and cross-endeavor work',
        status: 'active',
        metadata: {
          node_type: 'user',
          is_system_node: true,
          created_via: 'application'
        }
      })

    // If endeavor creation failed due to duplicate key, that's fine - it already exists
    if (endeavorError && endeavorError.code !== '23505') {
      console.error('Failed to create user endeavor node:', endeavorError)
      return { success: false, error: endeavorError.message }
    }

    const userNodeAlreadyExisted = endeavorError && endeavorError.code === '23505'
    
    if (userNodeAlreadyExisted) {
      console.log(`User node ${userNodeId} already existed for user ${userId}`)
    } else {
      console.log(`Created user node ${userNodeId} for user ${userId}`)
    }

    // Ensure personal context exists for the user
    console.log(`Ensuring personal context for user ${userId}`)
    const personalContextResult = await ensurePersonalContext(userId, supabase)
    if (!personalContextResult.success) {
      console.error('Failed to ensure personal context during user setup:', personalContextResult.error)
      // Don't fail the whole operation - user node creation succeeded
    } else {
      console.log(`Personal context ensured: ${personalContextResult.contextId}`)
    }

    return { success: true }
    
  } catch (error) {
    console.error('Error ensuring user node:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

/**
 * Ensure user has a user identity node in the graph, using provided user data.
 * This should be called after successful authentication with user data.
 * @param user - The authenticated user
 * @param supabaseClient - Optional Supabase client to use (important for auth callback)
 */
export async function ensureUserNodeWithData(user: User, supabaseClient?: any): Promise<{ success: boolean; error?: string }> {
  const supabase = supabaseClient || await supabaseServer()
  const userNodeId = getUserNodeId(user.id)
  
  try {
    // Use provided user data for title
    const userTitle = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     user.email?.split('@')[0] ||
                     'User'

    // Try to create user endeavor node (will fail gracefully if already exists)
    const { error: endeavorError } = await supabase
      .from('endeavors')
      .insert({
        id: userNodeId,
        user_id: user.id,
        created_by: user.id,  // Add created_by field
        title: userTitle,
        description: 'Global user node for daily logs and cross-endeavor work',
        status: 'active',
        metadata: {
          node_type: 'user',
          is_system_node: true,
          created_via: 'application'
        }
      })

    // If endeavor creation failed due to duplicate key, that's fine - it already exists
    if (endeavorError && endeavorError.code !== '23505') {
      console.error('Failed to create user endeavor node:', endeavorError)
      return { success: false, error: endeavorError.message }
    }

    const userNodeAlreadyExisted = endeavorError && endeavorError.code === '23505'
    
    if (userNodeAlreadyExisted) {
      console.log(`User node ${userNodeId} already existed for user ${user.id}`)
    } else {
      console.log(`Created user node ${userNodeId} for user ${user.id}`)
    }

    // Ensure personal context exists for the user
    console.log(`Ensuring personal context for user ${user.id}`)
    const personalContextResult = await ensurePersonalContext(user.id, supabase)
    if (!personalContextResult.success) {
      console.error('Failed to ensure personal context during user setup:', personalContextResult.error)
      // Don't fail the whole operation - user node creation succeeded
    } else {
      console.log(`Personal context ensured: ${personalContextResult.contextId}`)
    }

    return { success: true }
    
  } catch (error) {
    console.error('Error ensuring user node:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }
  }
}

/**
 * Check if user has been set up with identity node
 */
export async function isUserSetup(userId: string): Promise<boolean> {
  const supabase = await supabaseServer()
  const userNodeId = getUserNodeId(userId)
  
  const { data } = await supabase
    .from('endeavors')
    .select('id')
    .eq('id', userNodeId)
    .maybeSingle()
  
  return data !== null
}