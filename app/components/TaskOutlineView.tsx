'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { getEndeavorLink } from '../../lib/utils/endeavor-links'

interface TaskOutlineViewProps {
  taskId: string
  allNodes: GraphNode[]
  date: string
  loading: boolean
  setLoading: (loading: boolean) => void
  compact?: boolean
  onDataChange?: () => void
}

export function TaskOutlineView({ taskId, allNodes, date, loading, setLoading, compact = false, onDataChange }: TaskOutlineViewProps) {
  const router = useRouter()
  const [editingTitles, setEditingTitles] = useState<Set<string>>(new Set())
  const [titleValues, setTitleValues] = useState<Map<string, string>>(new Map())
  const [creatingSubTasks, setCreatingSubTasks] = useState<Set<string>>(new Set())
  const [newTaskTitles, setNewTaskTitles] = useState<Map<string, string[]>>(new Map())
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [pendingSaves, setPendingSaves] = useState<Set<string>>(new Set())

  const getSubTasks = (parentId: string, level = 0): GraphNode[] => {
    // Include both active and completed tasks
    const children = allNodes.filter(n => n.parent_id === parentId && n.node_type === DatabaseNodeType.enum.Task)
    let result: GraphNode[] = []

    // Sort so active tasks come first, then completed tasks (most recently completed first)
    const sortedChildren = children.sort((a, b) => {
      const aCompleted = !!a.archived_at
      const bCompleted = !!b.archived_at

      // If both have same completion status
      if (aCompleted === bCompleted) {
        // If both completed, sort by archived date (most recent first)
        if (aCompleted && bCompleted) {
          return new Date(b.archived_at!).getTime() - new Date(a.archived_at!).getTime()
        }
        // If both active, maintain original order
        return 0
      }

      return aCompleted ? 1 : -1 // Active first, completed last
    })

    for (const child of sortedChildren) {
      result.push(child)
      if (level < 3) { // Limit nesting depth
        result.push(...getSubTasks(child.id, level + 1))
      }
    }

    return result
  }

  const getTaskLevel = (taskId: string): number => {
    const task = allNodes.find(n => n.id === taskId)
    if (!task?.parent_id) return 0

    let level = 0
    let current = task
    const visited = new Set<string>()

    while (current.parent_id && !visited.has(current.id)) {
      visited.add(current.id)
      const parent = allNodes.find(n => n.id === current.parent_id)
      if (parent && parent.node_type === DatabaseNodeType.enum.Task) {
        level++
        current = parent
      } else {
        break
      }
    }

    return level
  }

  const handleStartTitleEdit = (taskId: string, currentTitle: string) => {
    setEditingTitles(prev => new Set([...prev, taskId]))
    setTitleValues(prev => new Map([...prev, [taskId, currentTitle]]))
  }

  const handleSaveTitle = async (taskId: string, title: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(taskId)}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update title')
      }

      setEditingTitles(prev => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
      setTitleValues(prev => {
        const next = new Map(prev)
        next.delete(taskId)
        return next
      })
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
  }

  const handleCancelTitleEdit = (taskId: string) => {
    setEditingTitles(prev => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })
    setTitleValues(prev => {
      const next = new Map(prev)
      next.delete(taskId)
      return next
    })
  }

  const handleToggleTaskComplete = async (taskId: string, taskTitle: string, isCurrentlyCompleted: boolean) => {
    setLoading(true)
    try {
      if (isCurrentlyCompleted) {
        // Unarchive task using DELETE endpoint
        const response = await fetch(`/api/endeavors/${encodeURIComponent(taskId)}/archive`, {
          method: 'DELETE'
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to restore task')
        }
      } else {
        // Complete task by archiving
        const response = await fetch(`/api/endeavors/${encodeURIComponent(taskId)}/archive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Task completed' })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to complete task')
        }
      }

      if (onDataChange) {
        onDataChange()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to toggle task:', error)
      alert('Failed to toggle task: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (archived_at: string): string => {
    const now = new Date()
    const archived = new Date(archived_at)
    const diffMs = now.getTime() - archived.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const handleStartCreatingSubTasks = (parentId: string) => {
    setCreatingSubTasks(prev => new Set([...prev, parentId]))
    setNewTaskTitles(prev => new Map([...prev, [parentId, ['']]]))
  }

  const handleFinishCreatingSubTasks = (parentId: string) => {
    setCreatingSubTasks(prev => {
      const next = new Set(prev)
      next.delete(parentId)
      return next
    })
    setNewTaskTitles(prev => {
      const next = new Map(prev)
      next.delete(parentId)
      return next
    })
  }

  const handleUpdateNewTaskTitle = (parentId: string, index: number, title: string) => {
    setNewTaskTitles(prev => {
      const titles = prev.get(parentId) || []
      const newTitles = [...titles]
      newTitles[index] = title
      const newMap = new Map([...prev, [parentId, newTitles]])

      // Trigger autosave when user types
      if (title.trim()) {
        debouncedAutoSave(parentId)
      }

      return newMap
    })
  }

  const handleAddNewTaskRow = (parentId: string) => {
    setNewTaskTitles(prev => {
      const titles = prev.get(parentId) || []
      return new Map([...prev, [parentId, [...titles, '']]])
    })
  }

  const debouncedAutoSave = useCallback((parentId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const titles = newTaskTitles.get(parentId) || []
      const validTitles = titles.filter(title => title.trim() !== '')

      if (validTitles.length === 0) return

      setPendingSaves(prev => new Set([...prev, parentId]))

      try {
        // Create tasks in sequence
        for (const title of validTitles) {
          const response = await fetch('/api/endeavors/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title.trim(), type: 'task', parentId })
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create task')
          }
        }

        handleFinishCreatingSubTasks(parentId)
        if (onDataChange) {
        onDataChange()
      } else {
        router.refresh()
      }
      } catch (error) {
        console.error('Failed to create tasks:', error)
        // Don't alert for auto-saves, just console error
      } finally {
        setPendingSaves(prev => {
          const next = new Set(prev)
          next.delete(parentId)
          return next
        })
      }
    }, 1500) // 1.5 second delay
  }, [newTaskTitles, onDataChange, router])

  const handleCreateNewTasks = async (parentId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const titles = newTaskTitles.get(parentId) || []
    const validTitles = titles.filter(title => title.trim() !== '')

    if (validTitles.length === 0) {
      handleFinishCreatingSubTasks(parentId)
      return
    }

    setLoading(true)
    try {
      // Create tasks in sequence
      for (const title of validTitles) {
        const response = await fetch('/api/endeavors/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: title.trim(), type: 'task', parentId })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to create task')
        }
      }

      handleFinishCreatingSubTasks(parentId)
      if (onDataChange) {
        onDataChange()
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Failed to create tasks:', error)
      alert('Failed to create tasks: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent, parentId: string, index: number) => {
    if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault()
      handleAddNewTaskRow(parentId)
    } else if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleCreateNewTasks(parentId)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleFinishCreatingSubTasks(parentId)
    }
  }

  const subTasks = getSubTasks(taskId)

  const renderTaskItem = (task: GraphNode) => {
    const level = getTaskLevel(task.id)
    const isCompleted = !!task.archived_at
    const isEditing = editingTitles.has(task.id)
    const titleValue = titleValues.get(task.id) || task.title || task.id
    const isCreating = creatingSubTasks.has(task.id)
    const newTitles = newTaskTitles.get(task.id) || []

    return (
      <div key={task.id}>
        {/* Existing Task */}
        <div
          className={`flex items-center gap-2 py-1 ${isCompleted ? 'opacity-70' : ''}`}
          style={{ marginLeft: level * (compact ? 12 : 16) }}
        >
          {/* Checkbox */}
          <button
            onClick={() => handleToggleTaskComplete(task.id, task.title || task.id, isCompleted)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              isCompleted
                ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
            }`}
            disabled={loading}
            title={isCompleted ? 'Click to restore task' : 'Click to complete task'}
          >
            {isCompleted && '✓'}
          </button>

          {/* Task content */}
          <div className="flex-1 flex items-center gap-2">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValues(prev => new Map([...prev, [task.id, e.target.value]]))}
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveTitle(task.id, titleValue)}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  disabled={loading}
                >
                  Save
                </button>
                <button
                  onClick={() => handleCancelTitleEdit(task.id)}
                  className="text-xs px-2 py-1 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex-1">
                <div className="flex items-center gap-2 group">
                  <a
                    href={getEndeavorLink(task.id, date)}
                    className={`text-sm text-blue-600 hover:text-blue-800 ${
                      isCompleted ? 'line-through' : ''
                    }`}
                  >
                    {task.title || task.id}
                  </a>
                  {!isCompleted && (
                    <>
                      <button
                        onClick={() => handleStartTitleEdit(task.id, task.title || task.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700"
                        title="Edit title"
                      >
                        ✏️
                      </button>
                      {!isCreating && (
                        <button
                          onClick={() => handleStartCreatingSubTasks(task.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 hover:text-gray-700"
                          title="Add sub-task"
                        >
                          +
                        </button>
                      )}
                    </>
                  )}
                </div>
                {isCompleted && task.archived_at && (
                  <div className={`text-xs text-gray-400 mt-1 ${compact ? 'hidden' : ''}`}>
                    Completed {formatTimeAgo(task.archived_at)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Creation */}
        {isCreating && (
          <div className="space-y-1" style={{ marginLeft: (level + 1) * (compact ? 12 : 16) }}>
            {newTitles.map((title, index) => (
              <div key={index} className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded border-2 border-gray-300"></div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleUpdateNewTaskTitle(task.id, index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, task.id, index)}
                  className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                  placeholder="New sub-task..."
                  autoFocus={index === newTitles.length - 1}
                />
              </div>
            ))}
            {!compact && (
              <div className="text-xs text-gray-500 mt-1">
                Press Enter for another task, Ctrl+Enter to save, Esc to cancel
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (subTasks.length === 0 && !creatingSubTasks.has(taskId)) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-500 italic">
          No sub-tasks yet.
        </div>
        <button
          onClick={() => handleStartCreatingSubTasks(taskId)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add first sub-task
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {subTasks.map(renderTaskItem)}

      {/* Root-level creation */}
      {creatingSubTasks.has(taskId) && (
        <div className="space-y-1">
          {(newTaskTitles.get(taskId) || []).map((title, index) => (
            <div key={index} className="flex items-center gap-2 py-1">
              <div className="w-4 h-4 rounded border-2 border-gray-300"></div>
              <input
                type="text"
                value={title}
                onChange={(e) => handleUpdateNewTaskTitle(taskId, index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, taskId, index)}
                className="flex-1 text-sm border border-blue-300 rounded px-2 py-1 focus:border-blue-500 focus:outline-none"
                placeholder="New sub-task..."
                autoFocus={index === (newTaskTitles.get(taskId) || []).length - 1}
              />
            </div>
          ))}
          {!compact && (
            <div className="text-xs text-gray-500 mt-1">
              Press Enter for another task, Ctrl+Enter to save, Esc to cancel
            </div>
          )}
        </div>
      )}

      {!creatingSubTasks.has(taskId) && (
        <button
          onClick={() => handleStartCreatingSubTasks(taskId)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          + Add sub-task
        </button>
      )}
    </div>
  )
}