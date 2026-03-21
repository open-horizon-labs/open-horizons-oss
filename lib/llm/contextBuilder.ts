import { GraphNode, DatabaseNodeType } from '../contracts/endeavor-contract'

export interface UserProfile {
  about_me?: string
  llm_personalization?: string
}

export interface ContextRequest {
  user_id: string
  date: string
  context_id: string
  daily_note_body?: string
  user_profile?: UserProfile
  context_node?: {
    id: string
    title?: string
    description?: string
    node_type?: string
    tags?: string[]
    status?: string
    roles?: any[]
    practices?: string
    frequency?: string
    metadata?: Record<string, any>
  }
  context_hierarchy?: {
    id: string
    title?: string
    description?: string
    node_type?: string
    tags?: string[]
    status?: string
    roles?: any[]
    practices?: string
    frequency?: string
    metadata?: Record<string, any>
  }[]
  hierarchical_notes?: {
    context_id: string
    context_title: string
    context_type: string
    daily_notes: string
  }[]
}

export interface ContextData {
  user_profile?: UserProfile
  current_context: {
    id: string
    title: string
    type: DatabaseNodeType
    description?: string | null
    status?: string | null
    tags: string[]
    roles: any[]
    practices?: string | null
    frequency?: string | null
    metadata: Record<string, any>
    daily_notes?: string | null
  }
  hierarchy_full: Array<{
    id: string
    title: string
    type: DatabaseNodeType
    description?: string | null
    status?: string | null
    tags: string[]
    roles: any[]
    practices?: string | null
    frequency?: string | null
    metadata: Record<string, any>
    daily_notes?: string | null
    is_current: boolean
  }>
  date: string
}

/**
 * Builds structured context data for LLM interactions
 * 
 * This function processes hierarchical context information and daily notes
 * to create a comprehensive context structure that includes:
 * - Current working context with today's notes
 * - Full hierarchy from root to current with complete details
 * - Daily notes for each hierarchy level where they exist
 * 
 * @param request - The context request containing all input data
 * @returns Structured context data for LLM consumption
 */
export function buildContextData(request: ContextRequest): ContextData {
  const {
    context_id,
    date,
    daily_note_body,
    user_profile,
    context_node,
    context_hierarchy,
    hierarchical_notes
  } = request

  // Separate current context from hierarchical background
  let currentContextNotes = ''
  
  if (hierarchical_notes && hierarchical_notes.length > 0) {
    // Find current context notes
    const currentNote = hierarchical_notes.find(note => note.context_id === context_id)
    if (currentNote) {
      // Check if the note has valid metadata (non-empty title and type)
      const isValidNote = currentNote.context_title && currentNote.context_type
      currentContextNotes = isValidNote ? currentNote.daily_notes : ''
    } else {
      currentContextNotes = daily_note_body || ''
    }
  } else {
    currentContextNotes = daily_note_body || ''
  }

  // Build structured context data with complete hierarchy
  const contextData: ContextData = {
    user_profile,
    current_context: {
      id: context_node?.id || context_id,
      title: context_node?.title || 'Untitled',
      type: (context_node?.node_type as DatabaseNodeType) || DatabaseNodeType.enum.Task,
      description: context_node?.description || null,
      status: context_node?.status || null,
      tags: context_node?.tags || [],
      roles: context_node?.roles || [],
      practices: context_node?.practices || null,
      frequency: context_node?.frequency || null,
      metadata: context_node?.metadata || {},
      daily_notes: currentContextNotes || null
    },
    hierarchy_full: [],
    date: date
  }

  // Build complete hierarchy with full context data and daily notes
  if (context_hierarchy && context_hierarchy.length > 0) {
    contextData.hierarchy_full = context_hierarchy.map(node => {
      // Find daily notes for this hierarchy level
      const hierarchyNote = hierarchical_notes?.find(note => note.context_id === node.id)
      
      return {
        id: node.id,
        title: node.title || node.id,
        type: (node.node_type as DatabaseNodeType) || DatabaseNodeType.enum.Task,
        description: node.description || null,
        status: node.status || null,
        tags: node.tags || [],
        roles: node.roles || [],
        practices: node.practices || null,
        frequency: node.frequency || null,
        metadata: node.metadata || {},
        daily_notes: hierarchyNote?.daily_notes || null,
        is_current: node.id === context_id
      }
    })
  }

  return contextData
}

/**
 * Generates a cache key based on the context hierarchy
 * 
 * @param contextData - The structured context data
 * @param maxLength - Maximum length for the cache key (default: 64)
 * @returns Cache key string for OpenAI prompt caching
 */
export function generateCacheKey(contextData: ContextData, maxLength: number = 64): string {
  const hierarchyIds = contextData.hierarchy_full.map(h => h.id).join('-')
  const fullCacheKey = `oh-context-${hierarchyIds}`
  return fullCacheKey.length > maxLength ? fullCacheKey.substring(0, maxLength) : fullCacheKey
}