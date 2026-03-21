'use client'

import { useState, useEffect } from 'react'
import { ContextNode } from '../../../lib/contexts/context-operations'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Tag } from 'primereact/tag'
import { Dialog } from 'primereact/dialog'
import { CreateContextModal } from '../../components/CreateContextModal'

interface ContextsFullSettingsProps {
  userId: string
}

export function ContextsFullSettings({ userId }: ContextsFullSettingsProps) {
  const [contexts, setContexts] = useState<ContextNode[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<{ visible: boolean; context: ContextNode | null }>({
    visible: false,
    context: null
  })

  const loadContexts = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/contexts')
      if (response.ok) {
        const data = await response.json()
        setContexts(data.contexts || [])
      }
    } catch (error) {
      console.error('Failed to load contexts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadContexts()
  }, [])

  const handleDeleteContext = async () => {
    if (!deleteDialog.context) return

    try {
      const response = await fetch(`/api/contexts/${deleteDialog.context.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadContexts()
        setDeleteDialog({ visible: false, context: null })
      }
    } catch (error) {
      console.error('Failed to delete context:', error)
    }
  }

  const titleTemplate = (rowData: ContextNode) => (
    <div>
      <div className="font-medium text-gray-900">{rowData.title}</div>
      {rowData.description && (
        <div className="text-sm text-gray-600 mt-1">{rowData.description}</div>
      )}
    </div>
  )

  const participantsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-users text-gray-500" />
      <span className="text-sm text-gray-600">Context</span>
    </div>
  )

  const endeavorsTemplate = (rowData: ContextNode) => (
    <div className="flex items-center gap-2">
      <i className="pi pi-folder text-gray-500" />
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

  const deleteDialogFooter = (
    <div className="flex justify-end gap-2">
      <Button
        label="Cancel"
        outlined
        onClick={() => setDeleteDialog({ visible: false, context: null })}
      />
      <Button
        label="Delete"
        severity="danger"
        onClick={handleDeleteContext}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Collaboration Contexts</h3>
        <p className="text-gray-600 mb-4">
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
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h4 className="text-md font-medium text-gray-900">Your Contexts ({contexts.length})</h4>
        <Button
          icon="pi pi-plus"
          label="New Context"
          onClick={() => setShowCreateModal(true)}
        />
      </div>

      {/* Contexts Table */}
      <div className="border rounded-lg">
        <DataTable
          value={contexts}
          loading={loading}
          emptyMessage={
            <div className="text-center py-8">
              <i className="pi pi-users text-gray-400 text-2xl mb-2 block" />
              <p className="text-gray-500 mb-4">No collaboration contexts yet</p>
              <Button
                label="Create your first context"
                onClick={() => setShowCreateModal(true)}
              />
            </div>
          }
          className="w-full"
        >
          <Column
            field="title"
            header="Context"
            body={titleTemplate}
            style={{ width: '35%' }}
          />
          <Column
            header="Participants"
            body={participantsTemplate}
            style={{ width: '25%' }}
          />
          <Column
            header="Shared Work"
            body={endeavorsTemplate}
            style={{ width: '25%' }}
          />
          <Column
            header="Actions"
            body={actionsTemplate}
            style={{ width: '15%' }}
          />
        </DataTable>
      </div>

      {/* Create Context Modal */}
      <CreateContextModal
        visible={showCreateModal}
        onHide={() => setShowCreateModal(false)}
        onContextCreated={() => loadContexts()}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        header="Delete Context"
        visible={deleteDialog.visible}
        onHide={() => setDeleteDialog({ visible: false, context: null })}
        footer={deleteDialogFooter}
        style={{ width: '400px' }}
        modal
      >
        <div className="flex items-start gap-3">
          <i className="pi pi-exclamation-triangle text-orange-500 text-xl mt-1" />
          <div>
            <p className="mb-2">
              Are you sure you want to delete <strong>{deleteDialog.context?.title}</strong>?
            </p>
            <p className="text-sm text-gray-600">
              This will remove the context and stop sharing all endeavors with participants.
              This action cannot be undone.
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

export default ContextsFullSettings