'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GraphNode, DatabaseNodeType, UserNodeType } from '../../lib/contracts/endeavor-contract'
import { DailyFrontMatter } from '../../lib/graph/types'
import { MarkdownEditor } from './MarkdownEditor'
import { CreateEndeavorModal } from './CreateEndeavorModal'
import { getRoleIcon } from '../../lib/constants/icons'
import { LLMChat } from './LLMChat'
import { TaskManager } from './TaskManager'
import { navigateToEndeavor, getEndeavorLink } from '../../lib/utils/endeavor-links'
import { useUiMode } from '../../lib/ui/UiModeContext'


interface TaskViewProps {
  task: GraphNode
  date: string
  body: string
  allNodes: GraphNode[]
  userId: string
  onSaveBody: (body: string, contextId: string, dateParam: string, frontMatter: DailyFrontMatter) => Promise<void>
  onDataChange?: () => void
}

export function TaskView({
  task,
  date,
  body,
  allNodes,
  userId,
  onSaveBody,
  onDataChange
}: TaskViewProps) {
  const router = useRouter()
  const { mode } = useUiMode()
  const [createEndeavorModal, setCreateEndeavorModal] = useState<{
    isOpen: boolean;
    defaultType?: DatabaseNodeType;
    defaultParentId?: string
  }>({ isOpen: false })
  const [loading, setLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [title, setTitle] = useState(task.title || '')
  const [showDescription, setShowDescription] = useState(false)

  const handleCreateEndeavorSubmit = useCallback(async (title: string, type: UserNodeType, parentId: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/endeavors/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          type,
          parentId: parentId || undefined
          // contextId omitted - will default to personal context
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create task')
      }

      const { endeavorId } = await response.json()

      setCreateEndeavorModal({ isOpen: false })
      // Navigate to new task
      navigateToEndeavor(endeavorId, date)
    } catch (error) {
      console.error('Failed to create task:', error)
      alert('Failed to create task: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [date])


  const handleCompleteTask = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(task.id)}/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Task completed' })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to complete task')
      }

      // Navigate back to dashboard with completion message
      const message = encodeURIComponent(`Task "${task.title || task.id}" completed`)
      window.location.href = `/dashboard?completed=${message}`
    } catch (error) {
      console.error('Failed to complete task:', error)
      alert('Failed to complete task: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [task.id, task.title])

  const handleSaveTitle = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(task.id)}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update title')
      }

      setEditingTitle(false)
      if (onDataChange) {
        onDataChange()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to save title:', error)
      alert('Failed to save title: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [task.id, title, onDataChange, router])

  const handleCancelTitleEdit = useCallback(() => {
    setTitle(task.title || '')
    setEditingTitle(false)
  }, [task.title])

  const handleSaveDescription = useCallback(async (formData: FormData) => {
    const description = formData.get('body') as string

    const response = await fetch(`/api/endeavors/${encodeURIComponent(task.id)}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update description')
    }
  }, [task.id])

  return (
    <div className="space-y-6">
      {/* Task Header */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getRoleIcon(task.node_type)}</span>
            <div className="flex-1">
              {editingTitle ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-semibold text-green-900 bg-white border border-green-300 rounded px-2 py-1 w-full"
                    placeholder="Enter task title..."
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveTitle}
                      className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
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
                <div className="group">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-semibold text-green-900">
                      {task.title || task.id}
                    </h1>
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded"
                      title="Edit task title"
                    >
                      ✏️
                    </button>
                  </div>
                  <p className="text-sm text-green-700">
                    Task log for <strong>{date}</strong>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsChatOpen(true)}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center gap-2"
              title="Get AI help with this task"
            >
              🤖 AI Help
            </button>

            <button
              onClick={handleCompleteTask}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center gap-2"
              disabled={loading}
              title="Mark this task as completed"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Completing...
                </>
              ) : (
                <>
                  ✅ Complete Task
                </>
              )}
            </button>
          </div>
        </div>

        {/* Description Section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-green-700">Description</span>
            <button
              onClick={() => setShowDescription(!showDescription)}
              className="text-xs text-green-600 hover:text-green-800"
            >
              {showDescription ? 'Hide' : task.description ? 'Edit' : 'Add'}
            </button>
          </div>

          {showDescription ? (
            <div className="bg-white rounded border border-green-200">
              <MarkdownEditor
                initialBody={task.description || ''}
                onSaveServerAction={handleSaveDescription}
                title=""
                placeholder="Add a description for this task..."
                height="120px"
                variant="minimal"
                storageKey="task-description"
              />
            </div>
          ) : (
            task.description && (
              <div className="bg-white rounded border border-green-200">
                <MarkdownEditor
                  initialBody={task.description}
                  onSaveServerAction={async () => {}}
                  title=""
                  placeholder=""
                  height="auto"
                  variant="minimal"
                  storageKey="task-description-preview"
                />
              </div>
            )
          )}
        </div>
      </div>

      {/* Task Log */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900">Work Log</h2>
          <p className="text-sm text-gray-600">Record your progress, notes, and any blockers</p>
        </div>

        <div className="p-4">
          <MarkdownEditor
            initialBody={body}
            onSaveServerAction={async (formData) => {
              const body = formData.get('body') as string || ''
              const frontMatter = {
                id: `daily.${task.id}.${date}`,
                node_type: 'DailyPage' as const,
                activeContextFor: task.id
              }
              await onSaveBody(body, task.id, date, frontMatter)
            }}
            title=""
            placeholder={`Log your work on "${task.title || task.id}"...\n\n## Progress\n- What did you accomplish?\n\n## Next Steps\n- What needs to be done next?\n\n## Notes\n- Any observations or blockers?`}
            height="400px"
            variant="minimal"
            storageKey="task-log"
          />
        </div>
      </div>

      {/* Context */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-medium text-gray-900">Context</h2>
          <p className="text-sm text-gray-600">Parent hierarchy and sub-tasks</p>
        </div>

        <div className="p-4 space-y-4">
          {/* Parent Hierarchy */}
          {(() => {
            const hierarchy = []
            let current = task
            const visited = new Set<string>()

            // Build parent chain
            while (current.parent_id && !visited.has(current.id)) {
              visited.add(current.id)
              const parent = allNodes.find(n => n.id === current.parent_id)
              if (parent) {
                hierarchy.unshift(parent)
                current = parent
              } else break
            }

            if (hierarchy.length > 0) {
              return (
                <div className="mb-4">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Parent Context</h3>
                  <div className="text-sm text-gray-600">
                    {hierarchy.map((parent, index) => (
                      <span key={parent.id}>
                        {index > 0 && ' → '}
                        <a
                          href={getEndeavorLink(parent.id, date)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {getRoleIcon(parent.node_type)} {parent.title || parent.id}
                        </a>
                      </span>
                    ))}
                    {' → '}
                    <span className="font-medium text-gray-900">
                      {getRoleIcon(task.node_type)} {task.title || task.id}
                    </span>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Sub-tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sub-tasks</h3>
            </div>

            <TaskManager
              taskId={task.id}
              allNodes={allNodes}
              date={date}
              loading={loading}
              setLoading={setLoading}
              onDataChange={onDataChange}
            />
          </div>
        </div>
      </div>

      {/* Create Endeavor Modal (for non-task children like initiatives) */}
      <CreateEndeavorModal
        isOpen={createEndeavorModal.isOpen}
        onClose={() => setCreateEndeavorModal({ isOpen: false })}
        defaultType={createEndeavorModal.defaultType?.toLowerCase() as UserNodeType}
        defaultParentId={createEndeavorModal.defaultParentId}
        allNodes={allNodes}
        onCreateEndeavor={handleCreateEndeavorSubmit}
        loading={loading}
      />

      {/* AI Chat */}
      <LLMChat
        userId={userId}
        date={date}
        contextId={task.id}
        contextNode={task}
        contextHierarchy={(() => {
          // Build hierarchy: ancestors + current + children
          const hierarchy = []

          // Add ancestors
          let current = task
          const visited = new Set<string>()
          while (current.parent_id && !visited.has(current.id)) {
            visited.add(current.id)
            const parent = allNodes.find(n => n.id === current.parent_id)
            if (parent) {
              hierarchy.unshift(parent)
              current = parent
            } else break
          }

          // Add current
          hierarchy.push(task)

          // Add children (sub-tasks)
          const children = allNodes.filter(n => n.parent_id === task.id)
          hierarchy.push(...children)

          return hierarchy
        })()}
        dailyNoteBody={body}
        contextNotes={new Map([[task.id, { body, fm: { id: `daily.${date}`, node_type: 'DailyPage', activeContextFor: task.id } }]])}
        mode={mode}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  )
}