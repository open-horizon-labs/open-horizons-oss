import { GraphNode } from '../contracts/endeavor-contract'
import { getActiveConfig } from '../config'

export interface GraphMetrics {
  totalNodes: number
  roleDistribution: Record<string, number>
  components: string[][]
  centralityScores: Record<string, number>
}

export function analyzeGraph(nodes: GraphNode[]): GraphMetrics {
  // Simplified analysis without edges - just basic node statistics
  const totalNodes = nodes.length

  // Role distribution - initialise from config so all types appear
  const roleDistribution: Record<string, number> = {}
  for (const nt of getActiveConfig().nodeTypes) {
    roleDistribution[nt.name] = 0
  }
  nodes.forEach(node => {
    const role = node.node_type
    roleDistribution[role] = (roleDistribution[role] || 0) + 1
  })

  return {
    totalNodes,
    roleDistribution,
    components: [],
    centralityScores: {}
  }
}


export interface Recommendation {
  id: string
  title: string
  description: string
  confidence: number
  type: 'connection' | 'role' | 'structure'
  priority: 'high' | 'medium' | 'low'
  action?: string
  impact?: string
}

export function generateRecommendations(nodes: GraphNode[], currentNode?: GraphNode): Recommendation[] {
  // Simplified recommendations without edges
  return []
}
