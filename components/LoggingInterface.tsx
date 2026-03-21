'use client'

import { useState, useEffect, useCallback } from 'react'
import { type LogEntry, type CreateLogRequest, type UpdateLogRequest, validateCreateLogRequest, validateUpdateLogRequest } from '../lib/contracts/logs-contract'
import { MarkdownEditor } from '../app/components/MarkdownEditor'

interface LoggingInterfaceProps {
  entityType: 'context' | 'endeavor'
  entityId: string
  entityDisplayName: string
  logDate: string
  userId: string
}

export function LoggingInterface({
  entityType,
  entityId,
  entityDisplayName,
  logDate,
  userId
}: LoggingInterfaceProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewEntryForm, setShowNewEntryForm] = useState(false)

  // Form state
  const [formData, setFormData] = useState<CreateLogRequest>({
    entity_type: entityType,
    entity_id: entityId,
    content: '',
    content_type: 'markdown',
    log_date: logDate
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  // Edit/Delete state
  const [editingLogId, setEditingLogId] = useState<string | null>(null)
  const [editFormData, setEditFormData] = useState<UpdateLogRequest>({})
  const [isEditing, setIsEditing] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Update form data when props change
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      entity_type: entityType,
      entity_id: entityId,
      log_date: logDate
    }))
  }, [entityType, entityId, logDate])

  // Extract fetchLogs as a standalone function for reuse
  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Build query parameters for the logs API
      const params = new URLSearchParams({
        log_date: logDate,
        entity_id: entityId
      })

      const response = await fetch(`/api/logs?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch logs: ${response.status}`)
      }

      const data = await response.json()

      if (data.success && data.logs) {
        setLogs(data.logs)

        // Default to editing the last entry from today if it exists
        if (data.logs.length > 0 && !showNewEntryForm) {
          const mostRecentLog = data.logs[0] // API should return sorted by created_at desc
          setEditingLogId(mostRecentLog.id)
          setEditFormData({
            content: mostRecentLog.content,
            content_type: mostRecentLog.content_type
          })
        }
      } else {
        setError('Invalid response format from logs API')
      }
    } catch (err) {
      console.error('Error fetching logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }, [logDate, entityId, showNewEntryForm])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  // Adapter function for MarkdownEditor
  async function handleMarkdownSave(markdownFormData: FormData) {
    try {
      setIsSubmitting(true)
      setFormError(null)
      setShowSuccessMessage(false)

      // Extract content from FormData and combine with existing form state
      const content = markdownFormData.get('body') as string || ''

      const createLogData: CreateLogRequest = {
        entity_type: formData.entity_type,
        entity_id: formData.entity_id,
        content,
        content_type: 'markdown', // Always markdown
        log_date: formData.log_date
      }

      // Validate form data using contract
      const validatedData = validateCreateLogRequest(createLogData)

      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to create log: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Clear form content but preserve other state
        setFormData(prev => ({
          ...prev,
          content: ''
        }))

        // Show success message
        setShowSuccessMessage(true)
        setTimeout(() => setShowSuccessMessage(false), 3000)

        // Refresh logs list
        fetchLogs()
        // Hide the new entry form after successful creation
        setShowNewEntryForm(false)
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      console.error('Error creating log:', err)
      setFormError(err instanceof Error ? err.message : 'Failed to create log')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Edit handlers using MarkdownEditor
  async function handleEditSave(markdownFormData: FormData) {
    if (!editingLogId) return

    try {
      setIsEditing(true)
      setEditError(null)

      const content = markdownFormData.get('body') as string || ''

      const updateData: UpdateLogRequest = {
        content,
        content_type: 'markdown' // Always markdown
      }

      // Validate edit form data using contract
      const validatedData = validateUpdateLogRequest(updateData)

      const response = await fetch(`/api/logs/${editingLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validatedData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to update log: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Update the log in the local state
        setLogs(prev => prev.map(log =>
          log.id === editingLogId ? result.log : log
        ))

        // Stay in edit mode after autosave - don't exit
        // User can manually exit by clicking Cancel or New Entry
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      console.error('Error updating log:', err)
      setEditError(err instanceof Error ? err.message : 'Failed to update log')
    } finally {
      setIsEditing(false)
    }
  }

  function startEdit(log: LogEntry) {
    setEditingLogId(log.id)
    setEditFormData({
      content: log.content,
      content_type: log.content_type
    })
    setEditError(null)
  }

  function cancelEdit() {
    setEditingLogId(null)
    setEditFormData({})
    setEditError(null)
  }

  // Delete handlers
  function confirmDelete(logId: string) {
    setShowDeleteConfirm(logId)
  }

  function cancelDelete() {
    setShowDeleteConfirm(null)
  }

  async function handleDelete(logId: string) {
    try {
      setDeletingLogId(logId)
      setShowDeleteConfirm(null)

      const response = await fetch(`/api/logs/${logId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to delete log: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        // Remove the log from local state
        setLogs(prev => prev.filter(log => log.id !== logId))

        // If we were editing this log, exit edit mode
        if (editingLogId === logId) {
          setEditingLogId(null)
          setEditFormData({})
        }
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      console.error('Error deleting log:', err)
      setEditError(err instanceof Error ? err.message : 'Failed to delete log')
    } finally {
      setDeletingLogId(null)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500">Loading logs...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 className="text-lg font-medium text-red-800 mb-2">Error Loading Logs</h2>
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Log Creation Form */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Log Entry</h2>
          {logs.length > 0 && (
            <button
              onClick={() => {
                if (editingLogId) {
                  // Exit edit mode and show new entry form
                  setEditingLogId(null)
                  setEditFormData({})
                  setShowNewEntryForm(true)
                } else {
                  // Normal new entry behavior
                  setShowNewEntryForm(true)
                }
              }}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              ➕ New Entry
            </button>
          )}
        </div>

        {/* Success Message */}
        {showSuccessMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
            ✅ Log entry saved successfully!
          </div>
        )}

        {/* Form Error */}
        {formError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            ❌ {formError}
          </div>
        )}

        {/* Edit Error */}
        {editError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
            ❌ {editError}
          </div>
        )}

        {(logs.length === 0 || showNewEntryForm) && (
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm transition-all duration-300 ease-in-out">
            {/* Context info display */}
            <div className="p-6 border-b">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-800">
                  <span className="font-medium">📍 Logging to:</span> {entityDisplayName}
                </div>
              </div>
              {showNewEntryForm && (
                <div className="mt-3 transform transition-all duration-200 ease-in-out">
                  <button
                    onClick={() => setShowNewEntryForm(false)}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors duration-150"
                  >
                    ← Back to logs
                  </button>
                </div>
              )}
            </div>

            {/* MarkdownEditor for Content */}
            <div className="transform transition-all duration-300 ease-in-out">
              <MarkdownEditor
                initialBody={formData.content}
                onSaveServerAction={handleMarkdownSave}
                title="Log Content"
                placeholder="Enter your log content here..."
                height="400px"
                variant="full"
              />
            </div>
          </div>
        )}
      </section>

      {logs.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900">
            Today&apos;s Logs ({logs.length})
          </h2>
          {logs.map((log) => (
            <div key={log.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {log.entity_type === 'context' ? '🏗️ Context' : '🎯 Endeavor'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {entityDisplayName}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-gray-500">
                    {new Date(log.created_at).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                  {/* Action Buttons */}
                  {editingLogId !== log.id && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(log)}
                        className="px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                        title="Edit log"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => confirmDelete(log.id)}
                        disabled={deletingLogId === log.id}
                        className="px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Delete log"
                      >
                        {deletingLogId === log.id ? '⏳' : '🗑️ Delete'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Display or Edit Form */}
              {editingLogId === log.id ? (
                /* MarkdownEditor for editing */
                <div className="space-y-4 transform transition-all duration-300 ease-in-out">
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      onClick={cancelEdit}
                      disabled={isEditing}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50 transition-colors duration-150"
                    >
                      Done
                    </button>
                  </div>

                  <div className="transform transition-all duration-300 ease-in-out">
                    <MarkdownEditor
                      initialBody={editFormData.content || ''}
                      onSaveServerAction={handleEditSave}
                      title="Edit Log Content"
                      placeholder="Enter your log content here..."
                      height="400px"
                      variant="full"
                    />
                  </div>
                </div>
              ) : (
                /* Normal Content Display */
                <div className="prose prose-sm max-w-none transform transition-all duration-300 ease-in-out">
                  <div className="whitespace-pre-wrap text-gray-700">
                    {log.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <div className="text-gray-400 mb-3">
            📝
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            No logs for this date
          </h2>
          <p className="text-gray-600 mb-4">
            No logs found for this date in {entityDisplayName}.
          </p>
          <div className="text-sm text-gray-500">
            Create your first log entry to get started!
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              🗑️ Delete Log Entry
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this log entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}