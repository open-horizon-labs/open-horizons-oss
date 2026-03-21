/**
 * Strategy Configuration Entry Point
 *
 * Reads STRATEGY_PRESET from environment (or defaults to "open-horizons")
 * and returns the active configuration.
 *
 * Usage:
 *   import { getActiveConfig } from '../config'
 *   const config = getActiveConfig()
 */

import { StrategyConfig } from './node-types'
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

/** Registry of all available presets */
export const PRESETS: Record<string, StrategyConfig> = {
  'open-horizons': openHorizonsConfig,
  'agentic-flow': agenticFlowConfig
}

/** Default preset ID when none is specified */
const DEFAULT_PRESET = 'open-horizons'

/**
 * Get the active strategy configuration.
 *
 * Reads from `STRATEGY_PRESET` environment variable.
 * Falls back to "open-horizons" if unset or invalid.
 */
export function getActiveConfig(): StrategyConfig {
  const presetId = (
    typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_STRATEGY_PRESET || process.env?.STRATEGY_PRESET)
  ) || DEFAULT_PRESET

  const config = PRESETS[presetId]
  if (!config) {
    console.warn(
      `Unknown STRATEGY_PRESET "${presetId}", falling back to "${DEFAULT_PRESET}". ` +
      `Available presets: ${Object.keys(PRESETS).join(', ')}`
    )
    return PRESETS[DEFAULT_PRESET]
  }

  return config
}

/**
 * List available preset IDs (useful for settings UI or CLI)
 */
export function getAvailablePresets(): { id: string; name: string }[] {
  return Object.entries(PRESETS).map(([id, config]) => ({
    id,
    name: config.name
  }))
}
