import { query, queryOne, execute } from '../db'

export interface ContextNode {
  id: string
  title: string
  description?: string
  created_at: string
  is_owner: boolean
}

/**
 * Get all contexts
 */
export async function getUserContexts(userId: string): Promise<ContextNode[]> {
  try {
    const contexts = await query(
      'SELECT id, title, description, created_at FROM contexts ORDER BY created_at ASC'
    )

    return contexts.map((item: any) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      created_at: item.created_at,
      is_owner: true,
    }))
  } catch (error) {
    console.error('Error in getUserContexts:', error)
    return []
  }
}

/**
 * Create a new context
 */
export async function createContext(
  userId: string,
  title: string,
  description: string = '',
): Promise<{ success: boolean; contextId?: string; error?: string }> {
  try {
    const contextId = `context:${Date.now()}`

    await query(
      'INSERT INTO contexts (id, title, description) VALUES ($1, $2, $3)',
      [contextId, title, description]
    )

    return { success: true, contextId }
  } catch (error) {
    console.error('Error creating context:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
