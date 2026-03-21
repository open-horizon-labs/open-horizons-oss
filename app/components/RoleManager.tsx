'use client'

import { DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { GraphNode } from '../../lib/graph/types'
import { NodeTypeChip } from './NodeTypeChips'

interface RoleManagerProps {
  node: GraphNode
  onAddRole?: (role: DatabaseNodeType, context?: string) => Promise<void>
  onRemoveRole?: (roleId: number) => Promise<void>
  onPromoteRole?: (fromRole: DatabaseNodeType, toRole: DatabaseNodeType) => Promise<void>
  disabled?: boolean
}

export function RoleManager({ node, disabled = false }: RoleManagerProps) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Node Type</h4>
        <div className="flex items-center gap-2">
          <NodeTypeChip nodeType={node.node_type} />
          <span className="text-sm text-gray-600">
            This endeavor is classified as a {node.node_type.toLowerCase()}
          </span>
        </div>
      </div>

      {disabled && (
        <div className="text-sm text-gray-500 italic">
          Note: Node type management is currently read-only
        </div>
      )}
    </div>
  )
}