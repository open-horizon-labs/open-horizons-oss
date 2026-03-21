/**
 * Server-side context validation utilities -- simplified for standalone Postgres
 */

import { queryOne, query } from '../db'

/**
 * Validate and resolve context ID.
 * Ensures the context exists, creates 'default' if needed.
 */
export async function validateAndResolveContext(
  contextId: string | null | undefined,
  authenticatedUserId: string,
  supabase?: any
): Promise<{ success: true; contextId: string } | { success: false; error: string }> {
  try {
    const resolvedContextId = contextId || 'default'

    const existing = await queryOne('SELECT id FROM contexts WHERE id = $1', [resolvedContextId])

    if (!existing) {
      // Auto-create the default context if it does not exist
      if (resolvedContextId === 'default') {
        await query(
          'INSERT INTO contexts (id, title, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          ['default', 'Default Context', 'Your personal workspace for organizing endeavors']
        )
        return { success: true, contextId: resolvedContextId }
      }
      return { success: false, error: `Context '${resolvedContextId}' does not exist` }
    }

    return { success: true, contextId: resolvedContextId }
  } catch (error) {
    return { success: false, error: `Context validation failed: ${error instanceof Error ? error.message : String(error)}` }
  }
}
