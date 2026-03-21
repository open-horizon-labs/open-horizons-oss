'use client'

import { useState, useMemo } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { RadioButton } from 'primereact/radiobutton'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { getValidParentTypes } from '../../lib/graph/types'
import { getRoleIcon } from '../../lib/constants/icons'

interface ChangeParentModalProps {
  visible: boolean
  onHide: () => void
  endeavorId: string
  endeavorTitle: string
  currentParentId: string | null
  nodeType: DatabaseNodeType
  allNodes: GraphNode[]
  onChanged?: () => void
}

export function ChangeParentModal({
  visible,
  onHide,
  endeavorId,
  endeavorTitle,
  currentParentId,
  nodeType,
  allNodes,
  onChanged
}: ChangeParentModalProps) {
  const [selectedParentId, setSelectedParentId] = useState<string | null>(currentParentId)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get valid parent types for this node type
  const validParentTypes = useMemo(() => getValidParentTypes(nodeType), [nodeType])

  // Get all descendants of this endeavor (to prevent circular dependencies)
  const descendantIds = useMemo(() => {
    const descendants = new Set<string>()
    const findDescendants = (parentId: string) => {
      for (const node of allNodes) {
        if (node.parent_id === parentId && !descendants.has(node.id)) {
          descendants.add(node.id)
          findDescendants(node.id)
        }
      }
    }
    findDescendants(endeavorId)
    return descendants
  }, [endeavorId, allNodes])

  // Filter to valid parent options
  const validParents = useMemo(() => {
    return allNodes.filter(node => {
      // Must be a valid parent type
      if (!validParentTypes.includes(node.node_type)) return false
      // Can't be self
      if (node.id === endeavorId) return false
      // Can't be a descendant (would create cycle)
      if (descendantIds.has(node.id)) return false
      // Can't be archived
      if (node.archived_at) return false
      return true
    })
  }, [allNodes, validParentTypes, endeavorId, descendantIds])

  // Reset selection when modal opens
  const handleShow = () => {
    setSelectedParentId(currentParentId)
    setError(null)
  }

  const handleSave = async () => {
    // Don't save if nothing changed
    if (selectedParentId === currentParentId) {
      onHide()
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavorId)}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: selectedParentId })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update parent')
      }

      onChanged?.()
      onHide()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update parent')
    } finally {
      setLoading(false)
    }
  }

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button
        label="Cancel"
        severity="secondary"
        outlined
        onClick={onHide}
        disabled={loading}
      />
      <Button
        label="Save"
        onClick={handleSave}
        loading={loading}
        disabled={selectedParentId === currentParentId}
      />
    </div>
  )

  // Missions can't have parents
  if (nodeType === 'Mission') {
    return (
      <Dialog
        header="Change Parent"
        visible={visible}
        onHide={onHide}
        onShow={handleShow}
        style={{ width: '450px' }}
        modal
        draggable={false}
        resizable={false}
      >
        <div className="text-center py-4 text-gray-600">
          <i className="pi pi-info-circle text-3xl mb-3 block text-blue-500" />
          <p className="font-medium">Missions are root-level endeavors</p>
          <p className="text-sm mt-2">Missions cannot have a parent. They sit at the top of the hierarchy.</p>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog
      header={`Change Parent for "${endeavorTitle}"`}
      visible={visible}
      onHide={onHide}
      onShow={handleShow}
      footer={footer}
      style={{ width: '500px' }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="space-y-4">
        {error && (
          <Message severity="error" text={error} className="w-full" />
        )}

        <div className="text-sm text-gray-600 mb-4">
          Select a new parent for this {nodeType.toLowerCase()}.
          Valid parents: {validParentTypes.map(t => t.toLowerCase()).join(', ') || 'none'}.
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {/* No parent option */}
          <div className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
            <RadioButton
              inputId="parent-none"
              name="parentSelection"
              value={null}
              onChange={() => setSelectedParentId(null)}
              checked={selectedParentId === null}
              disabled={loading}
            />
            <label htmlFor="parent-none" className="flex-1 cursor-pointer">
              <div className="font-medium flex items-center gap-2">
                <i className="pi pi-ban text-gray-400" />
                No parent (root level)
              </div>
              <div className="text-sm text-gray-500">
                Make this {nodeType.toLowerCase()} a root endeavor
              </div>
            </label>
          </div>

          {/* Valid parent options */}
          {validParents.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <p>No valid {validParentTypes.map(t => t.toLowerCase()).join(' or ')} available</p>
            </div>
          )}

          {validParents.map(node => (
            <div key={node.id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
              <RadioButton
                inputId={`parent-${node.id}`}
                name="parentSelection"
                value={node.id}
                onChange={(e) => setSelectedParentId(e.value)}
                checked={selectedParentId === node.id}
                disabled={loading}
              />
              <label htmlFor={`parent-${node.id}`} className="flex-1 cursor-pointer">
                <div className="font-medium flex items-center gap-2">
                  <span>{getRoleIcon(node.node_type)}</span>
                  {node.title || node.id}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {node.node_type.toLowerCase()}
                  {node.id === currentParentId && ' (current parent)'}
                </div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </Dialog>
  )
}

export default ChangeParentModal
