'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { GraphNode } from '../../lib/contracts/endeavor-contract'

interface ContextAwareDataContextType {
  nodes: GraphNode[]
  selectedContextId: string | null
  loading: boolean
  reloadNodes: () => Promise<void>
  ensureNodeIncluded: (nodeId: string) => Promise<void>
}

const ContextAwareDataContext = createContext<ContextAwareDataContextType | null>(null)

interface ContextAwareDataProviderProps {
  children: ReactNode
  initialNodes: GraphNode[]
  userId: string
}

export function ContextAwareDataProvider({
  children,
  initialNodes,
  userId
}: ContextAwareDataProviderProps) {
  const [nodes, setNodes] = useState<GraphNode[]>(initialNodes)
  const [selectedContextId, setSelectedContextId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  // Load saved context from URL first, then localStorage on mount
  useEffect(() => {
    const urlContextId = searchParams?.get('context')
    const savedContextId = localStorage.getItem('selectedContextId')

    // Validate that saved context ID belongs to current user
    // Personal contexts should match the pattern personal:userId
    let validSavedContextId = savedContextId && savedContextId !== 'null' ? savedContextId : null
    if (validSavedContextId && validSavedContextId.startsWith('personal:')) {
      const contextUserId = validSavedContextId.replace('personal:', '')
      if (contextUserId !== userId) {
        // Clear invalid context from different user
        console.log('Clearing invalid personal context from different user')
        localStorage.removeItem('selectedContextId')
        validSavedContextId = null
      }
    }

    // Priority: URL context > validated localStorage context > null
    const contextToSet = urlContextId || validSavedContextId

    setSelectedContextId(contextToSet)

    // Update localStorage if URL has context parameter
    if (urlContextId) {
      localStorage.setItem('selectedContextId', urlContextId)
    }

    // Load context-filtered nodes if context is selected
    if (contextToSet) {
      reloadNodes()
    }
  }, [searchParams, userId])

  const reloadNodes = async () => {
    setLoading(true)
    try {
      const savedContextId = localStorage.getItem('selectedContextId')
      const contextId = savedContextId && savedContextId !== 'null' ? savedContextId : null


      if (contextId) {
        // Load context-filtered nodes
        const response = await fetch(`/api/dashboard?contextId=${encodeURIComponent(contextId)}`)
        if (response.ok) {
          const data = await response.json()
          const contextNodes = data.nodes || []
          setNodes(contextNodes)
        } else {
          // Context doesn't exist or isn't accessible - clear it and fall back to personal
          console.error('ContextAwareDataProvider: failed to load context nodes, response status:', response.status)
          console.log('Context not accessible, clearing from localStorage and falling back to personal context')
          localStorage.removeItem('selectedContextId')
          setSelectedContextId(null)

          // Try loading personal context instead
          const personalResponse = await fetch('/api/dashboard')
          if (personalResponse.ok) {
            const personalData = await personalResponse.json()
            const personalNodes = personalData.nodes || []
            setNodes(personalNodes)
          }
          return // Don't set context ID below since we cleared it
        }
      } else {
        // Load personal nodes (ALL user endeavors)
        const response = await fetch('/api/dashboard')
        if (response.ok) {
          const data = await response.json()
          const personalNodes = data.nodes || []
          setNodes(personalNodes)
        } else {
          console.error('ContextAwareDataProvider: failed to load personal nodes, response status:', response.status)
        }
      }
      setSelectedContextId(contextId)
    } catch (error) {
      console.error('Failed to reload nodes:', error)
    } finally {
      setLoading(false)
    }
  }

  const ensureNodeIncluded = async (nodeId: string) => {

    // Check if the node is already in the current node set
    const existingNode = nodes.find(n => n.id === nodeId)
    if (existingNode) {
      return // Node is already included
    }


    // Load all personal nodes to find the missing node
    try {
      const response = await fetch('/api/dashboard')
      if (response.ok) {
        const data = await response.json()
        const allNodes = data.nodes || []
        const missingNode = allNodes.find((n: GraphNode) => n.id === nodeId)

        if (missingNode) {
          // Add the missing node to the current set
          setNodes(prevNodes => [...prevNodes, missingNode])
        } else {
        }
      } else {
        console.error('ContextAwareDataProvider: failed to fetch personal nodes, response status:', response.status)
      }
    } catch (error) {
      console.error('Failed to load missing node:', error)
    }
  }

  // Listen for context changes
  useEffect(() => {
    const handleContextChange = (event: CustomEvent) => {
      const contextId = event.detail.contextId
      setSelectedContextId(contextId)
      reloadNodes()
    }

    window.addEventListener('contextChanged', handleContextChange as EventListener)

    return () => {
      window.removeEventListener('contextChanged', handleContextChange as EventListener)
    }
  }, [])

  return (
    <ContextAwareDataContext.Provider value={{
      nodes,
      selectedContextId,
      loading,
      reloadNodes,
      ensureNodeIncluded
    }}>
      {children}
    </ContextAwareDataContext.Provider>
  )
}

export function useContextAwareData() {
  const context = useContext(ContextAwareDataContext)
  if (!context) {
    throw new Error('useContextAwareData must be used within a ContextAwareDataProvider')
  }
  return context
}