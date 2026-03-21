import { supabaseServer } from '../supabaseServer'
import { DatabaseNodeType } from '../contracts/endeavor-contract'

// Types for the simplified schema
export interface ContextNode {
  id: string
  title: string
  description?: string
  created_by: string
  created_at: string
  ui_config: {
    typeMappings?: Record<string, string>
    labels?: Record<string, string>
  }
  // User's relationship to this context
  is_owner: boolean
}

export interface PendingInvitation {
  id: string
  context_id: string
  context_title: string
  context_description?: string
  role: string
  inviter_email: string
  created_at: string
  expires_at: string
  token: string
}

export interface ContextMember {
  user_id: string
  joined_at: string
}

/**
 * Get all contexts accessible to a user (owned + member)
 * Ensures personal context exists before returning results
 */
export async function getUserContexts(userId: string): Promise<ContextNode[]> {
  const supabase = await supabaseServer()

  try {
    console.log('📍 getUserContexts - querying contexts for user:', userId)

    // Use a single query with UNION to get both owned and member contexts
    const { data, error } = await supabase.rpc('get_user_contexts', {
      p_user_id: userId
    })

    console.log('📍 getUserContexts - Query result:', { data, error })

    if (error) {
      console.error('📍 getUserContexts - Query error:', error)
      return []
    }

    console.log('📍 getUserContexts - Raw context data:', data)
    console.log('📍 getUserContexts - Data length:', data?.length || 0)

    // Transform the database result to match ContextNode interface
    const contexts = data?.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      created_by: item.created_by,
      created_at: item.created_at,
      is_owner: item.created_by === userId,
      ui_config: {
        typeMappings: {},
        labels: {
          [DatabaseNodeType.enum.Mission]: DatabaseNodeType.enum.Mission,
          [DatabaseNodeType.enum.Aim]: DatabaseNodeType.enum.Aim,
          [DatabaseNodeType.enum.Initiative]: DatabaseNodeType.enum.Initiative,
          [DatabaseNodeType.enum.Task]: DatabaseNodeType.enum.Task,
          ritual: 'Ritual',
          strength: 'Strength',
          achievement: 'Achievement',
          context: 'Context',
          goal: 'Goal',
          project: 'Project',
          practice: 'Practice',
          daily_page: 'Daily Page',
          user: 'User'
        }
      }
    })) || []

    console.log('📍 getUserContexts - Transformed contexts:', contexts.map((c: ContextNode) => ({ id: c.id, title: c.title, is_owner: c.is_owner })))

    return contexts
  } catch (error) {
    console.error('Error in getUserContexts:', error)
    return []
  }
}

/**
 * Load endeavors visible in a specific context using simplified context_id model
 */
export async function loadContextEndeavors(contextId: string, userId: string): Promise<any[]> {
  const supabase = await supabaseServer()

  try {
    // Simple query: get all endeavors in this context that user can access via RLS
    const { data, error } = await supabase
      .from('endeavors')
      .select('*')
      .eq('context_id', contextId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading context endeavors:', error)
      return []
    }

    // Transform to match existing endeavor format
    const endeavors = data?.map((endeavor: any) => ({
      id: endeavor.id,
      title: endeavor.title,
      description: endeavor.description,
      status: endeavor.status,
      type: 'endeavor',
      access_type: endeavor.created_by === userId ? 'owner' : 'viewer',
      context_id: endeavor.context_id,
      created_at: endeavor.created_at,
      updated_at: endeavor.updated_at
    })) || []

    return endeavors
  } catch (error) {
    console.error('Error in loadContextEndeavors:', error)
    return []
  }
}

/**
 * Create a new context using simplified model
 */
export async function createContext(
  userId: string,
  title: string,
  description: string = '',
  sharedEndeavors: string[] = [],
  supabaseClient?: any
): Promise<{ success: boolean; contextId?: string; error?: string }> {
  const supabase = supabaseClient || await supabaseServer()

  try {
    // Generate context ID
    const contextId = `context:${userId}:${Date.now()}`

    // Create context (no root_endeavor_ids needed)
    const { error: contextError } = await supabase
      .from('contexts')
      .insert({
        id: contextId,
        created_by: userId,
        title,
        description,
        ui_config: {
          typeMappings: {},
          labels: {
            [DatabaseNodeType.enum.Mission]: DatabaseNodeType.enum.Mission,
            [DatabaseNodeType.enum.Aim]: DatabaseNodeType.enum.Aim,
            [DatabaseNodeType.enum.Initiative]: DatabaseNodeType.enum.Initiative,
            [DatabaseNodeType.enum.Task]: DatabaseNodeType.enum.Task,
            ritual: 'Ritual',
            strength: 'Strength',
            achievement: 'Achievement',
            context: 'Context',
            goal: 'Goal',
            project: 'Project',
            practice: 'Practice',
            daily_page: 'Daily Page',
            user: 'User'
          }
        }
      })

    if (contextError) {
      console.error('Failed to create context:', contextError)
      return { success: false, error: contextError.message }
    }

    // Create membership for the context creator
    const { error: membershipError } = await supabase
      .from('context_memberships')
      .insert({
        context_id: contextId,
        user_id: userId
      })

    if (membershipError) {
      console.error('Failed to create context membership:', membershipError)
      return { success: false, error: membershipError.message }
    }

    // Move shared endeavors to this context (update context_id)
    if (sharedEndeavors.length > 0) {
      const { error: moveError } = await supabase
        .from('endeavors')
        .update({ context_id: contextId })
        .in('id', sharedEndeavors)
        .eq('created_by', userId)

      if (moveError) {
        console.error('Failed to move endeavors to context:', moveError)
        return { success: false, error: moveError.message }
      }
    }

    return { success: true, contextId }
  } catch (error) {
    console.error('Error creating context:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}



/**
 * Create a context invitation
 */
export async function createContextInvitation(
  contextId: string,
  inviterUserId: string,
  inviteeEmail: string,
  role: 'owner' | 'editor' | 'viewer' = 'viewer'
): Promise<{ success: boolean; invitationId?: string; token?: string; error?: string }> {
  const supabase = await supabaseServer()

  try {
    const { data, error } = await supabase.rpc('create_context_invitation', {
      p_context_id: contextId,
      p_inviter_user_id: inviterUserId,
      p_invitee_email: inviteeEmail,
      p_role: role
    })

    if (error) {
      console.error('Failed to create invitation:', error)
      return { success: false, error: error.message }
    }

    const result = data?.[0]
    return {
      success: true,
      invitationId: result?.invitation_id,
      token: result?.token
    }
  } catch (error) {
    console.error('Error creating invitation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Revoke a context invitation
 */
export async function revokeContextInvitation(
  invitationId: string,
  revokerUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await supabaseServer()

  try {
    const { error } = await supabase.rpc('revoke_context_invitation', {
      p_invitation_id: invitationId,
      p_revoker_user_id: revokerUserId
    })

    if (error) {
      console.error('Failed to revoke invitation:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Error revoking invitation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get pending invitations for a context
 */
export async function getContextPendingInvitations(
  contextId: string,
  userId: string
): Promise<PendingInvitation[]> {
  const supabase = await supabaseServer()

  try {
    const { data, error } = await supabase.rpc('get_context_pending_invitations', {
      p_context_id: contextId,
      p_user_id: userId
    })

    if (error) {
      console.error('Error fetching context invitations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getContextPendingInvitations:', error)
    return []
  }
}

/**
 * Get pending invitations for a user (by email)
 */
export async function getUserPendingInvitations(
  userEmail: string
): Promise<PendingInvitation[]> {
  const supabase = await supabaseServer()

  try {
    const { data, error } = await supabase.rpc('get_user_pending_invitations', {
      p_user_email: userEmail
    })

    if (error) {
      console.error('Error fetching user invitations:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in getUserPendingInvitations:', error)
    return []
  }
}

/**
 * Accept a context invitation
 */
export async function acceptContextInvitation(
  token: string,
  userId: string
): Promise<{ success: boolean; contextId?: string; error?: string }> {
  const supabase = await supabaseServer()

  try {
    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('context_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (inviteError || !invitation) {
      return { success: false, error: 'Invalid or expired invitation' }
    }

    // Create context membership
    const { error: membershipError } = await supabase
      .from('context_memberships')
      .insert({
        context_id: invitation.context_id,
        user_id: userId,
        invited_by: invitation.inviter_user_id,
        invitation_token: token
      })

    if (membershipError) {
      console.error('Failed to create membership:', membershipError)
      return { success: false, error: membershipError.message }
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabase
      .from('context_invitations')
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: userId
      })
      .eq('token', token)

    if (updateError) {
      console.error('Failed to update invitation:', updateError)
      // Don't fail here, membership was created successfully
    }

    // No need to grant access to endeavors - RLS handles this through context membership

    return { success: true, contextId: invitation.context_id }
  } catch (error) {
    console.error('Error accepting invitation:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
