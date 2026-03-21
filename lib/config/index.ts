/**
 * Strategy Configuration
 *
 * On the server: reads from node_types DB table via getActiveConfigAsync()
 * On the client: uses built-in presets (or cached data from server props)
 *
 * The config module itself never imports db.ts to stay client-safe.
 */

import { StrategyConfig, NodeTypeConfig } from './node-types'
import { openHorizonsConfig } from './presets/open-horizons'
import { agenticFlowConfig } from './presets/agentic-flow'

export { type StrategyConfig, type NodeTypeConfig } from './node-types'
export {
  getNodeTypeBySlug,
  getNodeTypeByName,
  getAllSlugs,
  getAllNames,
  getValidChildNames,
  getValidParentNames,
  isValidTypeName,
  isValidTypeSlug,
  getLeafTypes,
  getRootTypes
} from './node-types'

/** Built-in presets (used as fallback and for icon lookup) */
export const PRESETS: Record<string, StrategyConfig> = {
  'open-horizons': openHorizonsConfig,
  'agentic-flow': agenticFlowConfig
}

// In-memory cache (populated by server-side getActiveConfigAsync)
let _cachedConfig: StrategyConfig | null = null

/** Set the active config (called by server components after DB read) */
export function setActiveConfig(config: StrategyConfig) {
  _cachedConfig = config
}

/** Invalidate the cache (call after writing node_types) */
export function invalidateNodeTypeCache() {
  _cachedConfig = null
}

/** Synchronously get preset config from env */
function getPresetConfig(): StrategyConfig {
  const presetId = (
    typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_STRATEGY_PRESET || process.env?.STRATEGY_PRESET)
  ) || 'open-horizons'
  return PRESETS[presetId] || PRESETS['open-horizons']
}

/**
 * Get the active strategy configuration (synchronous).
 * Returns cached DB config if available, otherwise falls back to env preset.
 */
export function getActiveConfig(): StrategyConfig {
  return _cachedConfig || getPresetConfig()
}

/**
 * Convert DB rows to StrategyConfig.
 * Used by server components and API routes that query node_types directly.
 */
export function rowsToConfig(rows: any[]): StrategyConfig {
  const nodeTypes: NodeTypeConfig[] = rows.map((row: any) => ({
    name: row.name,
    slug: row.slug,
    description: row.description || '',
    color: row.color || '#6b7280',
    icon: row.icon || '📄',
    chipClasses: row.chip_classes || 'bg-gray-100 text-gray-800 border-gray-200',
    validChildren: row.valid_children || [],
    validParents: row.valid_parents || []
  }))
  return { name: 'Custom', id: 'database', nodeTypes }
}

/**
 * List available preset IDs
 */
export function getAvailablePresets(): { id: string; name: string }[] {
  return Object.entries(PRESETS).map(([id, config]) => ({
    id,
    name: config.name
  }))
}
