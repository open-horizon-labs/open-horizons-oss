/**
 * UI Contract Helpers
 *
 * These helpers ensure the UI safely consumes API data using contracts.
 * They prevent the UI from silently failing when API responses change.
 */

import {
  GraphNode,
  validateGraphNode,
  validateDashboardResponse,
  GetDashboardResponse,
  ContractViolationError,
  ApiNodeType,
  DatabaseNodeType
} from './endeavor-contract'

/**
 * Safely consume dashboard API response with contract validation
 *
 * Usage in UI components:
 * ```typescript
 * const response = await fetch('/api/dashboard')
 * const data = await response.json()
 * const { nodes } = consumeDashboardResponse(data) // Throws if contract violated
 * ```
 */
export function consumeDashboardResponse(apiResponse: unknown): GetDashboardResponse {
  try {
    return validateDashboardResponse(apiResponse)
  } catch (error) {
    if (error instanceof ContractViolationError) {
      console.error('🚨 UI CONTRACT VIOLATION: Dashboard response invalid', error.message)
      console.error('🚨 This means the API changed without updating contracts!')
      console.error('🚨 Raw response:', apiResponse)

      // In development, throw hard to catch issues early
      if (process.env.NODE_ENV === 'development') {
        throw new Error(`Contract violation prevented UI breakage: ${error.message}`)
      }

      // In production, provide safe fallback
      console.warn('🔄 Using safe fallback due to contract violation')
      return { nodes: [], contextId: 'fallback' }
    }
    throw error
  }
}

/**
 * Safely validate individual GraphNodes from API responses
 *
 * This ensures every node the UI processes matches the expected contract.
 */
export function consumeGraphNodes(apiNodes: unknown[]): GraphNode[] {
  const validNodes: GraphNode[] = []
  const errors: string[] = []

  apiNodes.forEach((nodeData, index) => {
    try {
      const validNode = validateGraphNode(nodeData)
      validNodes.push(validNode)
    } catch (error) {
      if (error instanceof ContractViolationError) {
        errors.push(`Node ${index}: ${error.message}`)
        console.error('🚨 Invalid node from API:', nodeData, error.message)
      } else {
        throw error
      }
    }
  })

  if (errors.length > 0) {
    console.error('🚨 UI CONTRACT VIOLATIONS in GraphNodes:', errors)

    if (process.env.NODE_ENV === 'development') {
      throw new Error(`Contract violations prevented UI breakage:\n${errors.join('\n')}`)
    }
  }

  return validNodes
}

/**
 * Type-safe node filtering using contract types
 *
 * Contract-enforced type safety using proper enum values.
 */
/**
 * Filter nodes by exact node type using contract enums
 */
export function filterNodesByType(nodes: GraphNode[], nodeType: ApiNodeType): GraphNode[] {
  return nodes.filter(node => node.node_type === nodeType)
}

/**
 * Get all supported node types from the contract
 *
 * This ensures UI components use only valid types defined in contracts.
 */
export function getSupportedNodeTypes(): ApiNodeType[] {
  return [DatabaseNodeType.enum.Mission, DatabaseNodeType.enum.Aim, DatabaseNodeType.enum.Initiative, DatabaseNodeType.enum.Task]
}

/**
 * Safe API calling with contract enforcement
 *
 * Usage:
 * ```typescript
 * const dashboard = await callDashboardAPI('/api/dashboard')
 * // dashboard is guaranteed to match GetDashboardResponse contract
 * ```
 */
export async function callDashboardAPI(url: string): Promise<GetDashboardResponse> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Dashboard API failed: ${response.status}`)
  }

  const data = await response.json()
  return consumeDashboardResponse(data)
}
