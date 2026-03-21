import { query, queryOne } from '../db'

/**
 * Personal context utilities -- simplified for standalone Postgres.
 * The concept of "personal context" is simplified to just a default context.
 */

export function getPersonalContextId(userId: string): string {
  return 'default'
}

export function isPersonalContextId(contextId: string): boolean {
  return contextId === 'default' || contextId.startsWith('personal:')
}

export function getUserIdFromPersonalContext(contextId: string): string | null {
  if (contextId === 'default') return 'default-user'
  if (!contextId.startsWith('personal:')) return null
  return contextId.replace('personal:', '')
}

export function resolveContextId(contextParam: string | null | undefined, userId: string): string {
  if (!contextParam || contextParam === 'personal') {
    return 'default'
  }
  return contextParam
}

/**
 * Ensure default context exists
 */
export async function ensurePersonalContext(userId: string, supabase?: any): Promise<{ success: boolean; contextId: string; error?: string }> {
  try {
    const contextId = 'default'

    const existing = await queryOne('SELECT id FROM contexts WHERE id = $1', [contextId])

    if (!existing) {
      await query(
        'INSERT INTO contexts (id, title, description) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [contextId, 'Default Context', 'Your personal workspace for organizing endeavors']
      )
    }

    return { success: true, contextId }
  } catch (error) {
    console.error('Error ensuring default context:', error)
    return { success: false, contextId: 'default', error: 'Unexpected error' }
  }
}

export async function getOrCreatePersonalContext(userId: string): Promise<string> {
  const result = await ensurePersonalContext(userId)
  return result.contextId
}

export async function hasContextAccess(userId: string, contextId: string): Promise<boolean> {
  // No auth -- everyone has access to everything
  return true
}
