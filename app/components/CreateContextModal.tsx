'use client'

import { useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { TreeSelect } from 'primereact/treeselect'

interface CreateContextModalProps {
  visible: boolean
  onHide: () => void
  onContextCreated: (contextId: string) => void
  availableEndeavors?: Array<{ id: string; title: string; node_type: string; parent_id: string | null }>
}

export function CreateContextModal({
  visible,
  onHide,
  onContextCreated,
  availableEndeavors = []
}: CreateContextModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedEndeavors, setSelectedEndeavors] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Context title is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/contexts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          sharedEndeavors: selectedEndeavors,
          participants: [] // Start with just the creator
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create context')
      }

      onContextCreated(data.contextId)
      onHide()

      // Reset form
      setTitle('')
      setDescription('')
      setSelectedEndeavors([])
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create context')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    onHide()
    setTitle('')
    setDescription('')
    setSelectedEndeavors([])
    setError(null)
  }

  // Transform endeavors for TreeSelect (hierarchical structure)
  const buildEndeavorTree = (endeavors: Array<{ id: string; title: string; node_type: string; parent_id: string | null }>) => {
    const nodeMap = new Map()
    const roots: any[] = []

    // Create nodes
    endeavors.forEach(endeavor => {
      nodeMap.set(endeavor.id, {
        key: endeavor.id,
        label: `${endeavor.title} (${endeavor.node_type})`,
        data: endeavor,
        children: []
      })
    })

    // Build hierarchy based on parent relationships
    endeavors.forEach(endeavor => {
      const node = nodeMap.get(endeavor.id)

      if (endeavor.parent_id && nodeMap.has(endeavor.parent_id)) {
        // Add to parent's children
        const parentNode = nodeMap.get(endeavor.parent_id)
        parentNode.children.push(node)
      } else {
        // No parent or parent not found, treat as root
        roots.push(node)
      }
    })

    return roots
  }

  const endeavorTreeNodes = buildEndeavorTree(availableEndeavors)

  const footer = (
    <div className="flex gap-2 justify-end">
      <Button
        label="Cancel"
        severity="secondary"
        outlined
        onClick={handleCancel}
        disabled={loading}
      />
      <Button
        label="Create Context"
        onClick={handleSubmit}
        loading={loading}
        disabled={!title.trim()}
      />
    </div>
  )

  return (
    <Dialog
      header="Create New Context"
      visible={visible}
      onHide={handleCancel}
      footer={footer}
      style={{ width: '600px' }}
      modal
      draggable={false}
      resizable={false}
    >
      <div className="space-y-4">
        {error && (
          <Message severity="error" text={error} className="w-full" />
        )}

        <div className="space-y-2">
          <label htmlFor="context-title" className="block text-sm font-medium">
            Context Title *
          </label>
          <InputText
            id="context-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Collaborate with colleagues on Project X"
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="context-description" className="block text-sm font-medium">
            Description
          </label>
          <InputTextarea
            id="context-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description of this collaboration context"
            rows={3}
            className="w-full"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="shared-endeavors" className="block text-sm font-medium">
            Move Endeavors to Context
          </label>
          <TreeSelect
            id="shared-endeavors"
            value={selectedEndeavors.reduce((acc, id) => ({ ...acc, [id]: true }), {})}
            options={endeavorTreeNodes}
            onChange={(e) => {
              // TreeSelect can return object keys, extract the IDs
              const selectedIds = Object.keys(e.value || {})
              setSelectedEndeavors(selectedIds)
            }}
            placeholder="Select endeavors to share in this context"
            className="w-full"
            disabled={loading}
            selectionMode="checkbox"
            display="chip"
            filter
          />
          <small className="text-gray-600">
            Select which of your endeavors should be visible and editable by collaborators in this context.
          </small>
        </div>

        <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
          <div className="flex items-start">
            <i className="pi pi-info-circle text-blue-600 mr-2 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Context Isolation</p>
              <p className="mt-1">
                Work created by collaborators in this context will only appear here, not in your personal workspace.
                You can invite collaborators after creating the context.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default CreateContextModal
