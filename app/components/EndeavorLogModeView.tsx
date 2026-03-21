'use client'

import { useState, useCallback } from 'react'
import { DailyFrontMatter, ReviewBlocks } from '../../lib/graph/types'
import { GraphNode, DatabaseNodeType, UserNodeType } from '../../lib/contracts/endeavor-contract'
import { useUiMode, ShowInMode, ModeAware } from '../../lib/ui/UiModeContext'
import { MarkdownEditor } from './MarkdownEditor'
import { ReviewPanel } from './ReviewPanel'
import { ValidatorPane } from './ValidatorPane'
import { CreateChildModal } from './CreateChildModal'
import { CreateEndeavorModal } from './CreateEndeavorModal'
import { getRoleIcon } from '../../lib/constants/icons'
import { getEndeavorLink, navigateToEndeavor } from '../../lib/utils/endeavor-links'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { LLMChat } from './LLMChat'
import { PrimeTreeView, CompactTreeView } from './PrimeTreeView'
import { TaskView } from './TaskView'
import { TaskManager } from './TaskManager'
import { ExternalContext } from './ExternalContext'
import { LoggingInterface } from '../../components/LoggingInterface'
import { ReflectModeContainer } from './reflect'

interface EndeavorLogModeViewProps {
  endeavor: GraphNode
  date: string
  body: string
  fm: DailyFrontMatter
  blocks: ReviewBlocks
  allNodes: GraphNode[]
  userId: string
  onSaveBody: (body: string, contextId: string, dateParam: string, frontMatter: DailyFrontMatter) => Promise<void>
  onApplyReviewEdit: (edit: {
    block: 'done' | 'aims' | 'next' | 'reflection'
    mode: 'append' | 'replace'
    content: string
  }) => Promise<void>
  onDataChange?: () => void
}

function bannerForType(endeavor: GraphNode): string | null {
  if (endeavor.node_type === DatabaseNodeType.enum.Mission) return 'Helper: Note emerging initiatives you might spin up.'
  if (endeavor.node_type === DatabaseNodeType.enum.Aim ||
      endeavor.node_type === DatabaseNodeType.enum.Initiative ||
      endeavor.node_type === DatabaseNodeType.enum.Task)
    return 'Helper: What did you do today? What will you do next?'
  return null
}

export function EndeavorLogModeView({
  endeavor,
  date,
  body,
  fm,
  blocks,
  allNodes,
  userId,
  onSaveBody,
  onApplyReviewEdit,
  onDataChange
}: EndeavorLogModeViewProps) {
  const { mode } = useUiMode()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [showCreateChild, setShowCreateChild] = useState(false)
  const [childTitle, setChildTitle] = useState('')
  const [childType, setChildType] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  
  // Aim mode management states
  const [activeTab, setActiveTab] = useState<'content' | 'actions'>('content')
  const [loading, setLoading] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(endeavor.title || '')
  const [createChildModal, setCreateChildModal] = useState<{ isOpen: boolean; childType?: DatabaseNodeType }>({ isOpen: false })
  const [createEndeavorModal, setCreateEndeavorModal] = useState<{
    isOpen: boolean;
    defaultType?: UserNodeType;
    defaultParentId?: string
  }>({ isOpen: false })
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveReason, setArchiveReason] = useState('')
  const [archiveChildren, setArchiveChildren] = useState(false)
  const [showNukeModal, setShowNukeModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const handleCreateChild = async () => {
    if (!childTitle.trim() || !childType) return
    
    setIsCreating(true)
    try {
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: childTitle.trim(),
          type: childType,
          parentId: endeavor.id
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create child endeavor')
      }

      const { endeavorId } = await response.json()
      
      // Reset form
      setChildTitle('')
      setChildType('')
      setShowCreateChild(false)
      
      // Navigate to the new child
      window.location.href = getEndeavorLink(endeavorId, date)
      
    } catch (error) {
      console.error('Error creating child endeavor:', error)
      alert('Failed to create child endeavor. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  // Aim mode management handlers

  const handleCreateChildModal = useCallback((childType: DatabaseNodeType) => {
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

      setCreateChildModal({ isOpen: false })
      // Set UI mode to aim and navigate to new endeavor
      localStorage.setItem('open-horizons-ui-mode', 'aim')
      window.location.href = getEndeavorLink(endeavorId, date)
    } catch (error) {
      console.error('Failed to create child:', error)
      alert('Failed to create endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [createChildModal.childType, date])

  const handleCreateEndeavorSubmit = useCallback(async (title: string, type: UserNodeType, parentId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, type, parentId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create endeavor')
      }

      const { endeavorId } = await response.json()

      setCreateEndeavorModal({ isOpen: false })
      // Set UI mode to aim and navigate to new endeavor
      localStorage.setItem('open-horizons-ui-mode', 'aim')
      window.location.href = getEndeavorLink(endeavorId, date)
    } catch (error) {
      console.error('Failed to create endeavor:', error)
      alert('Failed to create endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [date])

  const handleSaveDescription = useCallback(async (formData: FormData) => {
    const description = formData.get('body') as string
    
    const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavor.id)}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update description')
    }
  }, [endeavor.id])

  const handleSaveTitle = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavor.id)}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update title')
      }
      setEditingTitle(false)
      // Preserve URL parameters during reload
      window.location.href = window.location.href
    } catch (error) {
      console.error('Failed to save title:', error)
      alert('Failed to save title: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [endeavor.id, title])

  const handleCancelTitleEdit = useCallback(() => {
    setTitle(endeavor.title || '')
    setEditingTitle(false)
  }, [endeavor.title])

  const handleArchive = useCallback(async () => {
    setLoading(true)
    try {
      const children = allNodes.filter(n => n.parent_id === endeavor.id && !n.archived_at)
      
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavor.id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: archiveReason || null })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to archive endeavor')
      }

      if (archiveChildren && children.length > 0) {
        const childArchivePromises = children.map(child =>
          fetch(`/api/endeavors/${encodeURIComponent(child.id)}/archive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: `Parent "${endeavor.title || endeavor.id}" was archived` })
          })
        )

        await Promise.all(childArchivePromises)
      }

      setShowArchiveModal(false)
      setArchiveReason('')
      setArchiveChildren(false)
      
      const archivedCount = 1 + (archiveChildren ? children.length : 0)
      const message = archivedCount === 1 
        ? encodeURIComponent(endeavor.title || endeavor.id)
        : `${encodeURIComponent(endeavor.title || endeavor.id)} and ${children.length} children`
      
      window.location.href = `/dashboard?archived=${message}`
    } catch (error) {
      console.error('Failed to archive endeavor:', error)
      alert('Failed to archive endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [endeavor.id, archiveReason, archiveChildren, allNodes, endeavor.title])

  const handleUnarchive = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavor.id)}/archive`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to unarchive endeavor')
      }

      // Preserve URL parameters during reload
      window.location.href = window.location.href
    } catch (error) {
      console.error('Failed to unarchive endeavor:', error)
      alert('Failed to unarchive endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [endeavor.id])

  const handleDeleteEndeavor = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(endeavor.id)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete endeavor')
      }

      window.location.href = '/dashboard'
    } catch (error) {
      console.error('Failed to delete endeavor:', error)
      alert('Failed to delete endeavor: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [endeavor.id])



  const tabs = [
    { id: 'content' as const, label: 'Content', icon: '📄' },
    { id: 'actions' as const, label: 'Actions', icon: '⚙️' }
  ]

  // For tasks, use simplified TaskView instead of full Aim/Do/Reflect interface
  if (endeavor.node_type === DatabaseNodeType.enum.Task) {
    return (
      <TaskView
        task={endeavor}
        date={date}
        body={body}
        allNodes={allNodes}
        userId={userId}
        onSaveBody={onSaveBody}
        onDataChange={onDataChange}
      />
    )
  }

  return (
    <ModeAware>
      {(currentMode) => (
        <div className="space-y-6">
          {/* Mode-aware endeavor banner */}
          <ShowInMode mode="aim">
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm text-purple-800">
              <strong>🎯 Aim Mode:</strong> Planning and goal-setting for{' '}
              <span className="font-medium">{endeavor.title || endeavor.id}</span> on <strong>{date}</strong>.
              Focus on clarifying what you want to achieve.
            </div>
          </ShowInMode>

          <ShowInMode mode="do">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <strong>⚡ Do Mode:</strong> Active work log for{' '}
              <span className="font-medium">{endeavor.title || endeavor.id}</span> on <strong>{date}</strong>.
              {bannerForType(endeavor) && (
                <div className="mt-2 text-blue-700">{bannerForType(endeavor)}</div>
              )}
            </div>
          </ShowInMode>

          <ShowInMode mode="reflect">
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <strong>🤔 Reflect Mode:</strong> Review and learning for{' '}
              <span className="font-medium">{endeavor.title || endeavor.id}</span> on <strong>{date}</strong>.
              Look back on progress and insights.
            </div>
          </ShowInMode>


          {/* AI Chat Toggle - Available in all modes */}
          <div className="flex justify-end">
            <button
              onClick={() => setIsChatOpen(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              title="Open AI Chat about your daily log and endeavor"
            >
              🤖 AI Chat
            </button>
          </div>


          {/* Do Mode: Primary daily log interface */}
          <ShowInMode mode="do">
            <div className="space-y-6">
              {/* Endeavor Description - Collapsed by default, now editable */}
              <div className="border rounded-lg">
                <button
                  onClick={() => toggleSection('description')}
                  className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className={`transform transition-transform ${expandedSections.has('description') ? 'rotate-90' : ''}`}>
                      ▶
                    </span>
                    <span>{getRoleIcon(endeavor.node_type)}</span>
                    {endeavor.title || endeavor.id}
                  </span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">{endeavor.node_type}</span>
                </button>
                {expandedSections.has('description') && (
                  <div className="border-t">
                    <MarkdownEditor
                      initialBody={endeavor.description || ''}
                      onSaveServerAction={handleSaveDescription}
                      title="Description"
                      placeholder="Add description for this endeavor..."
                      height="200px"
                      variant="compact"
                      storageKey="description-collapsed"
                    />
                  </div>
                )}
              </div>

              {/* External Context from Integrations */}
              <ExternalContext date={date} />

              {/* Daily log using shared LoggingInterface */}
              <LoggingInterface
                entityType="endeavor"
                entityId={endeavor.id}
                entityDisplayName={endeavor.title || endeavor.id}
                logDate={date}
                userId={userId}
              />

              {/* Tasks Management */}
              {(() => {
                const taskChildren = allNodes.filter(n => n.parent_id === endeavor.id && n.node_type === DatabaseNodeType.enum.Task)

                return (
                  <div className="border rounded-lg">
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="font-medium text-gray-900 flex items-center gap-2">
                        ✅ Tasks
                        {taskChildren.length > 0 && (
                          <span className="text-sm text-gray-600">({taskChildren.length})</span>
                        )}
                      </h3>
                    </div>
                    <div className="p-4">
                      <TaskManager
                        taskId={endeavor.id}
                        allNodes={allNodes}
                        date={date}
                        loading={loading}
                        setLoading={setLoading}
                        compact={false}
                        onDataChange={onDataChange}
                      />
                    </div>
                  </div>
                )
              })()}

              {/* Related Daily Logs - Full Tree with Previews */}
              <div className="border rounded-lg">
                <PrimeTreeView
                  allNodes={allNodes}
                  currentNodeId={endeavor.id}
                  date={date}
                  currentBody={body}
                  onCreateChild={(parentId, childType) => {
                    setCreateEndeavorModal({
                      isOpen: true,
                      defaultType: childType.toLowerCase() as UserNodeType,
                      defaultParentId: parentId
                    })
                  }}
                />
              </div>

              {/* AI Review and Validation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ReviewPanel 
                  body={body} 
                  fm={fm} 
                  activeNode={endeavor} 
                  onApply={onApplyReviewEdit} 
                  userId={userId} 
                  date={date} 
                />
                <ValidatorPane fm={fm} blocks={blocks} />
              </div>
            </div>
          </ShowInMode>

          {/* Aim Mode: Full endeavor management interface */}
          <ShowInMode mode="aim">
            <div className="space-y-6">
              {/* Archived Status Banner */}
              {endeavor.archived_at && (
                <div className="bg-red-100 border-l-4 border-red-500 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-red-500 mr-3 text-2xl">🗃️</div>
                      <div>
                        <h3 className="text-lg font-semibold text-red-800">ARCHIVED {endeavor.node_type.toUpperCase()}</h3>
                        <p className="text-sm text-red-700">
                          Archived on {new Date(endeavor.archived_at!).toLocaleDateString()}
                          {endeavor.metadata.archivedReason && ` • Reason: ${endeavor.metadata.archivedReason}`}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          This {endeavor.node_type.toLowerCase()} is read-only and excluded from active views. All data and relationships are preserved.
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
                          ? endeavor.archived_at 
                            ? 'border-red-500 text-red-600' 
                            : 'border-purple-500 text-purple-600'
                          : 'border-transparent_id text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
                      {endeavor.parent_id && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Parent</label>
                          <div className="flex items-center gap-2">
                            {(() => {
                              const parent_idNode = allNodes.find(n => n.id === endeavor.parent_id)
                              return parent_idNode ? (
                                <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                                  <span>{getRoleIcon(parent_idNode.node_type)}</span>
                                  <a
                                    href={getEndeavorLink(parent_idNode.id, date)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                  >
                                    {parent_idNode.title || parent_idNode.id}
                                  </a>
                                  <span className="text-xs text-gray-500">({parent_idNode.node_type})</span>
                                </div>
                              ) : (
                                <span className="text-gray-500">{endeavor.parent_id}</span>
                              )
                            })()}
                          </div>
                        </div>
                      )}
                      
                      {/* Title editing */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">Title</label>
                          {!editingTitle && !endeavor.archived_at && (
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
                            <span className="font-medium">{endeavor.title || endeavor.id}</span>
                          </div>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                        {endeavor.archived_at ? (
                          <div className="p-4 bg-gray-50 rounded border">
                            {endeavor.description ? (
                              <MarkdownEditor
                                initialBody={endeavor.description}
                                onSaveServerAction={async () => {}}
                                title=""
                                placeholder=""
                                height="auto"
                                variant="minimal"
                                storageKey="description-preview-archived"
                              />
                            ) : (
                              <span className="text-gray-500 italic">No description</span>
                            )}
                            <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                              📖 This endeavor is archived and cannot be edited. Descriptions are read-only.
                            </div>
                          </div>
                        ) : (
                          <MarkdownEditor
                            initialBody={endeavor.description || ''}
                            onSaveServerAction={handleSaveDescription}
                            title="Description"
                            placeholder="Enter description using Markdown formatting...&#10;&#10;**Key features:**&#10;- Feature 1&#10;- Feature 2&#10;&#10;## Goals&#10;&#10;## Notes"
                            height="350px"
                            variant="compact"
                            storageKey="compact"
                          />
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                        <div className="flex items-center gap-2">
                          <span>{getRoleIcon(endeavor.node_type)}</span>
                          <span>{endeavor.node_type}</span>
                        </div>
                      </div>
                      
                      {/* Tasks Management */}
                      {(() => {
                        const taskChildren = allNodes.filter(n => n.parent_id === endeavor.id && n.node_type === DatabaseNodeType.enum.Task)

                        return (
                          <div>
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Tasks
                                {taskChildren.length > 0 && (
                                  <span className="text-sm text-gray-600 ml-2">({taskChildren.length})</span>
                                )}
                              </label>
                            </div>

                            <div className="border rounded-lg p-4">
                              <TaskManager
                                taskId={endeavor.id}
                                allNodes={allNodes}
                                date={date}
                                loading={loading}
                                setLoading={setLoading}
                                compact={false}
                                onDataChange={onDataChange}
                              />
                            </div>
                          </div>
                        )
                      })()}

                      {/* Hierarchy & Related Endeavors */}
                      <div>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Hierarchy & Related Endeavors
                          </label>
                        </div>

                        <div className="border rounded-lg p-4">
                          <CompactTreeView
                            allNodes={allNodes}
                            currentNodeId={endeavor.id}
                            date={date}
                            useContextAware={true}
                            onCreateChild={(parentId, childType) => {
                              setCreateEndeavorModal({
                                isOpen: true,
                                defaultType: childType.toLowerCase() as UserNodeType,
                                defaultParentId: parentId
                              })
                            }}
                          />
                        </div>
                      </div>
                      

                      {endeavor.status && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                          <span className="capitalize px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                            {endeavor.status}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}




                {activeTab === 'actions' && (
                  <div className="p-6">
                    <h3 className="text-lg font-medium mb-4">{endeavor.node_type} Actions</h3>
                    
                    <div className="space-y-6">
                      {/* Status Section */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Current Status</h4>
                        {endeavor.archived_at ? (
                          <div className="p-3 bg-red-50 rounded border border-red-200">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-red-700 font-medium">🗃️ Archived</span>
                              <span className="text-xs text-red-600">
                                {endeavor.archivedAt ? new Date(endeavor.archivedAt).toLocaleDateString() : 'Unknown'}
                              </span>
                            </div>
                            {endeavor.archivedReason && (
                              <div className="text-sm text-red-600 mb-2">
                                <strong>Reason:</strong> {endeavor.archivedReason}
                              </div>
                            )}
                            <div className="text-xs text-red-500">
                              This {endeavor.node_type} is archived and excluded from most views. All relationships are preserved.
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-green-50 rounded border">
                            <div className="flex items-center gap-2">
                              <span className="text-green-700 font-medium">✅ Active</span>
                              {endeavor.createdAt && (
                                <span className="text-xs text-green-600">
                                  Created {new Date(endeavor.createdAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                              This {endeavor.node_type} is active and visible in all views and queries.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Archive Section */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Archive</h4>
                        {endeavor.archived_at ? (
                          <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <div className="font-medium text-gray-900">Restore from Archive</div>
                              <div className="text-sm text-gray-600">
                                Make this {endeavor.node_type} active again and show in all views.
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
                              <div className="font-medium text-gray-900">Archive {endeavor.node_type}</div>
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
                                Delete {endeavor.node_type} Forever
                              </div>
                              <div className="text-sm text-red-600 mt-1">
                                Permanently delete this {endeavor.node_type.toLowerCase()} and all its data. This cannot be undone.
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

              {/* Archive Modal */}
              {showArchiveModal && (() => {
                const children = allNodes.filter(n => n.parent_id === endeavor.id && !n.archived_at)
                return (
                  <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                      <h3 className="text-lg font-medium mb-4">Archive {endeavor.node_type}</h3>
                      <p className="text-gray-600 mb-4">
                        This will archive &quot;{endeavor.title || endeavor.id}&quot; and exclude it from most views. 
                        The {endeavor.node_type.toLowerCase()} and its relationships will be preserved in the graph.
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
                      <h3 className="text-lg font-medium text-red-800">Delete {endeavor.node_type}</h3>
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-gray-700 mb-3">
                        This will <strong>permanently delete</strong> &quot;{endeavor.title || endeavor.id}&quot; and all associated data:
                      </p>
                      <ul className="text-sm text-gray-600 space-y-1 mb-4">
                        <li>• Title and description</li>
                        <li>• All role assertions</li>  
                        <li>• All relationships and connections</li>
                        <li>• Complete history and metadata</li>
                      </ul>
                      <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                        <p className="text-sm font-medium text-red-800">
                          ⚠️ This action cannot be undone. The {endeavor.node_type} will be completely removed from your graph.
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
                    <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent_id rounded-full"></div>
                    <span>Updating endeavor...</span>
                  </div>
                </div>
              )}
            </div>
          </ShowInMode>

          {/* Reflect Mode: Knowledge extraction and review */}
          <ShowInMode mode="reflect">
            <ReflectModeContainer endeavorId={endeavor.id} />
          </ShowInMode>

          {/* Create Child Modal */}
          <CreateChildModal
            isOpen={createChildModal.isOpen}
            onClose={() => setCreateChildModal({ isOpen: false })}
            childType={createChildModal.childType!}
            currentParent={endeavor}
            allNodes={allNodes}
            onCreateChild={handleCreateChildSubmit}
            loading={loading}
          />

          {/* Create Endeavor Modal */}
          <CreateEndeavorModal
            isOpen={createEndeavorModal.isOpen}
            onClose={() => setCreateEndeavorModal({ isOpen: false })}
            defaultType={createEndeavorModal.defaultType}
            defaultParentId={createEndeavorModal.defaultParentId}
            allNodes={allNodes}
            onCreateEndeavor={handleCreateEndeavorSubmit}
            loading={loading}
          />

          {/* AI Chat Sidebar */}
          <LLMChat
            userId={userId}
            date={date}
            contextId={endeavor.id}
            contextNode={endeavor}
            contextHierarchy={(() => {
              // Build hierarchy: ancestors + current + children
              const hierarchy = []
              
              // Add ancestors
              let current = endeavor
              const visited = new Set<string>()
              while (current.parent_id && !visited.has(current.id)) {
                visited.add(current.id)
                const parent_id = allNodes.find(n => n.id === current.parent_id)
                if (parent_id) {
                  hierarchy.unshift(parent_id)
                  current = parent_id
                } else break
              }
              
              // Add current
              hierarchy.push(endeavor)
              
              // Add children
              const children = allNodes.filter(n => n.parent_id === endeavor.id)
              hierarchy.push(...children)
              
              return hierarchy
            })()}
            dailyNoteBody={body}
            contextNotes={new Map([[endeavor.id, { body, fm }]])}
            mode={mode}
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </div>
      )}
    </ModeAware>
  )
}