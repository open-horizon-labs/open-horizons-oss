import { GraphNode } from '../contracts/endeavor-contract'

export function byId(nodes: GraphNode[], id: string): GraphNode | undefined {
  return nodes.find((n) => n.id === id)
}

export function up(nodes: GraphNode[], currentId: string): GraphNode | null {
  const cur = byId(nodes, currentId)
  if (!cur?.parent_id) return null
  return byId(nodes, cur.parent_id) || null
}

export function down(nodes: GraphNode[], currentId: string): GraphNode[] {
  return nodes.filter((n) => n.parent_id === currentId)
}

export function sideways(nodes: GraphNode[], currentId: string): GraphNode[] {
  const cur = byId(nodes, currentId)
  if (!cur) return []
  // Only return siblings with same parent - no contributesTo relationships
  return nodes.filter((n) => n.parent_id && n.parent_id === cur.parent_id && n.id !== cur.id)
}

export function ancestors(nodes: GraphNode[], currentId: string): GraphNode[] {
  const result: GraphNode[] = []
  let current = up(nodes, currentId)
  
  while (current) {
    result.push(current)
    current = up(nodes, current.id)
  }
  
  return result
}

export function descendants(nodes: GraphNode[], currentId: string): GraphNode[] {
  const result: GraphNode[] = []
  const toVisit = [currentId]
  const visited = new Set<string>()
  
  while (toVisit.length > 0) {
    const id = toVisit.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    
    const children = down(nodes, id)
    for (const child of children) {
      result.push(child)
      toVisit.push(child.id)
    }
  }
  
  return result
}

