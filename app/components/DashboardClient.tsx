'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ContextNode } from '../../lib/contexts/context-operations'
import { GraphNode, ApiNodeType, UserNodeType, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'

// Use contract types instead of legacy NodeType
type NodeType = UserNodeType
import { filterNodesByType, consumeGraphNodes } from '../../lib/contracts/ui-helpers'
import { LensFilter, LensPresetBar } from './LensFilter'
import { NodeTypeChip } from './NodeTypeChips'
import { getRoleIcon } from '../../lib/constants/icons'
import { getEndeavorLink, navigateToEndeavor } from '../../lib/utils/endeavor-links'
import { createContextAwareNode } from '../../lib/ui/breadcrumb-utils'
import { CreateEndeavorModal } from './CreateEndeavorModal'
import { Toast } from 'primereact/toast'
import Link from 'next/link'

// Simple type matching using contract types
function isTypeMatch(nodeType: string, selectedType: NodeType): boolean {
  return nodeType.toLowerCase() === selectedType.toLowerCase()
}

// Get all nodes in a hierarchy (ancestors + descendants + self)
function getHierarchyNodes(nodeId: string, allNodes: GraphNode[]): Set<string> {
  const hierarchyIds = new Set<string>()
  
  // Add the node itself
  hierarchyIds.add(nodeId)
  
  // Get all ancestors using parent_id directly (no need for traverse function)
  const getAncestors = (id: string): GraphNode[] => {
    const result: GraphNode[] = []
    let current = allNodes.find(n => n.id === id)

    while (current?.parent_id) {
      const parent = allNodes.find(n => n.id === current!.parent_id!)
      if (parent) {
        result.push(parent)
        current = parent
      } else {
        break
      }
    }

    return result
  }

  const getDescendants = (id: string): GraphNode[] => {
    const result: GraphNode[] = []
    const toVisit = [id]
    const visited = new Set<string>()

    while (toVisit.length > 0) {
      const currentId = toVisit.shift()!
      if (visited.has(currentId)) continue
      visited.add(currentId)

      const children = allNodes.filter(n => n.parent_id === currentId)
      for (const child of children) {
        result.push(child)
        toVisit.push(child.id)
      }
    }

    return result
  }

  const ancestorNodes = getAncestors(nodeId)
  ancestorNodes.forEach(node => hierarchyIds.add(node.id))

  const descendantNodes = getDescendants(nodeId)
  descendantNodes.forEach(node => hierarchyIds.add(node.id))
  
  return hierarchyIds
}

interface DashboardClientProps {
  nodes: GraphNode[]
  userId: string
  today: string
  contextId?: string
  onDataChange?: () => void
}

export function DashboardClient({ nodes, userId, today, contextId, onDataChange }: DashboardClientProps) {
  const [selectedTypes, setSelectedTypes] = useState<NodeType[]>([])
  const [viewMode, setViewMode] = useState<'list'>('list')
  const [hierarchyFocus, setHierarchyFocus] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const toast = useRef<Toast>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [createModal, setCreateModal] = useState<{
    isOpen: boolean
    defaultType?: NodeType
    defaultParentId?: string
  }>({ isOpen: false })
  const [availableContexts, setAvailableContexts] = useState<ContextNode[]>([])

  // Load last used filters from localStorage on mount
  useEffect(() => {
    const storedTypes = localStorage.getItem('dashboard-selected-types')
    const storedHierarchyFocus = localStorage.getItem('dashboard-hierarchy-focus')
    const storedViewMode = localStorage.getItem('dashboard-view-mode')

    if (storedTypes) {
      try {
        const types = JSON.parse(storedTypes) as NodeType[]
        if (Array.isArray(types)) {
          setSelectedTypes(types)
        }
      } catch (error) {
        console.warn('Failed to parse stored types:', error)
      }
    }

    if (storedHierarchyFocus && storedHierarchyFocus !== 'null') {
      // Validate that the focus node still exists
      if (nodes.find(n => n.id === storedHierarchyFocus)) {
        setHierarchyFocus(storedHierarchyFocus)
      }
    }

    if (storedViewMode === 'list') {
      setViewMode(storedViewMode)
    }

    setIsLoaded(true)
  }, [nodes])

  // Load available contexts for modal
  useEffect(() => {
    async function loadContexts() {
      try {
        const response = await fetch('/api/contexts')
        if (response.ok) {
          const data = await response.json()
          setAvailableContexts(data.contexts || [])
        }
      } catch (error) {
        console.error('Failed to load contexts:', error)
      }
    }
    loadContexts()
  }, [])


  // Filter nodes based on selected types and hierarchy focus
  // Always exclude Task nodes from the strategy graph view
  const filteredNodes = useMemo(() => {
    let filtered = nodes.filter(node =>
      node.node_type?.toLowerCase() !== 'task'
    )

    // First apply hierarchy focus if set
    if (hierarchyFocus) {
      const hierarchyIds = getHierarchyNodes(hierarchyFocus, nodes)
      filtered = filtered.filter(node => hierarchyIds.has(node.id))
    }

    // Then apply type filtering
    if (selectedTypes.length === 0) {
      return filtered
    }

    return filtered.filter(node => {
      // Check node type - contract guarantees proper capitalization
      return selectedTypes.some(selectedType =>
        node.node_type && isTypeMatch(node.node_type, selectedType)
      )
    })
  }, [nodes, selectedTypes, hierarchyFocus])

  const handleTypeToggle = (type: NodeType) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type]
    setSelectedTypes(newTypes)
    localStorage.setItem('dashboard-selected-types', JSON.stringify(newTypes))
  }

  const handleClearTypes = () => {
    setSelectedTypes([])
    localStorage.setItem('dashboard-selected-types', JSON.stringify([]))
  }

  const handleApplyPreset = (types: NodeType[]) => {
    setSelectedTypes(types)
    localStorage.setItem('dashboard-selected-types', JSON.stringify(types))
  }
  
  const handleHierarchyFocus = (nodeId: string | null) => {
    setHierarchyFocus(nodeId)
    localStorage.setItem('dashboard-hierarchy-focus', nodeId || 'null')
  }

  // Modal handlers
  const handleCreateEndeavor = async (title: string, type: NodeType, parentId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          parentId: parentId || undefined,
          contextId: contextId
        })
      })

      if (response.ok) {
        const { endeavorId } = await response.json()
        setCreateModal({ isOpen: false })
        onDataChange?.() // Refresh the dashboard data
        // Navigate with context to ensure proper access to the new endeavor
        navigateToEndeavor(endeavorId, today)
      } else {
        const error = await response.json()

        // 🚨 ENHANCED ERROR DISPLAY: Show detailed contract violations
        if (error.details && error.issues) {
          // Contract violation with detailed field errors
          const fieldErrors = error.issues.map((issue: any) => `${issue.field}: ${issue.message}`).join('\n')
          toast.current?.show({
            severity: 'error',
            summary: 'Validation Error',
            detail: `${error.details}\n\nField Errors:\n${fieldErrors}`,
            life: 8000 // Longer display for detailed errors
          })
        } else if (error.details) {
          // Contract violation with general details
          toast.current?.show({
            severity: 'error',
            summary: 'Validation Error',
            detail: error.details,
            life: 6000
          })
        } else {
          // Generic error
          toast.current?.show({
            severity: 'error',
            summary: 'Error',
            detail: error.error || 'Failed to create endeavor. Please try again.',
            life: 3000
          })
        }
        throw new Error(error.error || 'Failed to create endeavor')
      }
    } catch (error) {
      console.error('Failed to create endeavor:', error)
      // Only show generic toast if we haven't already shown a detailed one
      if (!(error instanceof Error && error.message.includes('Contract violation'))) {
        toast.current?.show({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to create endeavor. Please try again.',
          life: 3000
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = (type: NodeType, defaultParentId?: string) => {
    setCreateModal({
      isOpen: true,
      defaultType: type,
      defaultParentId: defaultParentId
    })
  }
  
  const handleViewModeChange = (mode: 'list') => {
    setViewMode(mode)
    localStorage.setItem('dashboard-view-mode', mode)
  }

  // 🚨 CONTRACT-FIRST UI: Use contract helpers for type safety
  // Group nodes by type for display using contract-validated data
  // Tasks are not displayed as separate cards - they appear nested in parent endeavor cards
  const missions = filterNodesByType(filteredNodes, 'Mission')
  const aims = filterNodesByType(filteredNodes, 'Aim')
  const initiatives = filterNodesByType(filteredNodes, 'Initiative')


  // Don't render until we've loaded from localStorage to prevent hydration mismatch
  if (!isLoaded) {
    return <div className="space-y-6">Loading dashboard...</div>
  }

  return (
    <div className="space-y-6">
      {/* Hierarchy Focus Indicator */}
      {hierarchyFocus && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>🌳</span>
              <span className="text-sm font-medium text-purple-800">
                Hierarchy Focus: {(() => {
                  const focusNode = nodes.find(n => n.id === hierarchyFocus)
                  return focusNode?.title || hierarchyFocus
                })()}
              </span>
              <span className="text-xs text-purple-600">
                (Showing {filteredNodes.length} related endeavors)
              </span>
            </div>
            <button
              onClick={() => handleHierarchyFocus(null)}
              className="text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-100 px-2 py-1 rounded"
            >
              Clear Focus
            </button>
          </div>
        </div>
      )}
      
      {/* Lens Controls */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LensFilter
              selectedRoles={selectedTypes as any}
              onRoleToggle={handleTypeToggle as any}
              onClear={handleClearTypes}
            />
            {filteredNodes.length !== nodes.length && (
              <span className="text-sm text-gray-600">
                Showing {filteredNodes.length} of {nodes.length} endeavors
              </span>
            )}
          </div>
          
        </div>
        
        <LensPresetBar
          selectedRoles={selectedTypes as any}
          onApplyPreset={handleApplyPreset as any}
        />

      </div>

      {/* Results */}
      {nodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-4">No Mission Defined Yet</div>
          <div className="text-sm mb-4">
            Start by defining your mission to give direction to your other endeavors, or import your existing aims.
          </div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => openCreateModal('mission')}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Mission
            </button>
            <Link
              href="/settings/markdown-aims"
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Import Aims
            </Link>
          </div>
        </div>
      ) : filteredNodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg mb-2">No endeavors match your lens filter</div>
          <div className="text-sm mb-3">
            {selectedTypes.length > 0
              ? `No endeavors found with types: ${selectedTypes.join(', ')}`
              : 'Try adjusting your type selection'
            }
          </div>
          <button
            onClick={handleClearTypes}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            Clear Filter
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Missions */}
          <NodeSection
            title="Missions"
            nodes={missions}
            today={today}
            allNodes={nodes}
            hierarchyFocus={hierarchyFocus}
            onHierarchyFocus={handleHierarchyFocus}
            loading={loading}
            setLoading={setLoading}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            toast={toast}
            onDataChange={onDataChange}
            contextId={contextId}
            openCreateModal={openCreateModal}
          />

          {/* Aims */}
          <NodeSection
            title="Aims"
            nodes={aims}
            today={today}
            allNodes={nodes}
            hierarchyFocus={hierarchyFocus}
            onHierarchyFocus={handleHierarchyFocus}
            loading={loading}
            setLoading={setLoading}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            toast={toast}
            onDataChange={onDataChange}
            contextId={contextId}
            openCreateModal={openCreateModal}
          />

          {/* Initiatives */}
          <NodeSection
            title="Initiatives"
            nodes={initiatives}
            today={today}
            allNodes={nodes}
            hierarchyFocus={hierarchyFocus}
            onHierarchyFocus={handleHierarchyFocus}
            loading={loading}
            setLoading={setLoading}
            isDragging={isDragging}
            setIsDragging={setIsDragging}
            toast={toast}
            onDataChange={onDataChange}
            contextId={contextId}
            openCreateModal={openCreateModal}
          />


        </div>
      )}

      {/* Toast for error notifications */}
      <Toast ref={toast} />

      {/* Modal rendered at the end */}
      {createModal.isOpen && (
        <CreateEndeavorModal
          isOpen={createModal.isOpen}
          onClose={() => setCreateModal({ isOpen: false })}
          defaultType={createModal.defaultType}
          defaultParentId={createModal.defaultParentId}
          contextId={contextId}
          allNodes={nodes}
          onCreateEndeavor={handleCreateEndeavor}
          loading={loading}
        />
      )}
    </div>
  )
}

interface NodeSectionProps {
  title: string
  nodes: GraphNode[]
  today: string
  allNodes: GraphNode[]
  hierarchyFocus: string | null
  onHierarchyFocus: (nodeId: string | null) => void
  loading: boolean
  setLoading: (loading: boolean) => void
  isDragging: boolean
  setIsDragging: (isDragging: boolean) => void
  toast: React.RefObject<Toast | null>
  onDataChange?: () => void
  contextId?: string
  openCreateModal: (type: NodeType, defaultParentId?: string) => void
}

function NodeSection({ title, nodes, today, allNodes, hierarchyFocus, onHierarchyFocus, loading, setLoading, isDragging, setIsDragging, toast, onDataChange, contextId, openCreateModal }: NodeSectionProps) {
  return (
    <div>
      <div className="group flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900">{title}</h3>

        {/* Create section-level button - only for this section's type */}
        {(title === 'Missions' || title === 'Aims' || title === 'Initiatives') && (
          <div className={`${title === 'Missions' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity flex items-center gap-1 text-sm`}>
            <span className="text-gray-500">Create:</span>
            {title === 'Missions' && (
              <button
                onClick={() => openCreateModal('mission')}
                className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-xs font-medium"
                disabled={loading}
              >
                +Mission
              </button>
            )}
            {title === 'Aims' && (
              <button
                onClick={() => openCreateModal('aim')}
                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-medium"
                disabled={loading}
              >
                +Aim
              </button>
            )}
            {title === 'Initiatives' && (
              <button
                onClick={() => openCreateModal('initiative')}
                className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium"
                disabled={loading}
              >
                +Initiative
              </button>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {/* Always show existing nodes if any */}
        {nodes.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {nodes.map(node => {
          const children = allNodes.filter(n => n.parent_id === node.id)

          return (
            <div
              key={node.id}
              className="relative border rounded-lg p-4 bg-white hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  {/* Parent breadcrumb */}
                  {node.parent_id && (
                    <div className="text-xs text-gray-500 mb-1">
                      {(() => {
                        const parentNode = allNodes.find(n => n.id === node.parent_id)
                        return parentNode ? (
                          <div className="flex items-center gap-1">
                            <span>{getRoleIcon(parentNode.node_type)}</span>
                            <Link
                              href={getEndeavorLink(parentNode.id, today)}
                              className="hover:text-blue-600 hover:underline"
                            >
                              {parentNode.title || parentNode.id}
                            </Link>
                            <span>→</span>
                          </div>
                        ) : null
                      })()}
                    </div>
                  )}
                  
                  <Link
                    href={getEndeavorLink(node.id, today)}
                    className="text-base font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer flex items-center gap-2"
                    title={node.description ? `${node.title || node.id}: ${node.description}` : `View ${node.title || node.id}`}
                  >
                    <span>{getRoleIcon(node.node_type)}</span>
                    <span>{node.title || node.id}</span>
                  </Link>
                </div>
                
                <div className="flex items-center gap-1">
                  {/* Hierarchical creation buttons - strict hierarchy */}
                  {node.node_type === 'Mission' && (
                    <button
                      onClick={() => openCreateModal('aim', node.id)}
                      className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs font-medium"
                      disabled={loading}
                      title={`Create Aim under "${node.title}"`}
                    >
                      +Aim
                    </button>
                  )}
                  {node.node_type === 'Aim' && (
                    <button
                      onClick={() => openCreateModal('initiative', node.id)}
                      className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs font-medium"
                      disabled={loading}
                      title={`Create Initiative under "${node.title}"`}
                    >
                      +Initiative
                    </button>
                  )}
                  <button
                    onClick={() => onHierarchyFocus(hierarchyFocus === node.id ? null : node.id)}
                    className={`px-2 py-1 text-xs rounded ${
                      hierarchyFocus === node.id
                        ? 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        : 'text-purple-600 hover:text-purple-800 hover:bg-purple-50'
                    }`}
                    title={hierarchyFocus === node.id ? "Clear hierarchy focus" : "Focus on this hierarchy"}
                  >
                    🌳 {hierarchyFocus === node.id ? 'Clear' : 'Focus'}
                  </button>
                </div>
              </div>

              {/* Show non-task children as badges */}
              {(() => {
                const nonTaskChildren = children.filter(child => child.node_type !== 'Task')
                return nonTaskChildren.length > 0 ? (
                  <div className="mt-3 pt-2 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {nonTaskChildren.map(child => (
                        <Link
                          key={child.id}
                          href={getEndeavorLink(child.id, today)}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-xs text-gray-700 transition-all hover:bg-gray-200 cursor-pointer"
                          title={child.description ? `${child.title || child.id}: ${child.description}` : child.title || child.id}
                        >
                          <span>{child.title || child.id}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
            </div>
          )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

