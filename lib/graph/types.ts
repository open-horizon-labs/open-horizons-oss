import { DatabaseNodeType, GraphNode as ContractGraphNode } from '../contracts/endeavor-contract'

// Re-export the contract GraphNode as the single source of truth
export type GraphNode = ContractGraphNode

// Helper functions to work with the hierarchy using contract enums
export function getCoreRdfTypes(): DatabaseNodeType[] {
  return [DatabaseNodeType.enum.Mission, DatabaseNodeType.enum.Aim, DatabaseNodeType.enum.Initiative, DatabaseNodeType.enum.Task]
}

export function getValidChildTypes(parentType: DatabaseNodeType): DatabaseNodeType[] {
  // Simple hierarchy: mission -> aim -> initiative -> task
  switch (parentType) {
    case DatabaseNodeType.enum.Mission: return [DatabaseNodeType.enum.Aim]
    case DatabaseNodeType.enum.Aim: return [DatabaseNodeType.enum.Initiative]
    case DatabaseNodeType.enum.Initiative: return [DatabaseNodeType.enum.Task]
    case DatabaseNodeType.enum.Task: return []
    default: return []
  }
}

export function getValidParentTypes(childType: DatabaseNodeType): DatabaseNodeType[] {
  // Simple hierarchy: task <- initiative <- aim <- mission
  switch (childType) {
    case DatabaseNodeType.enum.Aim: return [DatabaseNodeType.enum.Mission]
    case DatabaseNodeType.enum.Initiative: return [DatabaseNodeType.enum.Aim]
    case DatabaseNodeType.enum.Task: return [DatabaseNodeType.enum.Initiative]
    case DatabaseNodeType.enum.Mission: return []
    default: return []
  }
}

export function isValidRdfType(type: string): type is DatabaseNodeType {
  return type === DatabaseNodeType.enum.Mission || type === DatabaseNodeType.enum.Aim || type === DatabaseNodeType.enum.Initiative || type === DatabaseNodeType.enum.Task
}

export function isCoreRdfType(type: DatabaseNodeType): boolean {
  return type === DatabaseNodeType.enum.Mission || type === DatabaseNodeType.enum.Aim || type === DatabaseNodeType.enum.Initiative || type === DatabaseNodeType.enum.Task
}

export function isLeafType(type: DatabaseNodeType): boolean {
  return type === DatabaseNodeType.enum.Task
}

export interface Endeavor {
  id: string
  userId: string
  title?: string
  description?: string
  status?: string
  createdAt: string // Birth timestamp
  updatedAt: string
  archivedAt?: string // Archive timestamp (null = active)
  archivedReason?: string // Optional reason for archiving
  metadata: Record<string, any>
}

// GraphNode is now imported and re-exported from the contract layer above
// This ensures a single source of truth for the graph node shape

export interface DerivedDescriptor {
  title: string
  summary: string
  confidence?: number
}

export interface DailyFrontMatter {
  id: string // e.g., daily.YYYY-MM-DD
  node_type: 'DailyPage'
  activeContextFor: string // oh:active_context_for
  references?: string[] // oh:references
}

export type ReviewBlocks = {
  done: string[]
  aims: string[]
  next: string[]
  reflection: { win?: string; learning?: string; adjust?: string }
}
