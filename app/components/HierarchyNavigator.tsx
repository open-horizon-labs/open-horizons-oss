'use client'

import { useRouter, usePathname } from 'next/navigation'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { up, down, byId } from '../../lib/graph/traverse'

interface HierarchyNavigatorProps {
  currentEndeavorId: string
  nodes: GraphNode[]
}

/**
 * HierarchyNavigator - Shows parent and children links for navigating the endeavor hierarchy
 *
 * Displays:
 * - Parent link (if exists) with "↑" prefix
 * - List of children links (if any exist) with "↓" prefix
 *
 * Clicking links updates the ?context= URL parameter to navigate between contexts.
 */
export function HierarchyNavigator({ currentEndeavorId, nodes }: HierarchyNavigatorProps) {
  const router = useRouter()
  const currentPath = usePathname()

  // Verify current node exists in graph
  const currentNode = byId(nodes, currentEndeavorId)
  if (!currentNode) {
    // Current endeavor not found in graph - nothing to navigate
    return null
  }

  // Get immediate parent and direct children
  const parent = up(nodes, currentEndeavorId)
  const children = down(nodes, currentEndeavorId)

  // If no parent and no children, no navigation available
  if (!parent && children.length === 0) {
    return null
  }

  // Navigate to a different context by updating URL parameter
  const navigateToContext = (endeavorId: string) => {
    router.push(`${currentPath}?context=${endeavorId}`)
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded border border-gray-200">
      {/* Parent link */}
      {parent && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateToContext(parent.id)}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            <span className="text-gray-500">↑</span>
            <span>{parent.title || 'Untitled'}</span>
          </button>
        </div>
      )}

      {/* Children links */}
      {children.length > 0 && (
        <div className="flex flex-col gap-1">
          {children.map((child) => (
            <div key={child.id} className="flex items-center gap-2">
              <button
                onClick={() => navigateToContext(child.id)}
                className="text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                <span className="text-gray-500">↓</span>
                <span>{child.title || 'Untitled'}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HierarchyNavigator
