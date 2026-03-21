import { GraphNode } from '../contracts/endeavor-contract'

/**
 * Build breadcrumb trail for a node, respecting context visibility
 * Only includes ancestors that are available in the current node set (context-aware)
 */
export function buildContextAwareBreadcrumbs(
  targetNode: GraphNode,
  availableNodes: GraphNode[]
): GraphNode[] {
  const breadcrumbs: GraphNode[] = []
  const visited = new Set<string>()
  const nodeMap = new Map(availableNodes.map(n => [n.id, n]))

  let current = targetNode.parent_id ? nodeMap.get(targetNode.parent_id) : null

  // Walk up the parent chain, but only include nodes that are available in context
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    breadcrumbs.unshift(current)

    const parentId = current.parent_id
    // Only follow parent if it's available in the current context
    current = parentId ? nodeMap.get(parentId) : null
  }

  return breadcrumbs
}

/**
 * Test if a node has visible parents in the current context
 */
export function hasVisibleParent(
  node: GraphNode,
  availableNodes: GraphNode[]
): boolean {
  if (!node.parent_id) return false

  const nodeMap = new Map(availableNodes.map(n => [n.id, n]))
  return nodeMap.has(node.parent_id)
}


/**
 * Create a context-aware version of a node with filtered relationships
 */
export function createContextAwareNode(
  node: GraphNode,
  availableNodes: GraphNode[]
): GraphNode & { contextMetadata?: { hasHiddenParent: boolean } } {
  const nodeMap = new Map(availableNodes.map(n => [n.id, n]))

  const hasHiddenParent = node.parent_id && !nodeMap.has(node.parent_id)

  return {
    ...node,
    // Clear parent if not visible in context
    parent_id: hasVisibleParent(node, availableNodes) ? node.parent_id : null,
    // Add metadata about hidden relationships for debugging/analytics
    contextMetadata: {
      hasHiddenParent: hasHiddenParent || false
    }
  }
}