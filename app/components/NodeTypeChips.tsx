'use client'

import { getRoleIcon } from '../../lib/constants/icons'
import { getRoleHexColor } from '../../lib/constants/icons'

interface NodeTypeChipProps {
  nodeType: string
  compact?: boolean
  onClick?: () => void
}

export function NodeTypeChip({
  nodeType,
  compact = false,
  onClick
}: NodeTypeChipProps) {
  const icon = getRoleIcon(nodeType)
  const color = getRoleHexColor(nodeType)

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border transition-colors ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${compact ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1'}`}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color
      }}
      onClick={onClick}
    >
      <span className="text-sm">{icon}</span>
      <span className="capitalize">{nodeType}</span>
    </span>
  )
}

// Legacy components for backward compatibility (no-ops since roles are deprecated)
export function RoleChips(_props: any) {
  return null
}

export function SingleRoleChip({ role, compact, onClick }: { role: string; compact?: boolean; onClick?: () => void }) {
  return <NodeTypeChip nodeType={role} compact={compact} onClick={onClick} />
}

export function RolePicker(_props: any) {
  return null
}
