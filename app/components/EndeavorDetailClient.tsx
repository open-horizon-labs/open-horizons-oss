'use client'

import { useState, useCallback } from 'react'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownEditor } from './MarkdownEditor'
import { CreateChildModal } from './CreateChildModal'
import { ChangeParentModal } from './ChangeParentModal'
// import { analyzeGraph, generateRecommendations } from '../../lib/graph/analysis' // TODO: Migrate to contract types
import { getRoleIcon } from '../../lib/constants/icons'

interface EndeavorDetailClientProps {
  node: GraphNode
  allNodes: GraphNode[]
  userId: string
  isNew?: boolean
}

export function EndeavorDetailClient({ node, allNodes, userId, isNew }: EndeavorDetailClientProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'insights' | 'actions'>('content')
  const [loading, setLoading] = useState(false)
  const [showChildForm, setShowChildForm] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(node.title || '')
  const [createChildModal, setCreateChildModal] = useState<{ isOpen: boolean; childType?: DatabaseNodeType }>({ isOpen: false })
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveChildren, setArchiveChildren] = useState(false)
  const [showNukeModal, setShowNukeModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [showChangeParentModal, setShowChangeParentModal] = useState(false)



  const handleCreateChild = useCallback((childType: DatabaseNodeType) => {
    setCreateChildModal({ isOpen: true, childType })
  }, [])

  const handleCreateChildSubmit = useCallback(async (title: string, parentId: string) => {
    if (!createChildModal.childType) return
    
    setLoading(true)
    try {
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          type: createChildModal.childType, 
          parentId 
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create endeavor')
      }

      const { endeavorId } = await response.json()
      
      // Close modal and navigate to new endeavor
      setCreateChildModal({ isOpen: false })
      window.location.href = `/artifacts/${encodeURIComponent(endeavorId)}`
    } catch (error) {
      console.error('Failed to create child:', error)
      alert('Failed to create endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [createChildModal.childType])

  const handleSaveDescription = useCallback(async (formData: FormData) => {
    const description = formData.get('body') as string
    
    if (isNew) {
      // Create new endeavor first
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: node.title || `New ${node.node_type}`,
          type: node.node_type,
          parentId: node.parent_id
        })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create endeavor')
      }
      
      const { endeavorId } = await response.json()
      
      // Now update the description
      const descResponse = await fetch(`/api/endeavors/${encodeURIComponent(endeavorId)}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      })
      
      if (!descResponse.ok) {
        const error = await descResponse.json()
        throw new Error(error.error || 'Failed to update description')
      }
      
      // Redirect to the newly created endeavor
      window.location.href = `/artifacts/${encodeURIComponent(endeavorId)}`
    } else {
      // Update existing endeavor
      const response = await fetch(`/api/endeavors/${encodeURIComponent(node.id)}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update description')
      }
    }
  }, [node.id, isNew, node.node_type, node.parent_id, node.title])

  const handleSaveTitle = useCallback(async () => {
    setLoading(true)
    try {
      if (isNew) {
        // Create new endeavor first
        const response = await fetch('/api/endeavors/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            type: node.node_type,
            parentId: node.parent_id
          })
        })
        
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create endeavor')
        }
        
        const { endeavorId } = await response.json()
        // Redirect to the newly created endeavor
        window.location.href = `/artifacts/${encodeURIComponent(endeavorId)}`
      } else {
        // Update existing endeavor
        const response = await fetch(`/api/endeavors/${encodeURIComponent(node.id)}/title`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title })
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to update title')
        }
        setEditingTitle(false)
        // Refresh page to show updated title
        window.location.reload()
      }
    } catch (error) {
      console.error('Failed to save title:', error)
      alert('Failed to save title: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [node.id, title, isNew, node.node_type, node.parent_id])

  const handleCancelTitleEdit = useCallback(() => {
    setTitle(node.title || '')
    setEditingTitle(false)
  }, [node.title])

  const handleArchive = useCallback(async () => {
    setLoading(true)
    try {
      const children = allNodes.filter(n => n.parent_id === node.id && !n.archivedAt)
      
      // Archive parent first
      const response = await fetch(`/api/endeavors/${encodeURIComponent(node.id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason || null })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive endeavor')
      }

      // Archive children if requested
      if (archiveChildren && children.length > 0) {
        const childArchivePromises = children.map(child =>
          fetch(`/api/endeavors/${encodeURIComponent(child.id)}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: `Parent "${node.title || node.id}" was archived` })
          })
        )

        await Promise.all(childArchivePromises)
      }

      setShowArchiveModal(false)
      setArchiveReason('')
      setArchiveChildren(false)
      
      // Redirect to dashboard with success message
      const archivedCount = 1 + (archiveChildren ? children.length : 0)
      const message = archivedCount === 1 
        ? encodeURIComponent(node.title || node.id)
        : `${encodeURIComponent(node.title || node.id)} and ${children.length} children`
      
      window.location.href = `/dashboard?archived=${message}`
    } catch (error) {
      console.error('Failed to archive endeavor:', error)
      alert('Failed to archive endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [node.id, archiveReason, archiveChildren, allNodes, node.title])

  const handleUnarchive = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(node.id)}/archive`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to unarchive endeavor')
      }

      // Refresh page to show unarchived state
      window.location.reload()
    } catch (error) {
      console.error('Failed to unarchive endeavor:', error)
      alert('Failed to unarchive endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [node.id])

  const handleDeleteEndeavor = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(node.id)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete endeavor')
      }

      // Redirect to dashboard
      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Failed to delete endeavor:', error)
      alert('Failed to delete endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [node.id])

  // Generate insights
  // TODO: Migrate analyzeGraph and generateRecommendations to use contract types
  // const graphMetrics = analyzeGraph(allNodes)
  // const recommendations = generateRecommendations(allNodes)
  // const nodeSpecificRecommendations = recommendations.filter(r =>
  //   r.description.toLowerCase().includes(node.title?.toLowerCase() || node.id.toLowerCase())
  // )


  const tabs = [
    { id: 'content' as const, label: 'Content', icon: '📄' },
    { id: 'actions' as const, label: 'Actions', icon: '⚙️' }
  ]

  return (
    <div className="space-y-6">
      {/* Archived Status Banner */}
      {node.archived_at && (
        <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded-r-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-red-500 mr-3 text-2xl">🗃️</div>
              <div>
                <h3 className="text-lg font-semibold text-red-800">ARCHIVED {node.node_type.toUpperCase()}</h3>
                <p className="text-sm text-red-700">
                  Archived on {new Date(node.archived_at).toLocaleDateString()}
                  {node.metadata.archivedReason && ` • Reason: ${node.metadata.archivedReason}`}
                </p>
                <p className="text-xs text-red-600 mt-1">
                  This {node.node_type} is read-only and excluded from active views. All data and relationships are preserved.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleUnarchive}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                disabled={loading}
              >
                Unarchive
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                ${activeTab === tab.id
                  ? node.archived_at
                    ? 'border-red-500 text-red-600'
                    : 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border">
        {activeTab === 'content' && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">Content & Description</h3>
            
            <div className="space-y-4">
              {/* Parent section - always show for non-Missions */}
              {node.node_type !== 'Mission' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Parent</label>
                    {!node.archived_at && (
                      <button
                        onClick={() => setShowChangeParentModal(true)}
                        className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {node.parent_id ? (
                      (() => {
                        const parentNode = allNodes.find(n => n.id === node.parent_id)
                        return parentNode ? (
                          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                            <span>{getRoleIcon(parentNode.node_type)}</span>
                            <a
                              href={`/artifacts/${encodeURIComponent(parentNode.id)}`}
                              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                            >
                              {parentNode.title || parentNode.id}
                            </a>
                            <span className="text-xs text-gray-500 capitalize">({parentNode.node_type})</span>
                          </div>
                        ) : (
                          <span className="text-gray-500">{node.parent_id}</span>
                        )
                      })()
                    ) : (
                      <span className="text-gray-400 italic">No parent (root level)</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Title editing */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  {!editingTitle && !node.archived_at && (
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded"
                    >
                      Edit
                    </button>
                  )}
                </div>
                
                {editingTitle ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-2 border rounded text-sm"
                      placeholder="Enter title..."
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveTitle}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                        disabled={loading}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelTitleEdit}
                        className="px-3 py-1 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded text-sm"
                        disabled={loading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-2 bg-gray-50 rounded border">
                    <span className="font-medium">{node.title || node.id}</span>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                {node.archived_at ? (
                  <div className="p-4 bg-gray-50 rounded border">
                    {node.description ? (
                      <div className="prose prose-sm max-w-none text-gray-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {node.description}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <span className="text-gray-500 italic">No description</span>
                    )}
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                      📖 This endeavor is archived and cannot be edited. Descriptions are read-only.
                    </div>
                  </div>
                ) : (
                  <MarkdownEditor
                    initialBody={node.description || ''}
                    onSaveServerAction={handleSaveDescription}
                    title="Description"
                    placeholder="Enter description using Markdown formatting...&#10;&#10;**Key features:**&#10;- Feature 1&#10;- Feature 2&#10;&#10;## Goals&#10;&#10;## Notes"
                    height="400px"
                  />
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <div className="flex items-center gap-2">
                  <span>{getRoleIcon(node.node_type)}</span>
                  <span className="capitalize">{node.node_type}</span>
                </div>
              </div>
              
              {/* Children */}
              <div>
                <h3 className="text-md font-semibold mb-2">Children</h3>
                {(() => {
                  const children = allNodes.filter(n => n.parent_id === node.id)

                  return children.length > 0 ? (
                    <div className="space-y-2">
                      {children.map(child => (
                        <div key={child.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50">
                          <div className="mr-2">
                            {getRoleIcon(child.node_type)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{child.title}</div>
                            <div className="text-sm text-gray-600">{child.node_type}</div>
                          </div>
                          <button className="text-blue-600 hover:text-blue-800">
                            →
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-600 text-sm">No children yet</div>
                  )
                })()}
              </div>
              
              {/* Siblings */}
              {(() => {
                const siblings = node.parent_id ? allNodes.filter(n => n.parent_id === node.parent_id && n.id !== node.id) : []
                return siblings.length > 0 ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Siblings ({siblings.length})
                    </label>
                    <div className="space-y-2">
                      {siblings.map(sibling => (
                        <div key={sibling.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                          <span>{getRoleIcon(sibling.node_type)}</span>
                          <a 
                            href={`/artifacts/${encodeURIComponent(sibling.id)}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline font-medium flex-1"
                          >
                            {sibling.title || sibling.id}
                          </a>
                          <span className="text-xs text-gray-500 capitalize">({sibling.node_type})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              })()}
              
              {node.status && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <span className="capitalize px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                    {node.status}
                  </span>
                </div>
              )}

            </div>
          </div>
        )}




        {activeTab === 'actions' && !isNew && (
          <div className="p-6">
            <h3 className="text-lg font-medium mb-4">{node.node_type.charAt(0).toUpperCase() + node.node_type.slice(1)} Actions</h3>
            
            <div className="space-y-6">
              {/* Status Section */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Current Status</h4>
                {node.archived_at ? (
                  <div className="p-3 bg-red-50 rounded border border-red-200">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-red-700 font-medium">🗃️ Archived</span>
                      <span className="text-xs text-red-600">
                        {new Date(node.archived_at).toLocaleDateString()}
                      </span>
                    </div>
                    {node.metadata.archivedReason && (
                      <div className="text-sm text-red-600 mb-2">
                        <strong>Reason:</strong> {node.metadata.archivedReason}
                      </div>
                    )}
                    <div className="text-xs text-red-500">
                      This {node.node_type} is archived and excluded from most views. All relationships are preserved.
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-green-50 rounded border">
                    <div className="flex items-center gap-2">
                      <span className="text-green-700 font-medium">✅ Active</span>
                      {node.created_at && (
                        <span className="text-xs text-green-600">
                          Created {new Date(node.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      This {node.node_type} is active and visible in all views and queries.
                    </div>
                  </div>
                )}
              </div>

              {/* Archive Section */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Archive</h4>
                {node.archived_at ? (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Restore from Archive</div>
                      <div className="text-sm text-gray-600">
                        Make this {node.node_type} active again and show in all views.
                      </div>
                    </div>
                    <button
                      onClick={handleUnarchive}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                      disabled={loading}
                    >
                      Unarchive
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">Archive {node.node_type.charAt(0).toUpperCase() + node.node_type.slice(1)}</div>
                      <div className="text-sm text-gray-600">
                        Hide from active views while preserving all data and relationships.
                      </div>
                    </div>
                    <button
                      onClick={() => setShowArchiveModal(true)}
                      className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium"
                      disabled={loading}
                    >
                      Archive
                    </button>
                  </div>
                )}
              </div>

              {/* Danger Zone */}
              <div className="mt-8 pt-6 border-t border-red-200">
                <h4 className="font-medium text-red-700 mb-3">Danger Zone</h4>
                <div className="p-4 bg-red-50 rounded border border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-red-800">
                        Delete {node.node_type.charAt(0).toUpperCase() + node.node_type.slice(1)} Forever
                      </div>
                      <div className="text-sm text-red-600 mt-1">
                        Permanently delete this {node.node_type} and all its data. This cannot be undone.
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNukeModal(true)}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium"
                      disabled={loading}
                    >
                      Delete Forever
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateChildModal
        isOpen={createChildModal.isOpen}
        onClose={() => setCreateChildModal({ isOpen: false })}
        childType={createChildModal.childType!}
        currentParent={node}
        allNodes={allNodes}
        onCreateChild={handleCreateChildSubmit}
        loading={loading}
      />

      <ChangeParentModal
        visible={showChangeParentModal}
        onHide={() => setShowChangeParentModal(false)}
        endeavorId={node.id}
        endeavorTitle={node.title || node.id}
        currentParentId={node.parent_id}
        nodeType={node.node_type}
        allNodes={allNodes}
        onChanged={() => window.location.reload()}
      />

      {/* Archive Modal */}
      {showArchiveModal && (() => {
        const children = allNodes.filter(n => n.parent_id === node.id && !n.archived_at)
        return (
          <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-lg">
              <h3 className="text-lg font-medium mb-4">Archive {node.node_type.charAt(0).toUpperCase() + node.node_type.slice(1)}</h3>
              <p className="text-gray-600 mb-4">
                This will archive &quot;{node.title || node.id}&quot; and exclude it from most views. 
                The {node.node_type} and its relationships will be preserved in the graph.
              </p>
              
              {children.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-yellow-600 mt-0.5">⚠️</span>
                    <div>
                      <p className="text-sm font-medium text-yellow-800">
                        This endeavor has {children.length} active child{children.length !== 1 ? 'ren' : ''}:
                      </p>
                      <div className="mt-2 space-y-1">
                        {children.slice(0, 5).map(child => (
                          <div key={child.id} className="text-xs text-yellow-700 flex items-center gap-1">
                            <span>•</span>
                            <span>{child.title || child.id}</span>
                            <span className="text-yellow-600">({child.node_type})</span>
                          </div>
                        ))}
                        {children.length > 5 && (
                          <div className="text-xs text-yellow-700">
                            ... and {children.length - 5} more
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <label className="flex items-center gap-2 mt-3">
                    <input
                      type="checkbox"
                      checked={archiveChildren}
                      onChange={(e) => setArchiveChildren(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-yellow-800">
                      Also archive {children.length} child{children.length !== 1 ? 'ren' : ''} 
                      (recommended to keep hierarchy intact)
                    </span>
                  </label>
                </div>
              )}
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for archiving (optional)
                </label>
                <input
                  type="text"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                  placeholder="e.g., completed, cancelled, superseded"
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowArchiveModal(false)
                    setArchiveReason('')
                    setArchiveChildren(false)
                  }}
                  className="px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded text-sm"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
                  disabled={loading}
                >
                  {loading ? 'Archiving...' : `Archive ${1 + (archiveChildren ? children.length : 0)} item${1 + (archiveChildren ? children.length : 0) !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Delete Confirmation Modal */}
      {showNukeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md border-2 border-red-300">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">⚠️</span>
              <h3 className="text-lg font-medium text-red-800">Delete {node.node_type.charAt(0).toUpperCase() + node.node_type.slice(1)}</h3>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 mb-3">
                This will <strong>permanently delete</strong> &quot;{node.title || node.id}&quot; and all associated data:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                <li>• Title and description</li>
                <li>• All role assertions</li>  
                <li>• All relationships and connections</li>
                <li>• Complete history and metadata</li>
              </ul>
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-sm font-medium text-red-800">
                  ⚠️ This action cannot be undone. The {node.node_type} will be completely removed from your graph.
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-red-700 mb-2">
                  Type &quot;YES I AM SURE&quot; to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full p-2 border border-red-300 rounded text-sm font-mono"
                  placeholder="YES I AM SURE"
                  autoComplete="off"
                />
              </div>
            </div>
            
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowNukeModal(false)
                  setDeleteConfirmation('')
                }}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEndeavor}
                className={`px-4 py-2 rounded font-medium ${
                  deleteConfirmation === 'YES I AM SURE'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
                disabled={loading || deleteConfirmation !== 'YES I AM SURE'}
              >
                {loading ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
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