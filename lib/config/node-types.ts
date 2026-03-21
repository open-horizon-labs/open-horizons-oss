/**
 * Node Type Configuration System
 *
 * Defines the strategy hierarchy as a configurable layer.
 * Node types, their relationships, display properties, and validation
 * are all derived from the active configuration.
 */

export interface NodeTypeConfig {
  /** Display name, e.g. "Mission", "Strategic Bet" */
  name: string
  /** URL/DB-safe identifier, e.g. "mission", "strategic_bet" */
  slug: string
  /** What this type represents in the strategy hierarchy */
  description: string
  /** Hex color for UI display */
  color: string
  /** Emoji icon for compact display */
  icon: string
  /** Tailwind classes for chip/badge styling */
  chipClasses: string
  /** Slugs of valid child types (what can be created under this) */
  validChildren: string[]
  /** Slugs of valid parent types (what this can be nested under) */
  validParents: string[]
}

export interface StrategyConfig {
  /** Human-readable name for this preset */
  name: string
  /** Machine identifier */
  id: string
  /** Ordered list of node types (top of hierarchy first) */
  nodeTypes: NodeTypeConfig[]
}

// ========================================
// CONFIG QUERY HELPERS
// ========================================

/** Get a node type config by slug (case-insensitive) */
export function getNodeTypeBySlug(config: StrategyConfig, slug: string): NodeTypeConfig | undefined {
  const lower = slug.toLowerCase()
  return config.nodeTypes.find(nt => nt.slug === lower)
}

/** Get a node type config by display name (case-insensitive) */
export function getNodeTypeByName(config: StrategyConfig, name: string): NodeTypeConfig | undefined {
  const lower = name.toLowerCase()
  return config.nodeTypes.find(nt => nt.name.toLowerCase() === lower)
}

/** Get all slugs in the config */
export function getAllSlugs(config: StrategyConfig): string[] {
  return config.nodeTypes.map(nt => nt.slug)
}

/** Get all display names (capitalized DB format) in the config */
export function getAllNames(config: StrategyConfig): string[] {
  return config.nodeTypes.map(nt => nt.name)
}

/** Get valid child type names (DB format) for a given parent type name */
export function getValidChildNames(config: StrategyConfig, parentName: string): string[] {
  const parentConfig = getNodeTypeByName(config, parentName)
  if (!parentConfig) return []
  return parentConfig.validChildren
    .map(slug => getNodeTypeBySlug(config, slug))
    .filter((nt): nt is NodeTypeConfig => nt !== undefined)
    .map(nt => nt.name)
}

/** Get valid parent type names (DB format) for a given child type name */
export function getValidParentNames(config: StrategyConfig, childName: string): string[] {
  const childConfig = getNodeTypeByName(config, childName)
  if (!childConfig) return []
  return childConfig.validParents
    .map(slug => getNodeTypeBySlug(config, slug))
    .filter((nt): nt is NodeTypeConfig => nt !== undefined)
    .map(nt => nt.name)
}

/** Check if a type name is valid in the current config */
export function isValidTypeName(config: StrategyConfig, name: string): boolean {
  return getNodeTypeByName(config, name) !== undefined
}

/** Check if a slug is valid in the current config */
export function isValidTypeSlug(config: StrategyConfig, slug: string): boolean {
  return getNodeTypeBySlug(config, slug) !== undefined
}

/** Get leaf types (types with no valid children) */
export function getLeafTypes(config: StrategyConfig): NodeTypeConfig[] {
  return config.nodeTypes.filter(nt => nt.validChildren.length === 0)
}

/** Get root types (types with no valid parents) */
export function getRootTypes(config: StrategyConfig): NodeTypeConfig[] {
  return config.nodeTypes.filter(nt => nt.validParents.length === 0)
}
