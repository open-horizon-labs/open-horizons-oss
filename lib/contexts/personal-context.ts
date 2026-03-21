import { supabaseServer } from '../supabaseServer'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Personal context utilities for reified personal context model
 */

/**
 * Generate personal context ID for a user
 */
export function getPersonalContextId(userId: string): string {
  return `personal:${userId}`
}

/**
 * Check if a context ID is a personal context
 */
export function isPersonalContextId(contextId: string): boolean {
  return contextId.startsWith('personal:')
}

/**
 * Extract user ID from personal context ID
 */
export function getUserIdFromPersonalContext(contextId: string): string | null {
  if (!isPersonalContextId(contextId)) {
    return null
  }
  return contextId.replace('personal:', '')
}

/**
 * Resolve context parameter to actual context ID
 * - null/undefined -> personal context ID for user
 * - 'personal' -> personal context ID for user
 * - other values -> pass through as-is
 */
export function resolveContextId(contextParam: string | null | undefined, userId: string): string {
  if (!contextParam || contextParam === 'personal') {
    return getPersonalContextId(userId)
  }
  return contextParam
}

/**
 * Ensure personal context exists for user, create if missing
 * REQUIRES authenticated Supabase client to enforce proper RLS
 */
export async function ensurePersonalContext(userId: string, supabase: SupabaseClient): Promise<{ success: boolean; contextId: string; error?: string }> {
  try {
    const personalContextId = getPersonalContextId(userId)
    console.log('🔍 ensurePersonalContext - Checking for personal context:', personalContextId)

    // Check if personal context already exists
    const { data: existing, error: checkError } = await supabase
      .from('contexts')
      .select('id')
      .eq('id', personalContextId)
      .eq('created_by', userId)
      .single()

    console.log('🔍 ensurePersonalContext - Check result:', { existing: !!existing, checkError: checkError?.code })

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('🔍 ensurePersonalContext - Error checking personal context:', checkError)
      return { success: false, contextId: personalContextId, error: 'Database error checking personal context' }
    }

    if (existing) {
      // Personal context already exists
      console.log('🔍 ensurePersonalContext - Personal context already exists')
      return { success: true, contextId: personalContextId }
    }

    console.log('🔍 ensurePersonalContext - Personal context does not exist, creating...')

    // Create personal context - let user define the title later
    const { error: createError } = await supabase
      .from('contexts')
      .insert({
        id: personalContextId,
        created_by: userId,
        title: 'Personal Context',
        description: 'Personal context for individual endeavors'
      })

    console.log('🔍 ensurePersonalContext - Create result:', { success: !createError, error: createError })

    if (createError) {
      console.error('🔍 ensurePersonalContext - Error creating personal context:', createError)
      // If it's an RLS policy violation, check if the context actually exists
      if (createError.code === '42501') {
        console.log('RLS policy violation during context creation, checking if context exists...')
        const { data: existingCheck, error: recheckError } = await supabase
          .from('contexts')
          .select('id')
          .eq('id', personalContextId)
          .eq('created_by', userId)
          .single()

        if (recheckError && recheckError.code !== 'PGRST116') {
          console.error('Error rechecking personal context:', recheckError)
          return { success: false, contextId: personalContextId, error: 'Database error rechecking personal context' }
        }

        if (existingCheck) {
          console.log('Personal context confirmed to exist after RLS violation')
          return { success: true, contextId: personalContextId }
        } else {
          console.error('Personal context does not exist after RLS violation - creation was actually denied')
          return { success: false, contextId: personalContextId, error: 'RLS policy prevented personal context creation' }
        }
      }
      return { success: false, contextId: personalContextId, error: 'Failed to create personal context' }
    }

    // Create context membership for the user
    console.log('🔍 ensurePersonalContext - Creating context membership...')
    const { error: membershipError } = await supabase
      .from('context_memberships')
      .insert({
        context_id: personalContextId,
        user_id: userId
      })

    console.log('🔍 ensurePersonalContext - Membership result:', { success: !membershipError, error: membershipError })

    if (membershipError) {
      console.error('🔍 ensurePersonalContext - Error creating personal context membership:', membershipError)
      // Don't fail the whole operation for membership error
    }

    console.log('🔍 ensurePersonalContext - Successfully created personal context and membership')
    return { success: true, contextId: personalContextId }
  } catch (error) {
    console.error('Unexpected error ensuring personal context:', error)
    return { success: false, contextId: getPersonalContextId(userId), error: 'Unexpected error' }
  }
}

/**
 * Get user's personal context, creating if necessary
 */
export async function getOrCreatePersonalContext(userId: string): Promise<string> {
  const supabase = await supabaseServer()
  const result = await ensurePersonalContext(userId, supabase)
  return result.contextId
}

/**
 * Check if user has access to a context (including personal context)
 */
export async function hasContextAccess(userId: string, contextId: string): Promise<boolean> {
  try {
    const supabase = await supabaseServer()

    // For personal context, check if it matches user's personal context ID
    if (isPersonalContextId(contextId)) {
      const expectedPersonalId = getPersonalContextId(userId)
      return contextId === expectedPersonalId
    }

    // For shared contexts, check membership
    const { data: membership, error } = await supabase
      .from('context_memberships')
      .select('context_id')
      .eq('context_id', contextId)
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error checking context access:', error)
      return false
    }

    return !!membership
  } catch (error) {
    console.error('Unexpected error checking context access:', error)
    return false
  }
}