/**
 * Server-side context validation utilities
 * This file contains server-only functions that require supabase and personal-context imports
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getPersonalContextId, ensurePersonalContext } from '../contexts/personal-context'

/**
 * Comprehensive context validation and resolution that prevents FK violations
 * This function catches context issues BEFORE database insertion
 */
export async function validateAndResolveContext(
  contextId: string | null | undefined,
  authenticatedUserId: string,
  supabase: SupabaseClient
): Promise<{ success: true; contextId: string } | { success: false; error: string }> {
  try {
    let resolvedContextId: string

    if (!contextId || contextId === 'personal') {
      // Null/undefined/personal -> resolve to user's personal context
      const personalResult = await ensurePersonalContext(authenticatedUserId, supabase)
      if (!personalResult.success) {
        return { success: false, error: `Failed to ensure personal context: ${personalResult.error}` }
      }
      resolvedContextId = personalResult.contextId
    } else if (contextId.startsWith('personal:')) {
      // Personal context format -> validate it matches the user
      const contextUserId = contextId.replace('personal:', '')
      if (contextUserId !== authenticatedUserId) {
        return {
          success: false,
          error: `Personal context ID mismatch: '${contextId}' does not match authenticated user '${authenticatedUserId}'. This indicates a session/authentication bug.`
        }
      }

      // Ensure the personal context exists
      const personalResult = await ensurePersonalContext(authenticatedUserId, supabase)
      if (!personalResult.success) {
        return { success: false, error: `Failed to ensure personal context: ${personalResult.error}` }
      }
      resolvedContextId = personalResult.contextId
    } else {
      // Regular context -> validate it exists and user has access
      const { data: context, error } = await supabase
        .from('contexts')
        .select('id')
        .eq('id', contextId)
        .single()

      if (error || !context) {
        return { success: false, error: `Context '${contextId}' does not exist or you don't have access to it` }
      }

      resolvedContextId = contextId
    }

    return { success: true, contextId: resolvedContextId }
  } catch (error) {
    return { success: false, error: `Context validation failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}