'use client'

import { useState, useCallback } from 'react'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { getValidParentTypes } from '../../lib/graph/types'
import { getRoleIcon } from '../../lib/constants/icons'
import { getActiveConfig } from '../../lib/config'

interface CreateChildModalProps {
  isOpen: boolean
  onClose: () => void
  childType: string
  currentParent: GraphNode
  allNodes: GraphNode[]
  onCreateChild: (title: string, parentId: string) => void
  loading?: boolean
}

export function CreateChildModal({
  isOpen,
  onClose,
  childType,
  currentParent,
  allNodes,
  onCreateChild,
  loading = false
}: CreateChildModalProps) {
  const [title, setTitle] = useState('')
  const [selectedParentId, setSelectedParentId] = useState(currentParent.id)
  const config = getActiveConfig()

  // Resolve display name from config
  const childTypeConfig = config.nodeTypes.find(nt => nt.name === childType || nt.slug === childType)
  const displayTypeName = childTypeConfig?.name || childType

  // Get potential parents using the config-driven hierarchy
  const getPotentialParents = () => {
    const validParentTypes = getValidParentTypes(childType)
    return allNodes.filter(node => node.node_type && validParentTypes.includes(node.node_type))
  }

  const potentialParents = getPotentialParents()

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) {
      onCreateChild(title.trim(), selectedParentId)
    }
  }, [title, selectedParentId, onCreateChild])

  const handleCancel = useCallback(() => {
    setTitle('')
    setSelectedParentId(currentParent.id)
    onClose()
  }, [currentParent.id, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <span>{getRoleIcon(childType)}</span>
              Create New {displayTypeName}
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600"
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
                placeholder={`Enter ${displayTypeName} title...`}
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent
              </label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {potentialParents.map(parent => (
                  <option key={parent.id} value={parent.id}>
                    {parent.title || parent.id} ({parent.node_type})
                  </option>
                ))}
              </select>
              {potentialParents.length === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  No valid parents found for {displayTypeName}
                </p>
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
