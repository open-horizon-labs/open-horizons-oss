import { supabaseServer } from '../supabaseServer'
import { createAdminClient } from '../supabaseAdmin'
import { ContextInvitation, InviteAcceptanceResult, UserLookupResult } from './types'
import crypto from 'crypto'

/**
 * Generate a secure invitation token
 */
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Look up user by email
 * Note: We skip direct user lookup for now due to RLS restrictions
 */
export async function lookupUserByEmail(email: string): Promise<UserLookupResult> {
  // For now, we'll assume all emails are valid and let the invitation system handle it
  // The user will be looked up when they accept the invitation
  return {
    exists: false, // We don't know if they exist until they try to accept
    email
  }
}

/**
 * Create a context invitation
 */
export async function createContextInvitation(
  contextId: string,
  inviterUserId: string,
  inviteeEmail: string,
  role: 'owner' | 'editor' | 'viewer' = 'viewer',
  supabase?: any // Accept supabase client, fallback to service client if not provided
): Promise<{ success: boolean; invitation?: ContextInvitation; error?: string; statusCode?: number }> {
  if (!supabase) {
    const { supabaseServer } = await import('../supabaseServer')
    supabase = await supabaseServer()
  }

  try {
    // Use the database function to create invitation with proper permissions and validation
    // Note: role parameter is ignored as we removed role-based access
    const { data, error } = await supabase.rpc('create_context_invitation', {
      p_context_id: contextId,
      p_inviter_user_id: inviterUserId,
      p_invitee_email: inviteeEmail.toLowerCase(),
      p_role: role
    })

    if (error) {
      console.error('Failed to create invitation:', error)

      // Map specific error messages to appropriate status codes
      if (error.message.includes('not found')) {
        return { success: false, error: 'Context not found', statusCode: 404 }
      }
      if (error.message.includes('Insufficient permissions')) {
        return { success: false, error: 'Insufficient permissions to invite to this context', statusCode: 403 }
      }
      if (error.message.includes('already exists')) {
        return { success: false, error: 'Active invitation already exists for this email', statusCode: 409 }
      }

      return { success: false, error: error.message, statusCode: 400 }
    }

    const result = data[0]
    if (!result) {
      return { success: false, error: 'Failed to create invitation', statusCode: 500 }
    }

    return {
      success: true,
      invitation: {
        id: result.invitation_id,
        contextId,
        inviterUserId,
        inviteeEmail: inviteeEmail.toLowerCase(),
        role,
        token: result.token,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString()
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create invitation',
      statusCode: 500
    }
  }
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token: string): Promise<ContextInvitation | null> {
  const supabase = await supabaseServer()

  try {
    const { data, error } = await supabase
      .from('context_invitations')
      .select('*')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .single()

    if (error || !data) {
      return null
    }

    return {
      id: data.id,
      contextId: data.context_id,
      inviterUserId: data.inviter_user_id,
      inviteeEmail: data.invitee_email,
      role: data.role,
      token: data.token,
      expiresAt: data.expires_at,
      acceptedAt: data.accepted_at,
      acceptedByUserId: data.accepted_by_user_id,
      createdAt: data.created_at,
      contextTitle: data.context_title,
      contextDescription: data.context_description
    }
  } catch (error) {
    console.error('Failed to get invitation:', error)
    return null
  }
}

/**
 * Accept a context invitation
 */
export async function acceptInvitation(
  token: string,
  userId: string
): Promise<InviteAcceptanceResult> {
  const supabase = await supabaseServer()

  try {
    // Get the invitation details BEFORE accepting to capture the context ID
    const invitation = await getInvitationByToken(token)
    if (!invitation) {
      return { success: false, error: 'Invalid or expired invitation token' }
    }

    // Use the database function to accept the invitation
    const { data, error } = await supabase.rpc('accept_context_invitation', {
      p_token: token,
      p_accepter_user_id: userId
    })

    if (error) {
      console.error('Failed to accept invitation:', error)

      if (error.message.includes('Invalid or expired')) {
        return { success: false, error: 'Invalid or expired invitation token' }
      }
      if (error.message.includes('already a member')) {
        return { success: false, error: 'User is already a member of this context' }
      }
      if (error.message.includes('not found')) {
        return { success: false, error: 'User not found' }
      }

      return { success: false, error: error.message }
    }

    return {
      success: true,
      contextId: invitation.contextId,
      redirectUrl: `/dashboard`
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invitation'
    }
  }
}

/**
 * Generate invitation URL
 */
export function generateInvitationUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  return `${baseUrl}/invite/${token}`
}
