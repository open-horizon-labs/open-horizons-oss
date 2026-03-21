import { DatabaseNodeType } from '../contracts/endeavor-contract'

// Contract-based lookup tables using exact enum values as keys
const ROLE_ICONS_MAP = {
  [DatabaseNodeType.enum.Mission]: '🎯',
  [DatabaseNodeType.enum.Aim]: '🏹',
  [DatabaseNodeType.enum.Initiative]: '🚀',
  [DatabaseNodeType.enum.Task]: '✓'
} as const

const ROLE_COLORS_MAP = {
  [DatabaseNodeType.enum.Mission]: 'bg-purple-100 text-purple-800 border-purple-200',
  [DatabaseNodeType.enum.Aim]: 'bg-blue-100 text-blue-800 border-blue-200',
  [DatabaseNodeType.enum.Initiative]: 'bg-green-100 text-green-800 border-green-200',
  [DatabaseNodeType.enum.Task]: 'bg-gray-100 text-gray-800 border-gray-200'
} as const

// Contract-enforced helper functions - only accept valid enum values
export function getRoleIcon(role: string | undefined | null): string {
  if (!role) return '📄'
  return ROLE_ICONS_MAP[role as keyof typeof ROLE_ICONS_MAP] || '📄'
}

export function getRoleColor(role: string | undefined | null): string {
  if (!role) return 'bg-gray-100 text-gray-800 border-gray-200'
  return ROLE_COLORS_MAP[role as keyof typeof ROLE_COLORS_MAP] || 'bg-gray-100 text-gray-800 border-gray-200'
}

