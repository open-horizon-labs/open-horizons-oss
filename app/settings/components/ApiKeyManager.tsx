'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Dialog } from 'primereact/dialog'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { Toast } from 'primereact/toast'
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  revokedAt?: string
  revokedReason?: string
}

interface ApiKeyManagerProps {
  userId: string
}

export function ApiKeyManager({ userId }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creatingKey, setCreatingKey] = useState(false)
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null)
  const toast = useRef<Toast>(null)

  useEffect(() => {
    loadApiKeys()
  }, [])

  const loadApiKeys = async () => {
    try {
      const response = await fetch('/api/api-keys')
      if (response.ok) {
        const data = await response.json()
        setKeys(data.keys || [])
      }
    } catch (error) {
      console.error('Failed to load API keys:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load API keys'
      })
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    const trimmedName = newKeyName.trim()
    if (!trimmedName) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Please enter a name for the API key'
      })
      return
    }

    if (trimmedName.length > 100) {
      toast.current?.show({
        severity: 'warn',
        summary: 'Validation Error',
        detail: 'Name must be 100 characters or less'
      })
      return
    }

    setCreatingKey(true)
    try {
      const response = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          scopes: ['read'] // Default scope
        })
      })

      const result = await response.json()
      if (response.ok) {
        setNewlyCreatedKey(result.key)
        setKeys(prev => [...prev, result.apiKey])
        setNewKeyName('')
        toast.current?.show({
          severity: 'success',
          summary: 'API Key Created',
          detail: `"${trimmedName}" created successfully`
        })
      } else {
        toast.current?.show({
          severity: 'error',
          summary: 'Creation Failed',
          detail: result.error || 'Failed to create API key'
        })
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Network Error',
        detail: 'Failed to create API key. Please try again.'
      })
    } finally {
      setCreatingKey(false)
    }
  }

  const revokeApiKey = (keyId: string, keyName: string) => {
    confirmDialog({
      message: `Are you sure you want to revoke "${keyName}"? This action cannot be undone and will immediately invalidate the key.`,
      header: 'Revoke API Key',
      icon: 'pi pi-exclamation-triangle',
      acceptClassName: 'p-button-danger',
      accept: async () => {
        try {
          const response = await fetch(`/api/api-keys/${keyId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: 'Revoked via settings'
            })
          })

          if (response.ok) {
            // Update the key in the list to show it's revoked
            setKeys(prev => prev.map(key =>
              key.id === keyId
                ? { ...key, revokedAt: new Date().toISOString(), revokedReason: 'Revoked via settings' }
                : key
            ))
            toast.current?.show({
              severity: 'success',
              summary: 'Key Revoked',
              detail: `"${keyName}" has been revoked successfully`
            })
          } else {
            const result = await response.json()
            toast.current?.show({
              severity: 'error',
              summary: 'Revocation Failed',
              detail: result.error || 'Failed to revoke API key'
            })
          }
        } catch (error) {
          console.error('Failed to revoke API key:', error)
          toast.current?.show({
            severity: 'error',
            summary: 'Network Error',
            detail: 'Failed to revoke API key. Please try again.'
          })
        }
      }
    })
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.current?.show({
        severity: 'success',
        summary: 'Copied',
        detail: 'API key copied to clipboard'
      })
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy to clipboard'
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const statusTemplate = (rowData: ApiKey) => {
    if (rowData.revokedAt) {
      return (
        <div className="text-red-600 text-sm">
          <div>Revoked</div>
          {rowData.revokedReason && (
            <div className="text-xs text-gray-500 mt-1">{rowData.revokedReason}</div>
          )}
        </div>
      )
    }
    return <span className="text-green-600 text-sm font-medium">Active</span>
  }

  const actionsTemplate = (rowData: ApiKey) => {
    if (rowData.revokedAt) {
      return null
    }

    return (
      <Button
        icon="pi pi-trash"
        className="p-button-text p-button-danger p-button-sm"
        onClick={() => revokeApiKey(rowData.id, rowData.name)}
        tooltip="Revoke API key"
      />
    )
  }

  return (
    <div>
      <Toast ref={toast} />
      <ConfirmDialog />

      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-medium text-gray-900 mb-1">API Keys</h3>
          <p className="text-sm text-gray-600">
            Create and manage API keys for programmatic access.
          </p>
        </div>
        <Button
          label="Create API Key"
          icon="pi pi-plus"
          onClick={() => setShowCreateDialog(true)}
          className="p-button-sm"
        />
      </div>

      <DataTable
        value={keys}
        loading={loading}
        emptyMessage="No API keys found"
        className="text-sm"
      >
        <Column field="name" header="Name" />
        <Column
          field="keyPrefix"
          header="Key"
          body={(rowData) => `${rowData.keyPrefix}...`}
        />
        <Column
          field="createdAt"
          header="Created"
          body={(rowData) => formatDate(rowData.createdAt)}
        />
        <Column
          field="lastUsedAt"
          header="Last Used"
          body={(rowData) => rowData.lastUsedAt ? formatDate(rowData.lastUsedAt) : 'Never'}
        />
        <Column
          header="Status"
          body={statusTemplate}
        />
        <Column
          header="Actions"
          body={actionsTemplate}
          style={{ width: '8rem', textAlign: 'center' }}
        />
      </DataTable>

      {/* Create API Key Dialog */}
      <Dialog
        visible={showCreateDialog}
        onHide={() => {
          setShowCreateDialog(false)
          setNewKeyName('')
          setNewlyCreatedKey(null)
        }}
        header="Create API Key"
        className="w-96"
      >
        {!newlyCreatedKey ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Key Name
              </label>
              <InputText
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., My Integration Key"
                className="w-full"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                label="Cancel"
                className="p-button-text"
                onClick={() => setShowCreateDialog(false)}
              />
              <Button
                label="Create Key"
                loading={creatingKey}
                onClick={createApiKey}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <div className="flex items-center mb-2">
                <i className="pi pi-exclamation-triangle text-yellow-600 mr-2" />
                <span className="font-medium text-yellow-800">Important!</span>
              </div>
              <p className="text-sm text-yellow-700">
                Save this API key now. You won&apos;t be able to see it again.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your API Key
              </label>
              <div className="flex">
                <InputText
                  value={newlyCreatedKey}
                  readOnly
                  className="flex-1 font-mono text-sm"
                />
                <Button
                  icon="pi pi-copy"
                  className="p-button-text ml-2"
                  onClick={() => copyToClipboard(newlyCreatedKey)}
                  tooltip="Copy to clipboard"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                label="Done"
                onClick={() => {
                  setShowCreateDialog(false)
                  setNewlyCreatedKey(null)
                }}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}