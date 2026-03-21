'use client'

import { useState } from 'react'

interface DangerZoneProps {
  userId: string
}

export function DangerZone({ userId }: DangerZoneProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string>()

  const REQUIRED_TEXT = 'YES I AM SURE'

  const handleDeleteAll = async () => {
    if (confirmText !== REQUIRED_TEXT) {
      setError(`You must type "${REQUIRED_TEXT}" exactly`)
      return
    }

    setIsDeleting(true)
    setError(undefined)

    try {
      const response = await fetch('/api/user/delete-all-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirmText })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete data')
      }

      // Redirect to dashboard after successful deletion
      window.location.href = '/dashboard?deleted=true'

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    setShowConfirmDialog(false)
    setConfirmText('')
    setError(undefined)
  }

  if (showConfirmDialog) {
    return (
      <div className="border-2 border-red-200 rounded-lg p-6 bg-red-50">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-red-900 mb-2">
            ⚠️ DANGER: Delete All Data
          </h3>
          <p className="text-red-800 text-sm mb-4">
            This will permanently delete <strong>ALL</strong> of your data including:
          </p>
          <ul className="text-red-800 text-sm space-y-1 mb-4 ml-4">
            <li>• All endeavors (missions, aims, initiatives)</li>
            <li>• All daily logs and notes</li>
            <li>• All role assertions and relationships</li>
            <li>• All artifacts and legacy data</li>
            <li>• Import history and provenance</li>
          </ul>
          <p className="text-red-900 font-bold text-sm mb-4">
            This action cannot be undone. There is no backup or recovery.
          </p>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-300 rounded p-3 mb-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-red-900 mb-2">
              Type &quot;{REQUIRED_TEXT}&quot; to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              placeholder={REQUIRED_TEXT}
              disabled={isDeleting}
            />
          </div>

          <div className="flex justify-between">
            <button
              onClick={handleCancel}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
            
            <button
              onClick={handleDeleteAll}
              disabled={isDeleting || confirmText !== REQUIRED_TEXT}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Deleting...</span>
                </>
              ) : (
                <>
                  <span>💀</span>
                  <span>DELETE ALL DATA</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-red-200 rounded-lg p-4 bg-red-50">
      <h3 className="font-medium text-red-900 mb-2">🚨 Danger Zone</h3>
      <p className="text-sm text-red-700 mb-4">
        Irreversible actions that will permanently delete your data.
      </p>
      
      <div className="bg-white border border-red-200 rounded p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-red-900">Delete All Data</h4>
            <p className="text-sm text-red-600">
              Permanently delete all endeavors, daily logs, and associated data. This cannot be undone.
            </p>
          </div>
          
          <button
            onClick={() => setShowConfirmDialog(true)}
            className="ml-4 px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  )
}