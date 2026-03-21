import { getActiveConfig, getNodeTypeByName, getNodeTypeBySlug, PRESETS } from '../config'
import { StrategyConfig } from '../config/node-types'

/**
 * Find a node type config across the active preset first, then all presets.
 * This ensures icons/colors work even when seed data doesn't match the active preset.
 */
function findNodeType(role: string) {
  // Try active config first
  const config = getActiveConfig()
  const found = getNodeTypeByName(config, role) || getNodeTypeBySlug(config, role)
  if (found) return found

  // Fall back to searching all presets
  for (const preset of Object.values(PRESETS) as StrategyConfig[]) {
    const fallback = getNodeTypeByName(preset, role) || getNodeTypeBySlug(preset, role)
    if (fallback) return fallback
  }

  return undefined
}

/**
 * Get the icon for a node type.
 * Accepts either the DB name ("Mission") or slug ("mission").
 * Searches all presets so icons work regardless of active config.
 */
export function getRoleIcon(role: string | undefined | null): string {
  if (!role) return '📄'
  return findNodeType(role)?.icon || '📄'
}

/**
 * Get the Tailwind chip classes for a node type.
 */
export function getRoleColor(role: string | undefined | null): string {
  if (!role) return 'bg-gray-100 text-gray-800 border-gray-200'
  return findNodeType(role)?.chipClasses || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Get the hex color for a node type (useful for inline styles).
 */
export function getRoleHexColor(role: string | undefined | null): string {
  if (!role) return '#6b7280'
  return findNodeType(role)?.color || '#6b7280'
}
