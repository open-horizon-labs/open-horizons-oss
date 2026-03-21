'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from 'primereact/button'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Dialog } from 'primereact/dialog'
import { InputText } from 'primereact/inputtext'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'

interface ContextItem {
  id: string
  title: string
  description?: string
  created_at: string
}

interface ContextsManagerProps {
  userId: string
}

export function ContextsManager({ userId }: ContextsManagerProps) {
  const [contexts, setContexts] = useState<ContextItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingContext, setEditingContext] = useState<ContextItem | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const toast = useRef<Toast>(null)

  const fetchContexts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/contexts')
      const data = await response.json()
      setContexts(data.contexts || [])
    } catch (error) {
      console.error('Failed to load contexts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchContexts()
  }, [])

  const handleEdit = (context: ContextItem) => {
    setEditingContext(context)
    setEditTitle(context.title)
    setEditDescription(context.description || '')
  }

  const handleSaveEdit = async () => {
    if (!editingContext) return

    try {
      const response = await fetch(`/api/contexts/${encodeURIComponent(editingContext.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, description: editDescription })
      })

      if (response.ok) {
        toast.current?.show({ severity: 'success', summary: 'Context updated' })
        setEditingContext(null)
        fetchContexts()
      } else {
        const data = await response.json()
        toast.current?.show({ severity: 'error', summary: 'Error', detail: data.error })
      }
    } catch (error) {
      toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to update context' })
    }
  }

  const handleDelete = (context: ContextItem) => {
    confirmDialog({
      message: `Are you sure you want to delete "${context.title}"? This cannot be undone.`,
      header: 'Delete Context',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          const response = await fetch(`/api/contexts/${encodeURIComponent(context.id)}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            toast.current?.show({ severity: 'success', summary: 'Context deleted' })
            fetchContexts()
          } else {
            const data = await response.json()
            toast.current?.show({ severity: 'error', summary: 'Error', detail: data.error })
          }
        } catch (error) {
          toast.current?.show({ severity: 'error', summary: 'Error', detail: 'Failed to delete context' })
        }
      }
    })
  }

  const actionsTemplate = (rowData: ContextItem) => (
    <div className="flex gap-2">
      <Button
        icon="pi pi-pencil"
        severity="secondary"
        text
        size="small"
        tooltip="Rename"
        onClick={() => handleEdit(rowData)}
      />
      <Button
        icon="pi pi-trash"
        severity="danger"
        text
        size="small"
        tooltip="Delete"
        onClick={() => handleDelete(rowData)}
      />
    </div>
  )

  return (
    <>
      <Toast ref={toast} />
      <ConfirmDialog />

      <DataTable
        value={contexts}
        loading={loading}
        emptyMessage="No contexts found"
        className="p-datatable-sm"
      >
        <Column field="title" header="Title" sortable />
        <Column field="description" header="Description" />
        <Column
          field="created_at"
          header="Created"
          sortable
          body={(row) => new Date(row.created_at).toLocaleDateString()}
        />
        <Column header="Actions" body={actionsTemplate} style={{ width: '120px' }} />
      </DataTable>

      <Dialog
        header="Edit Context"
        visible={!!editingContext}
        onHide={() => setEditingContext(null)}
        style={{ width: '400px' }}
      >
        <div className="flex flex-col gap-4 mt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <InputText
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <InputText
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button label="Cancel" severity="secondary" onClick={() => setEditingContext(null)} />
            <Button label="Save" onClick={handleSaveEdit} />
          </div>
        </div>
      </Dialog>
    </>
  )
}
