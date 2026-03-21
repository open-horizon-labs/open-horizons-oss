'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { RadioButton } from 'primereact/radiobutton'
import { ContextNode } from '../../lib/contexts/context-operations'

interface MoveEndeavorModalProps {
  visible: boolean
  onHide: () => void
  endeavorId: string
  endeavorTitle: string
  currentContextId: string
  onMoved?: () => void
}

export function MoveEndeavorModal({
  visible,
  onHide,
  endeavorId,
  endeavorTitle,
  currentContextId,
  onMoved
}: MoveEndeavorModalProps) {
  const [contexts, setContexts] = useState<ContextNode[]>([])
  const [selectedContext, setSelectedContext] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingContexts, setLoadingContexts] = useState(true)

  const loadContexts = useCallback(async () => {
    setLoadingContexts(true)
    try {
      const response = await fetch('/api/contexts')
      if (response.ok) {
        const data = await response.json()
        const userContexts = data.contexts || []

        // Use actual contexts from API - no hardcoded personal context
        const availableContexts = userContexts.filter((context: ContextNode) => context.id !== currentContextId)

        setContexts(availableContexts)
      }
    } catch (error) {
      console.error('Failed to load contexts:', error)
      setError('Failed to load contexts')
    } finally {
      setLoadingContexts(false)
    }
  }, [currentContextId])

  // Load available contexts
  useEffect(() => {
    if (visible) {
      loadContexts()
      setSelectedContext('') // Reset selection
      setError(null)
    }
  }, [visible, loadContexts])

  const handleMove = async () => {
    if (!selectedContext) {
      setError('Please select a destination context')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavorId)}/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetContextId: selectedContext,
          moveSubgraph: false // For now, single endeavor moves only
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to move endeavor')
      }

      onMoved?.()
      onHide()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to move endeavor')
    } finally {
      setLoading(false)
    }
  }

  const getCurrentContextName = () => {
    const context = contexts.find(c => c.id === currentContextId)
    return context?.title || 'Current Context'
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
        label="Move Endeavor"
        onClick={handleMove}
        loading={loading}
        disabled={!selectedContext}
      />
    </div>
  )

  return (
    <Dialog
      header={`Move "${endeavorTitle}"`}
      visible={visible}
      onHide={onHide}
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
          This endeavor is currently in <strong>{getCurrentContextName()}</strong>.
          Select where you want to move it. The endeavor will disappear from its current location.
        </div>

        {loadingContexts ? (
          <div className="flex items-center gap-2 py-4">
            <i className="pi pi-spin pi-spinner" />
            <span>Loading contexts...</span>
          </div>
        ) : contexts.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <i className="pi pi-folder text-2xl mb-2 block" />
            <p>No other contexts available to move to.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contexts.map(context => (
              <div key={context.id} className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                <RadioButton
                  inputId={`context-${context.id}`}
                  name="targetContext"
                  value={context.id}
                  onChange={(e) => setSelectedContext(e.value)}
                  checked={selectedContext === context.id}
                  disabled={loading}
                />
                <label htmlFor={`context-${context.id}`} className="flex-1 cursor-pointer">
                  <div className="font-medium flex items-center gap-2">
                    <i className="pi pi-users text-green-600" />
                    {context.title}
                  </div>
                  {context.description && (
                    <div className="text-sm text-gray-600">{context.description}</div>
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    Shared context
                  </div>
                </label>
              </div>
            ))}
          </div>
        )}

        <div className="bg-amber-50 p-3 rounded border-l-4 border-amber-400">
          <div className="flex items-start">
            <i className="pi pi-exclamation-triangle text-amber-600 mr-2 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Move Operation</p>
              <p className="mt-1">
                Moving this endeavor will remove it from its current context and place it in the selected destination.
                This cannot be undone easily.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}

export default MoveEndeavorModal