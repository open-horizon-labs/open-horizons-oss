'use client'

import { useState, useEffect } from 'react'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Badge } from 'primereact/badge'
import { Message } from 'primereact/message'
import { ContextNode } from '../../lib/contexts/context-operations'
import { CreateContextModal } from './CreateContextModal'

export function ContextsPageClient() {
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
      <i className="pi pi-users text-gray-500" />
      <Badge value={1} severity="info" />
      <span className="text-sm text-gray-600">
        owner
      </span>
    </div>
  )

  const endeavorsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-folder text-gray-500" />
      <Badge value={0} severity="secondary" />
      <span className="text-sm text-gray-600">shared endeavors</span>
    </div>
  )

  const actionsTemplate = (rowData: ContextNode) => (
    <div className="flex gap-2">
      <Button
        icon="pi pi-cog"
        size="small"
        text
        severity="secondary"
        tooltip="Context settings"
        onClick={() => window.location.href = `/contexts/${rowData.id}`}
      />
      <Button
        icon="pi pi-eye"
        size="small"
        text
        severity="secondary"
        tooltip="Switch to context"
        onClick={() => {
          // Emit context change event
          const event = new CustomEvent('contextChanged', {
            detail: { contextId: rowData.id }
          })
          window.dispatchEvent(event)
          // Navigate to dashboard
          window.location.href = '/dashboard'
        }}
      />
      <Button
        icon="pi pi-trash"
        size="small"
        text
        severity="danger"
        tooltip="Delete context"
        onClick={() => setDeleteDialog({ visible: true, context: rowData })}
      />
    </div>
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <i className="pi pi-spin pi-spinner" />
          <span>Loading contexts...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collaboration Contexts</h1>
          <p className="text-gray-600 mt-1">
            Manage your collaboration spaces and shared endeavors
          </p>
        </div>
        <Button
          icon="pi pi-plus"
          label="New Context"
          onClick={() => setShowCreateModal(true)}
        />
      </div>

      {contexts.length === 0 ? (
        <Message
          severity="info"
          text="No collaboration contexts yet. Create your first context to start collaborating!"
          className="w-full"
        />
      ) : (
        <DataTable
          value={contexts}
          paginator
          rows={10}
          dataKey="id"
          emptyMessage="No contexts found"
          className="p-datatable-sm"
        >
          <Column
            field="title"
            header="Context"
            body={titleTemplate}
            style={{ width: '30%' }}
          />
          <Column
            header="Participants"
            body={participantsTemplate}
            style={{ width: '25%' }}
          />
          <Column
            header="Shared Content"
            body={endeavorsTemplate}
            style={{ width: '25%' }}
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
          <div className="flex gap-2">
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

export default ContextsPageClient