'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { getValidChildTypes } from '../../lib/graph/types'
import { getRoleIcon } from '../../lib/constants/icons'
import { getEndeavorLink } from '../../lib/utils/endeavor-links'
import { useContextAwareData } from './ContextAwareDataProvider'

interface TreeNodeData {
  id: string
  name: string
  nodeData: GraphNode
  children?: TreeNodeData[]
  logPreview?: string
  extendedPreview?: string
  isActive?: boolean
  level: number
}

interface PrimeTreeViewProps {
  allNodes: GraphNode[]
  currentNodeId: string
  date: string
  currentBody?: string
  onCreateChild?: (parentId: string, childType: DatabaseNodeType) => void
}

export function PrimeTreeView({ allNodes, currentNodeId, date, currentBody = '', onCreateChild }: PrimeTreeViewProps) {
  const [logPreviews, setLogPreviews] = useState<Map<string, string>>(new Map([[currentNodeId, currentBody]]))
  const [loadingPreviews, setLoadingPreviews] = useState(false)
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [expandedPreviews, setExpandedPreviews] = useState<Set<string>>(new Set())
  const [userCollapsedNodes, setUserCollapsedNodes] = useState<Set<string>>(new Set())
  const loadedForKey = useRef<string>('')

  // Filter to only include endeavor types (exclude achievements, strengths, tasks, etc.)
  const filteredNodes = useMemo(() => {
    const endeavorTypes = ['mission', 'aim', 'initiative', 'goal', 'project', 'ritual', 'daily_page', 'user']
    return allNodes.filter(node => endeavorTypes.includes(node.node_type.toLowerCase()))
  }, [allNodes])

  // Load log previews for filtered nodes only
  useEffect(() => {
    const nodeIds = filteredNodes.map(n => n.id)
    const requestKey = `${nodeIds.join(',')}-${date}-${currentNodeId}`

    // Prevent duplicate requests
    if (loadedForKey.current === requestKey || filteredNodes.length === 0) {
      return
    }

    const loadPreviews = async () => {
      setLoadingPreviews(true)
      try {
        const response = await fetch('/api/daily-logs/previews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nodeIds, date })
        })

        if (response.ok) {
          const { previews } = await response.json()
          setLogPreviews(prevPreviews => {
            const newPreviews = new Map(prevPreviews)
            // Set current body for current node
            newPreviews.set(currentNodeId, currentBody)

            // Add fetched previews
            Object.entries(previews).forEach(([nodeId, preview]) => {
              newPreviews.set(nodeId, preview as string)
            })

            return newPreviews
          })
          loadedForKey.current = requestKey
        }
      } catch (error) {
        console.error('Failed to load log previews:', error)
      } finally {
        setLoadingPreviews(false)
      }
    }

    loadPreviews()
  }, [filteredNodes, date, currentNodeId, currentBody])

  // Build tree data structure
  const treeData = useMemo(() => {
    // Helper to get log preview
    const getLogPreview = (nodeId: string) => {
      const body = logPreviews.get(nodeId)
      if (!body || body.trim() === '') return null
      
      // Don't filter out empty lines - take ALL lines including empty ones
      const lines = body.split('\n')
      if (lines.length === 0) return null
      
      // Take first 3 lines for tighter preview by default
      const previewLines = lines.slice(0, 3).filter(line => line.trim() !== '')
      return previewLines.map(line => {
        const cleanLine = line.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1')
        return cleanLine.length > 80 ? cleanLine.substring(0, 77) + '...' : cleanLine
      }).join('\n')
    }

    // Helper to get extended preview for click
    const getExtendedPreview = (nodeId: string) => {
      const body = logPreviews.get(nodeId)
      if (!body || body.trim() === '') return null

      const lines = body.split('\n')
      if (lines.length <= 3) return null // No additional content to show

      // Take lines 4-50 (skip first 3 lines already shown in basic preview)
      const remainingLines = lines.slice(3, 50)
      return remainingLines.length > 0 ? remainingLines.join('\n') : null
    }

    // Helper to check if a node or its hierarchy has daily logs
    const hasLogInHierarchy = (treeNode: TreeNodeData): boolean => {
      // Check if current node has a log
      if (treeNode.logPreview) return true
      
      // Check if any children have logs
      if (treeNode.children && treeNode.children.some(child => child.logPreview || hasLogInHierarchy(child))) {
        return true
      }
      
      // Check if parent has a log (find parent by looking in filteredNodes)
      const parentNode = filteredNodes.find(n => n.id === treeNode.nodeData.parent_id)
      if (parentNode) {
        const parentPreview = getLogPreview(parentNode.id)
        if (parentPreview) return true
      }
      
      return false
    }

    // Build tree recursively
    const buildNode = (nodeId: string, level = 0): TreeNodeData | null => {
      const node = filteredNodes.find(n => n.id === nodeId)
      if (!node) return null

      const children = filteredNodes
        .filter(n => n.parent_id === nodeId)
        .map(child => buildNode(child.id, level + 1))
        .filter(Boolean) as TreeNodeData[]

      const treeNode: TreeNodeData = {
        id: node.id,
        name: node.title || node.id,
        nodeData: node,
        children: children.length > 0 ? children : undefined,
        logPreview: getLogPreview(node.id) || undefined,
        isActive: node.id === currentNodeId,
        level,
        extendedPreview: getExtendedPreview(node.id) || undefined
      }

      // Auto-expand nodes that have active descendants OR nodes with logs in hierarchy
      // BUT only if the user hasn't explicitly collapsed them
      const shouldExpand = (treeNode.isActive ||
        (children && children.some(child => child.isActive || hasActiveDescendant(child))) ||
        hasLogInHierarchy(treeNode)) && !userCollapsedNodes.has(node.id)

      if (shouldExpand) {
        setExpandedNodes(prev => new Set([...prev, node.id]))
      }

      return treeNode
    }

    const hasActiveDescendant = (node: TreeNodeData): boolean => {
      if (node.isActive) return true
      if (!node.children) return false
      return node.children.some(child => hasActiveDescendant(child))
    }

    // Find root node and build tree including siblings
    let current = filteredNodes.find(n => n.id === currentNodeId)
    if (!current) return []
    
    // Walk up to find root
    const visited = new Set<string>()
    while (current && current.parent_id && !visited.has(current.id)) {
      visited.add(current.id)
      const parent = filteredNodes.find(n => n.id === current?.parent_id)
      if (parent) current = parent
      else break
    }
    
    // Include siblings of the root in the tree
    const siblings = filteredNodes.filter(n => n.parent_id === current.parent_id)
    const treeNodes = siblings.map(sibling => buildNode(sibling.id)).filter(Boolean) as TreeNodeData[]

    return treeNodes
  }, [filteredNodes, currentNodeId, logPreviews, userCollapsedNodes])


  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        // User is collapsing - mark as user-collapsed to prevent auto-expansion
        newSet.delete(nodeId)
        setUserCollapsedNodes(collapsed => new Set([...collapsed, nodeId]))
      } else {
        // User is expanding - remove from user-collapsed set
        newSet.add(nodeId)
        setUserCollapsedNodes(collapsed => {
          const newCollapsed = new Set(collapsed)
          newCollapsed.delete(nodeId)
          return newCollapsed
        })
      }
      return newSet
    })
  }

  const togglePreview = (nodeId: string) => {
    setExpandedPreviews(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }


  const renderNode = (node: TreeNodeData): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const indent = node.level * 20

    return (
      <div key={node.id}>
        {/* Node itself */}
        <div 
          className={`flex items-center py-1 px-2 hover:bg-gray-50 ${node.isActive ? 'bg-blue-50' : ''}`}
          style={{ paddingLeft: `${12 + indent}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="mr-1 w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              <span className={`transform transition-transform text-xs ${isExpanded ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>
          )}
          {!hasChildren && <div className="w-5" />}
          
          {/* Node content */}
          <div className="flex items-center justify-between flex-1">
            <div className="flex items-center gap-1.5 flex-1">
              <span>{getRoleIcon(node.nodeData.node_type)}</span>
              {node.isActive ? (
                <span className="text-sm text-blue-800 font-medium">
                  {node.name}
                </span>
              ) : (
                <Link
                  href={getEndeavorLink(node.id, date)}
                  className="text-sm text-gray-700 hover:text-blue-600 hover:underline"
                  title={`View daily log for ${node.name}`}
                >
                  {node.name}
                </Link>
              )}
              {node.isActive && <span className="text-xs text-blue-600">(active)</span>}
            </div>

            {!node.isActive && (
              <Link
                href={getEndeavorLink(node.id, date)}
                className="text-blue-600 hover:text-blue-800 text-xs ml-2"
                title={`View daily log for ${node.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                📝
              </Link>
            )}
          </div>
        </div>
        
        {/* Preview - now collapsible */}
        {node.logPreview && (
          <div className="relative">
            <div className="flex items-center justify-between" style={{ paddingLeft: `${17 + indent}px` }}>
              <div
                className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap max-w-full p-2 hover:bg-blue-50 transition-colors cursor-pointer flex-1"
                onClick={() => togglePreview(node.id)}
              >
                {node.logPreview}
              </div>
              <div className="flex items-center gap-1">
                {node.extendedPreview && node.extendedPreview.length > node.logPreview.length && (
                  <button
                    onClick={() => togglePreview(node.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-1"
                    title="Toggle full preview"
                  >
                    {expandedPreviews.has(node.id) ? '▼' : '▶'}
                  </button>
                )}
                <Link
                  href={getEndeavorLink(node.id, date)}
                  className="text-blue-600 hover:text-blue-800 text-xs px-1"
                  title={`Open daily log for ${node.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  📝
                </Link>
              </div>
            </div>

            {/* Extended preview when expanded */}
            {expandedPreviews.has(node.id) && node.extendedPreview && (
              <div
                className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap p-2 bg-gray-50 ml-2"
                style={{ paddingLeft: `${17 + indent}px` }}
              >
                {node.extendedPreview}
              </div>
            )}
          </div>
        )}
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child))}
          </div>
        )}
      </div>
    )
  }

  if (treeData.length === 0) {
    return <div className="text-gray-500 text-sm">No tree structure found</div>
  }

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium">Daily Logs Tree</h3>
        {(() => {
          // Get the current endeavor to show +child buttons for
          const currentEndeavor = filteredNodes.find(n => n.id === currentNodeId)
          if (!currentEndeavor || !onCreateChild) return null

          const allowedChildTypes = getValidChildTypes(currentEndeavor.node_type as DatabaseNodeType).filter(type => type !== 'Task')
          if (allowedChildTypes.length === 0) return null

          return (
            <div className="flex items-center gap-2">
              {allowedChildTypes.map(childType => (
                <button
                  key={childType}
                  onClick={() => onCreateChild && onCreateChild(currentNodeId, childType)}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded flex items-center gap-1"
                  title={`Create new ${childType} under ${currentEndeavor.title || currentEndeavor.id}`}
                >
                  <span>+</span>
                  <span className="capitalize">{childType}</span>
                </button>
              ))}
            </div>
          )
        })()}
      </div>
      <div className="space-y-1">
        {treeData.map(node => renderNode(node))}
      </div>
    </div>
  )
}

// Compact version for Manage Endeavor section
export function CompactTreeView({
  allNodes: initialNodes,
  currentNodeId,
  date,
  onCreateChild,
  useContextAware = false
}: {
  allNodes: GraphNode[],
  currentNodeId: string,
  date: string,
  onCreateChild?: (parentId: string, childType: DatabaseNodeType) => void,
  useContextAware?: boolean
}) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingTitles, setEditingTitles] = useState<Set<string>>(new Set())
  const [titleValues, setTitleValues] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState<Set<string>>(new Set())

  // Always call the hook but only use it if requested
  const contextData = useContextAwareData()

  const allNodes = useContextAware && contextData ? contextData.nodes : initialNodes

  // Filter to only include endeavor types (exclude tasks as they're shown in dedicated Tasks section)
  const filteredNodes = useMemo(() => {
    const endeavorTypes = ['mission', 'aim', 'initiative', 'goal', 'project', 'ritual', 'daily_page', 'user']
    return allNodes.filter(node => node.node_type && endeavorTypes.includes(node.node_type.toLowerCase()))
  }, [allNodes])

  // Build tree data structure
  const treeData = useMemo(() => {
    // Helper to check if a node is in the current node's hierarchy (parent or child)
    const isInCurrentHierarchy = (nodeId: string): boolean => {
      if (nodeId === currentNodeId) return true
      
      // Check if nodeId is an ancestor of currentNodeId
      let current = filteredNodes.find(n => n.id === currentNodeId)
      const visited = new Set<string>()
      while (current && current.parent_id && !visited.has(current.id)) {
        visited.add(current.id)
        if (current.parent_id === nodeId) return true
        current = filteredNodes.find(n => n.id === current?.parent_id)
      }
      
      // Check if nodeId is a descendant of currentNodeId
      const isDescendant = (parentId: string, targetId: string): boolean => {
        const children = filteredNodes.filter(n => n.parent_id === parentId)
        return children.some(child => 
          child.id === targetId || isDescendant(child.id, targetId)
        )
      }
      
      return isDescendant(currentNodeId, nodeId)
    }

    // Build tree recursively
    const buildNode = (nodeId: string, level = 0): TreeNodeData | null => {
      const node = filteredNodes.find(n => n.id === nodeId)
      if (!node) return null

      const children = filteredNodes
        .filter(n => n.parent_id === nodeId)
        .map(child => buildNode(child.id, level + 1))
        .filter(Boolean) as TreeNodeData[]

      const treeNode: TreeNodeData = {
        id: node.id,
        name: node.title || node.id,
        nodeData: node,
        children: children.length > 0 ? children : undefined,
        isActive: node.id === currentNodeId,
        level
      }

      // Auto-expand nodes that have active descendants or are in the current hierarchy
      const shouldExpand = treeNode.isActive || 
        (children && children.some(child => child.isActive || hasActiveDescendant(child))) ||
        isInCurrentHierarchy(node.id)
        
      if (shouldExpand) {
        setExpandedNodes(prev => new Set([...prev, node.id]))
      }

      return treeNode
    }

    const hasActiveDescendant = (node: TreeNodeData): boolean => {
      if (node.isActive) return true
      if (!node.children) return false
      return node.children.some(child => hasActiveDescendant(child))
    }

    // Find root node and build tree including siblings
    let current = filteredNodes.find(n => n.id === currentNodeId)
    if (!current) return []
    
    // Walk up to find root
    const visited = new Set<string>()
    while (current && current.parent_id && !visited.has(current.id)) {
      visited.add(current.id)
      const parent = filteredNodes.find(n => n.id === current?.parent_id)
      if (parent) current = parent
      else break
    }
    
    // Include siblings of the root in the tree
    const siblings = filteredNodes.filter(n => n.parent_id === current.parent_id)
    const treeNodes = siblings.map(sibling => buildNode(sibling.id)).filter(Boolean) as TreeNodeData[]
    
    return treeNodes
  }, [filteredNodes, currentNodeId])

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }

  const handleStartTitleEdit = (nodeId: string, currentTitle: string) => {
    setEditingTitles(prev => new Set([...prev, nodeId]))
    setTitleValues(prev => new Map([...prev, [nodeId, currentTitle]]))
  }

  const handleCancelTitleEdit = (nodeId: string) => {
    setEditingTitles(prev => {
      const newSet = new Set(prev)
      newSet.delete(nodeId)
      return newSet
    })
    setTitleValues(prev => {
      const newMap = new Map(prev)
      newMap.delete(nodeId)
      return newMap
    })
  }

  const handleSaveTitle = async (nodeId: string) => {
    const newTitle = titleValues.get(nodeId)
    if (!newTitle) return

    setLoading(prev => new Set([...prev, nodeId]))
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(nodeId)}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update title')
      }

      // Update local state
      handleCancelTitleEdit(nodeId)
      window.location.reload()
    } catch (error) {
      console.error('Failed to save title:', error)
      alert('Failed to save title: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(nodeId)
        return newSet
      })
    }
  }

  const handleCompleteTask = async (nodeId: string, taskTitle: string) => {
    setLoading(prev => new Set([...prev, nodeId]))
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(nodeId)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Task completed' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to complete task')
      }

      // Refresh to show updated state
      window.location.reload()
    } catch (error) {
      console.error('Failed to complete task:', error)
      alert('Failed to complete task: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(prev => {
        const newSet = new Set(prev)
        newSet.delete(nodeId)
        return newSet
      })
    }
  }

  const renderNode = (node: TreeNodeData): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const isExpanded = expandedNodes.has(node.id)
    const indent = node.level * 16

    return (
      <div key={node.id}>
        {/* Node itself */}
        <div 
          className={`flex items-center py-1 px-1 hover:bg-gray-50 ${node.isActive ? 'bg-blue-50' : ''}`}
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={() => toggleExpand(node.id)}
              className="mr-1 w-3 h-3 flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              <span className={`transform transition-transform text-xs ${isExpanded ? 'rotate-90' : ''}`}>
                ▶
              </span>
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          {/* Node content */}
          <div className="flex items-center justify-between flex-1 group">
            {/* Node title/info */}
            <div className="flex items-center gap-1 flex-1">
              <span className="text-sm">{getRoleIcon(node.nodeData.node_type)}</span>

              {/* Show completion status for archived tasks */}
              {node.nodeData.node_type === 'Task' && node.nodeData.archived_at && (
                <span className="text-xs text-green-600">✅</span>
              )}

              {/* Title editing for tasks */}
              {node.nodeData.node_type === 'Task' && editingTitles.has(node.id) ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="text"
                    value={titleValues.get(node.id) || ''}
                    onChange={(e) => setTitleValues(prev => new Map([...prev, [node.id, e.target.value]]))}
                    className="text-xs bg-white border border-gray-300 rounded px-1 py-0.5 flex-1 min-w-0"
                    placeholder="Task title..."
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(node.id)
                      if (e.key === 'Escape') handleCancelTitleEdit(node.id)
                    }}
                  />
                  <button
                    onClick={() => handleSaveTitle(node.id)}
                    className="text-xs text-green-600 hover:text-green-800 px-1"
                    disabled={loading.has(node.id)}
                    title="Save title"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleCancelTitleEdit(node.id)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-1"
                    disabled={loading.has(node.id)}
                    title="Cancel editing"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  {node.isActive ? (
                    <span
                      className="text-xs truncate text-blue-800 font-medium"
                      title={`${node.nodeData.node_type}: ${node.name}${node.nodeData.description ? '\n\n' + node.nodeData.description : ''}`}
                    >
                      {node.name}
                    </span>
                  ) : (
                    <Link
                      href={getEndeavorLink(node.id, date)}
                      className={`text-xs truncate hover:underline ${
                        node.nodeData.archivedAt ? 'text-gray-500 line-through hover:text-gray-700' : 'text-gray-700 hover:text-blue-600'
                      }`}
                      title={`${node.nodeData.node_type}: ${node.name}${node.nodeData.description ? '\n\n' + node.nodeData.description : ''}`}
                    >
                      {node.name}
                    </Link>
                  )}
                  {node.isActive && <span className="text-xs text-blue-600">(current)</span>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Task-specific controls */}
              {node.nodeData.node_type === 'Task' && !node.nodeData.archivedAt && (
                <>
                  {/* Edit title button */}
                  {!editingTitles.has(node.id) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleStartTitleEdit(node.id, node.name)
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700 px-1"
                      title="Edit title"
                      disabled={loading.has(node.id)}
                    >
                      ✏️
                    </button>
                  )}

                  {/* Complete task button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCompleteTask(node.id, node.name)
                    }}
                    className="text-xs text-green-600 hover:text-green-800 px-1"
                    title="Complete task"
                    disabled={loading.has(node.id)}
                  >
                    {loading.has(node.id) ? '⏳' : '✅'}
                  </button>

                </>
              )}

              {/* Daily log link */}
              {!node.isActive && (
                <Link
                  href={getEndeavorLink(node.id, date)}
                  className="text-blue-600 hover:text-blue-800 text-xs px-1"
                  title={`View daily log for ${node.name}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  📝
                </Link>
              )}
            </div>
          </div>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => renderNode(child))}
          </div>
        )}
      </div>
    )
  }

  if (treeData.length === 0) {
    return <div className="text-gray-500 text-xs">No related endeavors</div>
  }

  // Get current endeavor for +child buttons
  const currentEndeavor = filteredNodes.find(n => n.id === currentNodeId)
  const allowedChildTypes = currentEndeavor ? getValidChildTypes(currentEndeavor.node_type as DatabaseNodeType).filter(type => type !== 'Task') : []

  return (
    <div className="space-y-2">
      {/* +Child buttons */}
      {onCreateChild && allowedChildTypes.length > 0 && !currentEndeavor?.archivedAt && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <span className="text-xs text-gray-600">Create:</span>
          {allowedChildTypes.map(childType => (
            <button
              key={childType}
              onClick={() => onCreateChild(currentNodeId, childType)}
              className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded flex items-center gap-1"
              title={`Create new ${childType} under ${currentEndeavor?.title || currentEndeavor?.id}`}
            >
              <span>+{childType.charAt(0).toUpperCase() + childType.slice(1)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tree content */}
      <div className="space-y-1">
        {treeData.map(node => renderNode(node))}
      </div>
    </div>
  )
}