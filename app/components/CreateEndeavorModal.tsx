'use client'

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { ContextNode } from '../../lib/contexts/context-operations'
import { getRoleIcon } from '../../lib/constants/icons'
import { TreeSelect } from 'primereact/treeselect'
import { Dropdown } from 'primereact/dropdown'
import { getActiveConfig } from '../../lib/config'
import { getValidParentTypes } from '../../lib/graph/types'

interface CreateEndeavorModalProps {
  isOpen: boolean
  onClose: () => void
  defaultType?: string
  defaultParentId?: string
  contextId?: string | null
  allNodes: GraphNode[]
  onCreateEndeavor: (title: string, type: string, parentId: string) => Promise<void>
  loading?: boolean
}

export function CreateEndeavorModal({
  isOpen,
  onClose,
  defaultType = 'task',
  defaultParentId,
  contextId,
  allNodes,
  onCreateEndeavor,
  loading = false
}: CreateEndeavorModalProps) {
  const [title, setTitle] = useState('')
  const [selectedParentId, setSelectedParentId] = useState<string>(defaultParentId || '')
  const initializedRef = useRef(false)
  const config = getActiveConfig()

  // Reset form when modal opens/closes or defaults change
  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setSelectedParentId(defaultParentId || '')
      initializedRef.current = false
    }
  }, [isOpen, defaultParentId, contextId])

  // Resolve defaultType to DB name for display
  const defaultTypeConfig = config.nodeTypes.find(nt => nt.slug === defaultType || nt.name === defaultType)
  const displayTypeName = defaultTypeConfig?.name || defaultType

  // Tree data for TreeSelect - context-aware hierarchical structure
  const treeData = useMemo(() => {
    // Get valid parent types from config (using DB name format)
    const validParentTypeNames = getValidParentTypes(displayTypeName)
    // Also accept slug-based lookups
    const validParentTypeSlugs = validParentTypeNames.map(name => {
      const nt = config.nodeTypes.find(n => n.name === name)
      return nt?.slug || name.toLowerCase()
    })

    // If we have a specific defaultParentId, ensure that node is included regardless of type restrictions
    let parentNodeToInclude = null
    if (defaultParentId) {
      parentNodeToInclude = allNodes.find(node => node.id === defaultParentId)
    }

    // Filter nodes based on current context
    let contextFilteredNodes = allNodes
    if (contextId && contextId !== 'personal') {
      contextFilteredNodes = allNodes
    }

    let potentialParents = contextFilteredNodes.filter(node => {
      const nodeTypeLower = node.node_type.toLowerCase()
      return (
        validParentTypeNames.includes(node.node_type) ||
        validParentTypeSlugs.includes(nodeTypeLower)
      ) && !node.archived_at
    })

    // Ensure the defaultParentId node is always included if it exists
    if (parentNodeToInclude && !potentialParents.some(p => p.id === parentNodeToInclude.id)) {
      potentialParents.push(parentNodeToInclude)
    }

    // Build tree structure recursively
    const buildTreeNode = (node: GraphNode): any => {
      const children = potentialParents.filter(child => child.parent_id === node.id)
      return {
        key: node.id,
        label: `${getRoleIcon(node.node_type)} ${node.title || node.id}`,
        data: node.id,
        children: children.length > 0 ? children.map(buildTreeNode) : undefined
      }
    }

    // Find root nodes (no parent or parent not in potential parents list)
    const rootNodes = potentialParents.filter(node =>
      !node.parent_id || !potentialParents.some(p => p.id === node.parent_id)
    )

    return rootNodes.map(buildTreeNode)
  }, [defaultType, displayTypeName, allNodes, contextId, defaultParentId, config])

  // Helper function to check if a key exists in tree
  const findKeyInTree = useCallback((nodes: any[], key: string): boolean => {
    for (const node of nodes) {
      if (node.key === key) return true
      if (node.children && findKeyInTree(node.children, key)) return true
    }
    return false
  }, [])

  // Auto-select logic for TreeSelect - run when modal opens with data
  useEffect(() => {
    if (isOpen && !initializedRef.current && defaultParentId && treeData.length > 0) {
      // Check if the parent exists in treeData before setting it
      const parentExists = findKeyInTree(treeData, defaultParentId)
      if (parentExists) {
        // Clear first, then set to ensure TreeSelect updates
        setSelectedParentId('')
        // Use setTimeout to ensure TreeSelect processes the clear first
        setTimeout(() => {
          setSelectedParentId(defaultParentId)
        }, 10)
      }
      initializedRef.current = true
    }
  }, [isOpen, defaultParentId, treeData, findKeyInTree])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      await onCreateEndeavor(title.trim(), defaultType, selectedParentId || '')
    }
  }, [title, defaultType, selectedParentId, onCreateEndeavor])

  const handleCancel = useCallback(() => {
    setTitle('')
    setSelectedParentId('')
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <span>{getRoleIcon(defaultType)}</span>
              Create New {displayTypeName}
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter endeavor title..."
                autoFocus
                required
                disabled={loading}
              />
            </div>


            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent
              </label>
              {treeData.length > 0 ? (
                <TreeSelect
                  value={selectedParentId}
                  onChange={(e) => {
                    const value = typeof e.value === 'string' ? e.value : String(e.value || '')
                    setSelectedParentId(value)
                  }}
                  options={treeData}
                  className="w-full"
                  placeholder="Select parent..."
                  disabled={loading}
                  filter
                  showClear
                  selectionMode="single"
                  metaKeySelection={false}
                />
              ) : (
                <div className="p-2 border rounded bg-gray-50 text-gray-500 text-sm">
                  No valid parents found for {displayTypeName}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium disabled:opacity-50"
                disabled={!title.trim() || loading}
              >
                {loading ? 'Creating...' : `Create ${displayTypeName}`}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
