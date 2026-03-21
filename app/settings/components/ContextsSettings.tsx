'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Badge } from 'primereact/badge'
import { Message } from 'primereact/message'
import { ContextNode } from '../../../lib/contexts/context-operations'
import { CreateContextModal } from '../../components/CreateContextModal'

export function ContextsSettings() {
  const router = useRouter()
  const [contexts, setContexts] = useState<ContextNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [availableEndeavors, setAvailableEndeavors] = useState<any[]>([])
  const [deleteDialog, setDeleteDialog] = useState<{ visible: boolean; context: ContextNode | null }>({
    visible: false,
    context: null
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [contextsResponse, endeavorsResponse] = await Promise.all([
        fetch('/api/contexts'),
        fetch('/api/endeavors/personal')
      ])

      if (contextsResponse.ok) {
        const data = await contextsResponse.json()
        setContexts(data.contexts || [])
      }

      if (endeavorsResponse.ok) {
        const data = await endeavorsResponse.json()
        setAvailableEndeavors(data.nodes || [])
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteContext = async (context: ContextNode) => {
    try {
      const response = await fetch(`/api/contexts/${context.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadData() // Refresh the list
        setDeleteDialog({ visible: false, context: null })
      } else {
        const error = await response.json()
        alert(`Failed to delete context: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete context:', error)
      alert('Failed to delete context')
    }
  }

  const handleContextCreated = () => {
    loadData() // Refresh the list
    setShowCreateModal(false)
  }

  // Column renderers
  const titleTemplate = (rowData: ContextNode) => (
    <div>
      <div className="font-medium">{rowData.title}</div>
      {rowData.description && (
        <div className="text-sm text-gray-600 mt-1">{rowData.description}</div>
      )}
    </div>
  )

  const participantsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-users text-gray-500 text-sm" />
    </div>
  )

  const endeavorsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-folder text-gray-500 text-sm" />
    </div>
  )

  const actionsTemplate = (rowData: ContextNode) => (
    <div className="flex gap-1">
      <Button
        icon="pi pi-eye"
        size="small"
        text
        severity="secondary"
        tooltip="Switch to context"
        tooltipOptions={{ position: 'top' }}
        onClick={() => {
          // Save the context to localStorage
          localStorage.setItem('selectedContextId', rowData.id)
          // Navigate to dashboard - it will load with the new context
          router.push('/dashboard')
        }}
      />
      <Button
        icon="pi pi-trash"
        size="small"
        text
        severity="danger"
        tooltip="Delete context"
        tooltipOptions={{ position: 'top' }}
        onClick={() => setDeleteDialog({ visible: true, context: rowData })}
      />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4">
        <i className="pi pi-spin pi-spinner" />
        <span>Loading contexts...</span>
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="mb-4">
        <h3 className="font-medium text-gray-900 mb-1">Collaboration Contexts</h3>
        <p className="text-sm text-gray-600 mb-2">
          Contexts are collaboration spaces where you can share specific endeavors with others.
          Each context isolates shared work from your personal workspace.
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm mb-4">
          <div className="flex items-start gap-2">
            <i className="pi pi-info-circle text-blue-600 mt-0.5" />
            <div className="text-blue-800">
              <p className="font-medium">How contexts work:</p>
              <ul className="mt-1 space-y-1 text-blue-700">
                <li>• <strong>Personal:</strong> Shows all your endeavors (default view)</li>
                <li>• <strong>Shared contexts:</strong> Show only endeavors you&apos;ve shared in that space</li>
                <li>• <strong>Collaboration:</strong> Team members can only see shared endeavors, not your personal work</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-3">
            For full context management, go to the <strong>Contexts</strong> tab above.
          </p>
          <Button
            icon="pi pi-plus"
            label="Quick Create Context"
            size="small"
            onClick={() => setShowCreateModal(true)}
          />
        </div>
      </div>

      {contexts.length === 0 ? (
        <div className="bg-gray-50 rounded p-4 text-center">
          <i className="pi pi-users text-gray-400 text-2xl mb-2 block" />
          <p className="text-gray-500 text-sm">No collaboration contexts yet</p>
          <Button
            label="Create your first context"
            text
            size="small"
            onClick={() => setShowCreateModal(true)}
            className="mt-2"
          />
        </div>
      ) : (
        <DataTable
          value={contexts}
          dataKey="id"
          emptyMessage="No contexts found"
          className="p-datatable-sm"
          size="small"
        >
          <Column
            field="title"
            header="Context"
            body={titleTemplate}
            style={{ width: '40%' }}
          />
          <Column
            header="Members"
            body={participantsTemplate}
            style={{ width: '20%' }}
          />
          <Column
            header="Shared"
            body={endeavorsTemplate}
            style={{ width: '20%' }}
          />
          <Column
            header="Actions"
            body={actionsTemplate}
            style={{ width: '20%' }}
          />
        </DataTable>
      )}

      {/* Create Context Modal */}
      <CreateContextModal
        visible={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onContextCreated={handleContextCreated}
        availableEndeavors={availableEndeavors.map(e => ({
          id: e.id,
          title: e.title || 'Untitled',
          node_type: e.node_type,
          parent_id: e.parent_id
        }))}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        header="Delete Context"
        visible={deleteDialog.visible}
        onHide={() => setDeleteDialog({ visible: false, context: null })}
        footer={
          <div className="flex gap-2 justify-end">
            <Button
              label="Cancel"
              severity="secondary"
              outlined
              onClick={() => setDeleteDialog({ visible: false, context: null })}
            />
            <Button
              label="Delete"
              severity="danger"
              onClick={() => deleteDialog.context && handleDeleteContext(deleteDialog.context)}
            />
          </div>
        }
        style={{ width: '450px' }}
      >
        <div className="flex items-start gap-3">
          <i className="pi pi-exclamation-triangle text-orange-500 text-xl mt-1" />
          <div>
            <p>
              Are you sure you want to delete the context <strong>&quot;{deleteDialog.context?.title}&quot;</strong>?
            </p>
            <p className="text-sm text-gray-600 mt-2">
              This action cannot be undone. All shared endeavors will return to your personal workspace.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default ContextsSettings