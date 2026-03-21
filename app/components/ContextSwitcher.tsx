'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dropdown } from 'primereact/dropdown'
import { Badge } from 'primereact/badge'
import { Button } from 'primereact/button'
import { GraphNode } from '../../lib/graph/types'
import { ContextNode } from '../../lib/contexts/context-operations'
import { CreateContextModal } from './CreateContextModal'
import { updateContext, isPersonalContext } from '../../lib/contracts/context-contract'

interface ContextSwitcherProps {
  currentUserId: string
  onContextChange?: (contextId: string | null) => void
}

export function ContextSwitcher({ currentUserId, onContextChange }: ContextSwitcherProps) {
  const router = useRouter()
  const [contexts, setContexts] = useState<ContextNode[]>([])
  const [selectedContext, setSelectedContext] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [availableEndeavors, setAvailableEndeavors] = useState<GraphNode[]>([])
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameContextId, setRenameContextId] = useState<string | null>(null)
  const [renameTitle, setRenameTitle] = useState('')
  const [renameDescription, setRenameDescription] = useState('')
  const [renameLoading, setRenameLoading] = useState(false)

  // Load user contexts and endeavors
  useEffect(() => {
    async function loadData() {
      try {
        console.log('🔄 ContextSwitcher - Loading contexts and endeavors')
        const [contextsResponse, endeavorsResponse] = await Promise.all([
          fetch('/api/contexts'),
          fetch('/api/endeavors/personal') // Load all personal endeavors, not filtered by context
        ])

        let contextsData: any = null
        if (contextsResponse.ok) {
          contextsData = await contextsResponse.json()
          console.log('🔄 ContextSwitcher - Contexts loaded:', contextsData.contexts?.length || 0, contextsData.contexts)
          setContexts(contextsData.contexts || [])
        } else {
          console.error('🔄 ContextSwitcher - Failed to load contexts:', contextsResponse.status)
        }

        if (endeavorsResponse.ok) {
          const data = await endeavorsResponse.json()
          setAvailableEndeavors(data.nodes || [])
        }

        // Load the saved context from localStorage
        const savedContextId = localStorage.getItem('selectedContextId')
        let contextToSet = savedContextId && savedContextId !== 'null' ? savedContextId : null

        // If no context is selected, default to personal context if available
        if (!contextToSet && contextsData?.contexts && contextsData.contexts.length > 0) {
          const personalContext = contextsData.contexts.find((ctx: any) => ctx.id.startsWith('personal:'))
          if (personalContext) {
            contextToSet = personalContext.id
            localStorage.setItem('selectedContextId', personalContext.id)
            console.log('🔄 ContextSwitcher - Auto-selected personal context:', personalContext.id)
          }
        }

        setSelectedContext(contextToSet)
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Context options for dropdown - ONLY real, database-backed contexts
  const contextOptions = contexts.map(context => ({
    label: context.title,
    value: context.id,
    icon: 'pi pi-users'
  }))

  // Find the selected context option object for PrimeReact
  const selectedContextOption = contextOptions.find(option => option.value === selectedContext) || null

  const handleContextChange = (value: string | null) => {
    setSelectedContext(value)
    onContextChange?.(value)

    // Save to localStorage to persist across all pages
    const localStorageValue = value || 'null'
    localStorage.setItem('selectedContextId', localStorageValue)

    // Fire context change event to notify ContextAwareDataProvider
    const event = new CustomEvent('contextChanged', {
      detail: { contextId: value }
    })
    window.dispatchEvent(event)

    // Navigate to current page with context parameter to ensure URL reflects context
    const currentPath = window.location.pathname
    if (value) {
      router.push(`${currentPath}?context=${value}`)
    } else {
      router.push(currentPath)
    }
  }

  const handleContextCreated = async (contextId: string) => {
    // Reload contexts to include the new one
    try {
      const response = await fetch('/api/contexts')
      if (response.ok) {
        const data = await response.json()
        setContexts(data.contexts || [])
        // Auto-select the new context
        setSelectedContext(contextId)
        // Save to localStorage
        localStorage.setItem('selectedContextId', contextId)
        onContextChange?.(contextId)

        // Navigate to current page with new context parameter
        const currentPath = window.location.pathname
        router.push(`${currentPath}?context=${contextId}`)
      }
    } catch (error) {
      console.error('Failed to reload contexts:', error)
    }
  }

  const handleRenameContext = (contextId: string) => {
    const context = contexts.find(ctx => ctx.id === contextId)
    if (!context) return

    setRenameContextId(contextId)
    setRenameTitle(context.title)
    setRenameDescription('') // Description not shown in ContextSwitcher, but we can let users add it
    setShowRenameModal(true)
  }

  const handleRenameSubmit = async () => {
    if (!renameContextId || !renameTitle.trim()) return

    setRenameLoading(true)
    try {
      await updateContext(renameContextId, {
        title: renameTitle.trim(),
        description: renameDescription.trim() || undefined
      })

      // Reload contexts to reflect the rename
      const response = await fetch('/api/contexts')
      if (response.ok) {
        const data = await response.json()
        setContexts(data.contexts || [])
      }

      setShowRenameModal(false)
      setRenameContextId(null)
      setRenameTitle('')
      setRenameDescription('')

    } catch (error) {
      console.error('Failed to rename context:', error)
      alert('Failed to rename context: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDeleteContext = async (contextId: string) => {
    if (!confirm('Are you sure you want to delete this context? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/contexts/${contextId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        // Reload contexts to remove the deleted one
        const contextsResponse = await fetch('/api/contexts')
        if (contextsResponse.ok) {
          const data = await contextsResponse.json()
          setContexts(data.contexts || [])

          // If we deleted the selected context, switch to first available context
          if (selectedContext === contextId) {
            const newContexts = data.contexts || []
            const firstContext = newContexts[0]
            const newSelection = firstContext ? firstContext.id : null
            setSelectedContext(newSelection)
            onContextChange?.(newSelection)
          }
        }
      } else {
        const error = await response.json()
        alert(`Failed to delete context: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to delete context:', error)
      alert('Failed to delete context')
    }
  }

  // Template for dropdown items
  const contextItemTemplate = (option: any) => (
    <div className="flex items-center gap-2">
      <i className={`${option.icon} text-sm`} />
      <span>{option.label}</span>
      {option.badge && (
        <Badge value={option.badge} severity="info" />
      )}
    </div>
  )

  // Template for selected value
  const contextValueTemplate = (option: any) => {
    if (!option) {
      return (
        <span className="text-gray-500">No context selected</span>
      )
    }

    return (
      <div className="flex items-center gap-2">
        <i className={`${option.icon} text-sm`} />
        <span>{option.label}</span>
        {option.badge && (
          <Badge value={option.badge} severity="info" />
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <i className="pi pi-spin pi-spinner" />
        <span>Loading contexts...</span>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Dropdown
          value={selectedContext}
          options={contextOptions}
          onChange={(e) => {
            // PrimeReact passes the value directly from the option object
            const contextId = e.value || null
            handleContextChange(contextId)
          }}
          itemTemplate={contextItemTemplate}
          valueTemplate={contextValueTemplate}
          className="w-48"
          placeholder="Select context"
          showClear={false}
          optionLabel="label"
          optionValue="value"
        />
        <Button
          icon="pi pi-plus"
          size="small"
          text
          severity="secondary"
          tooltip="Create new context"
          tooltipOptions={{ position: 'bottom' }}
          onClick={() => setShowCreateModal(true)}
        />
        {selectedContext && (
          <>
            <Button
              icon="pi pi-pencil"
              size="small"
              text
              severity="secondary"
              tooltip="Rename context"
              tooltipOptions={{ position: 'bottom' }}
              onClick={() => handleRenameContext(selectedContext)}
            />
            {!isPersonalContext(selectedContext) && (
              <Button
                icon="pi pi-trash"
                size="small"
                text
                severity="danger"
                tooltip="Delete context"
                tooltipOptions={{ position: 'bottom' }}
                onClick={() => handleDeleteContext(selectedContext)}
              />
            )}
          </>
        )}
      </div>

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

      {/* Rename Context Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <i className="pi pi-pencil" />
                  Rename Context
                </h2>
                <button
                  onClick={() => {
                    setShowRenameModal(false)
                    setRenameContextId(null)
                    setRenameTitle('')
                    setRenameDescription('')
                  }}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={renameLoading}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Context Name *
                  </label>
                  <input
                    type="text"
                    value={renameTitle}
                    onChange={(e) => setRenameTitle(e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter context name..."
                    autoFocus
                    disabled={renameLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={renameDescription}
                    onChange={(e) => setRenameDescription(e.target.value)}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter description (optional)..."
                    rows={3}
                    disabled={renameLoading}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleRenameSubmit}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-medium disabled:opacity-50"
                    disabled={!renameTitle.trim() || renameLoading}
                  >
                    {renameLoading ? 'Renaming...' : 'Rename Context'}
                  </button>
                  <button
                    onClick={() => {
                      setShowRenameModal(false)
                      setRenameContextId(null)
                      setRenameTitle('')
                      setRenameDescription('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                    disabled={renameLoading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ContextSwitcher