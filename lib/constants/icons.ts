import { getActiveConfig, getNodeTypeByName, getNodeTypeBySlug } from '../config'

/**
 * Get the icon for a node type.
 * Accepts either the DB name ("Mission") or slug ("mission").
 * Falls back to a generic document icon for unknown types.
 */
export function getRoleIcon(role: string | undefined | null): string {
  if (!role) return '\uD83D\uDCC4' // document emoji
  const config = getActiveConfig()
  const found = getNodeTypeByName(config, role) || getNodeTypeBySlug(config, role)
  return found?.icon || '\uD83D\uDCC4'
}

/**
 * Get the Tailwind chip classes for a node type.
 * Accepts either the DB name ("Mission") or slug ("mission").
 */
export function getRoleColor(role: string | undefined | null): string {
  if (!role) return 'bg-gray-100 text-gray-800 border-gray-200'
  const config = getActiveConfig()
  const found = getNodeTypeByName(config, role) || getNodeTypeBySlug(config, role)
  return found?.chipClasses || 'bg-gray-100 text-gray-800 border-gray-200'
}

/**
 * Get the hex color for a node type (useful for inline styles).
 * Accepts either the DB name ("Mission") or slug ("mission").
 */
export function getRoleHexColor(role: string | undefined | null): string {
  if (!role) return '#6b7280'
  const config = getActiveConfig()
  const found = getNodeTypeByName(config, role) || getNodeTypeBySlug(config, role)
  return found?.color || '#6b7280'
}
