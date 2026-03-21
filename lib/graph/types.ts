import { GraphNode as ContractGraphNode } from '../contracts/endeavor-contract'
import { getActiveConfig, getValidChildNames, getValidParentNames, getLeafTypes, getNodeTypeByName } from '../config'

// Re-export the contract GraphNode as the single source of truth
export type GraphNode = ContractGraphNode

// Helper functions to work with the hierarchy using the active config

/** Get all configured node type names (DB format) */
export function getCoreRdfTypes(): string[] {
  return getActiveConfig().nodeTypes.map(nt => nt.name)
}

/** Get valid child type names for a parent type (reads from config) */
export function getValidChildTypes(parentType: string): string[] {
  return getValidChildNames(getActiveConfig(), parentType)
}

/** Get valid parent type names for a child type (reads from config) */
export function getValidParentTypes(childType: string): string[] {
  return getValidParentNames(getActiveConfig(), childType)
}

/** Check if a string is a valid node type name in the current config */
export function isValidRdfType(type: string): boolean {
  return getNodeTypeByName(getActiveConfig(), type) !== undefined
}

/** Check if a type is a configured core type (always true for configured types) */
export function isCoreRdfType(type: string): boolean {
  return isValidRdfType(type)
}

/** Check if a type is a leaf type (no valid children) */
export function isLeafType(type: string): boolean {
  const config = getActiveConfig()
  const leaves = getLeafTypes(config)
  return leaves.some(nt => nt.name === type)
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
