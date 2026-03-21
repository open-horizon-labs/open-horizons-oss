'use client'

import { useState, useCallback } from 'react'
import { GraphNode } from '../../lib/graph/types'
import { getRoleIcon } from '../../lib/constants/icons'
import Link from 'next/link'

interface ArchivedEndeavorsClientProps {
  archivedNodes: GraphNode[]
  userId: string
}

export function ArchivedEndeavorsClient({ archivedNodes, userId }: ArchivedEndeavorsClientProps) {
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('')
  const [sortBy, setSortBy] = useState<'archived_date' | 'created_date' | 'title'>('archived_date')

  // Filter and sort nodes
  const filteredNodes = archivedNodes
    .filter(node => {
      if (!filter) return true
      const searchTerm = filter.toLowerCase()
      return (
        node.title?.toLowerCase().includes(searchTerm) ||
        node.description?.toLowerCase().includes(searchTerm) ||
        node.archivedReason?.toLowerCase().includes(searchTerm) ||
        node.node_type.toLowerCase().includes(searchTerm)
      )
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'archived_date':
          return new Date(b.archived_at || '').getTime() - new Date(a.archived_at || '').getTime()
        case 'created_date':
          return new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        case 'title':
          return (a.title || a.id).localeCompare(b.title || b.id)
        default:
          return 0
      }
    })

  const handleUnarchive = useCallback(async (nodeId: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(nodeId)}/archive`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to unarchive endeavor')
      }

      // Refresh page to show updated state
      window.location.reload()
    } catch (error) {
      console.error('Failed to unarchive endeavor:', error)
      alert('Failed to unarchive endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search archived endeavors..."
            className="px-3 py-2 border rounded-lg text-sm w-64"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="archived_date">Sort by Archive Date</option>
            <option value="created_date">Sort by Created Date</option>
            <option value="title">Sort by Title</option>
          </select>
        </div>

        <Link
          href="/dashboard"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Archived Endeavors List */}
      {filteredNodes.length === 0 ? (
        <div className="text-center py-12">
          {filter ? (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No matching archived endeavors</h3>
              <p className="text-gray-500 mb-4">Try adjusting your search criteria.</p>
              <button
                onClick={() => setFilter('')}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                Clear Search
              </button>
            </div>
          ) : (
            <div>
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No archived endeavors</h3>
              <p className="text-gray-500">Archived endeavors will appear here when you archive them.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNodes.map(node => (
            <div key={node.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{getRoleIcon(node.node_type)}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Link
                          href={`/artifacts/${encodeURIComponent(node.id)}`}
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {node.title || node.id}
                        </Link>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                          {node.node_type}
                        </span>
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                          🗃️ Archived
                        </span>
                      </div>
                      
                      {node.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {node.description}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Created: {new Date(node.created_at || '').toLocaleDateString()}</span>
                        <span>Archived: {new Date(node.archived_at || '').toLocaleDateString()}</span>
                        {node.archivedReason && (
                          <span>Reason: {node.archivedReason}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => handleUnarchive(node.id)}
                  disabled={loading}
                  className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-800 rounded text-sm disabled:opacity-50"
                >
                  {loading ? 'Unarchiving...' : 'Unarchive'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>Updating endeavor...</span>
          </div>
        </div>
      )}
    </div>
  )
}