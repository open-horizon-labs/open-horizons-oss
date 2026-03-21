'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'

interface TaskManagerProps {
  taskId: string
  allNodes: GraphNode[]
  date: string
  loading: boolean
  setLoading: (loading: boolean) => void
  compact?: boolean
  onDataChange?: () => void
  setIsDragging?: (isDragging: boolean) => void
  hideAddButton?: boolean
}

export function TaskManager({ taskId, allNodes, date, loading, setLoading, compact = false, onDataChange, setIsDragging, hideAddButton = false }: TaskManagerProps) {
  const router = useRouter()

  // Optimistic state - this is the source of truth for the UI
  const [optimisticNodes, setOptimisticNodes] = useState<GraphNode[]>(allNodes)
  const [editingTitles, setEditingTitles] = useState<Set<string>>(new Set())
  const [titleValues, setTitleValues] = useState<Map<string, string>>(new Map())
  const [creatingSubTasks, setCreatingSubTasks] = useState<Set<string>>(new Set())
  const [newTaskTitles, setNewTaskTitles] = useState<Map<string, string[]>>(new Map())

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sync optimistic state when server data changes
  useEffect(() => {
    setOptimisticNodes(allNodes)
  }, [allNodes])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current)
      }
    }
  }, [])

  // Get tasks using optimistic state
  const getSubTasks = useCallback((parentId: string): GraphNode[] => {
    const children = optimisticNodes.filter(n => n.parent_id === parentId && n.node_type === DatabaseNodeType.enum.Task)
    return children.sort((a, b) => {
      const aCompleted = !!a.archived_at
      const bCompleted = !!b.archived_at
      if (aCompleted !== bCompleted) return aCompleted ? 1 : -1
      return new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
    })
  }, [optimisticNodes])

  const tasks = getSubTasks(taskId)

  // Recursive component for rendering tasks and their sub-tasks
  const TaskItem = ({ task, depth = 0 }: { task: GraphNode; depth?: number }) => {
    const isCompleted = !!task.archivedAt
    const isEditing = editingTitles.has(task.id)
    const subTasks = getSubTasks(task.id)
    const paddingLeft = depth * 20 // Indent sub-tasks
    const isTemporary = task.id.startsWith('temp-') // Check if this is an optimistic/temporary task

    return (
      <div key={task.id} style={{ marginLeft: paddingLeft }}>
        {/* Task row */}
        <div
          className={`flex items-center gap-2 group ${compact ? 'py-0' : 'py-1'}`}
          draggable={!isTemporary}
          onDragStart={(e) => {
            if (isTemporary) {
              e.preventDefault()
              return
            }
            e.dataTransfer.setData('text/plain', task.id)
            e.dataTransfer.effectAllowed = 'move'
            // Add visual feedback
            e.currentTarget.classList.add('opacity-50')
            // Notify parent about drag state
            setIsDragging?.(true)
          }}
          onDragEnd={(e) => {
            // Remove visual feedback
            e.currentTarget.classList.remove('opacity-50')
            // Reset drag state
            setIsDragging?.(false)
          }}
          onDragOver={(e) => {
            if (isTemporary) return
            e.preventDefault()
            e.stopPropagation() // Prevent parent containers from handling this
            e.dataTransfer.dropEffect = 'move'
            // Add drop target visual feedback
            e.currentTarget.classList.add('bg-blue-50', 'border', 'border-blue-200', 'rounded')
          }}
          onDragLeave={(e) => {
            // Remove drop target visual feedback
            e.currentTarget.classList.remove('bg-blue-50', 'border', 'border-blue-200', 'rounded')
          }}
          onDrop={(e) => {
            if (isTemporary) return
            e.preventDefault()
            e.stopPropagation() // Prevent parent containers from handling this
            // Remove drop target visual feedback
            e.currentTarget.classList.remove('bg-blue-50', 'border', 'border-blue-200', 'rounded')

            const draggedTaskId = e.dataTransfer.getData('text/plain')
            if (draggedTaskId && draggedTaskId !== task.id) {
              handleDropOnTask(draggedTaskId, task.id)
            }
          }}
        >
          {/* Drag handle */}
          <div
            className={`opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 ${isTemporary ? 'opacity-30' : ''}`}
            title={isTemporary ? "Wait for task to save before dragging" : "Drag to reorder or nest tasks"}
          >
            <div className="w-2 h-4 flex flex-col justify-center gap-0.5">
              <div className="w-full h-0.5 bg-gray-400 rounded"></div>
              <div className="w-full h-0.5 bg-gray-400 rounded"></div>
              <div className="w-full h-0.5 bg-gray-400 rounded"></div>
            </div>
          </div>

          {/* Completion checkbox */}
          <button
            onClick={() => handleToggleTaskComplete(task)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              isCompleted
                ? 'bg-green-500 border-green-500 text-white'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            disabled={loading}
          >
            {isCompleted && <i className="pi pi-check text-xs"></i>}
          </button>

          {/* Task title */}
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <InputText
                  value={titleValues.get(task.id) || task.title || ''}
                  onChange={(e) => {
                    setTitleValues(prev => new Map([...prev, [task.id, e.target.value]]))
                    if (e.target.value.trim()) {
                      debouncedTitleSave(task.id)
                    }
                  }}
                  onBlur={(e) => {
                    // Cancel pending save and save immediately
                    if (titleSaveTimeoutRef.current) {
                      clearTimeout(titleSaveTimeoutRef.current)
                      titleSaveTimeoutRef.current = null
                    }
                    const title = e.target.value || titleValues.get(task.id)
                    if (title && title.trim()) {
                      handleSaveTitle(task.id, title)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSaveTitle(task.id, titleValues.get(task.id) || '')
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setEditingTitles(prev => {
                        const next = new Set(prev)
                        next.delete(task.id)
                        return next
                      })
                      setTitleValues(prev => {
                        const next = new Map(prev)
                        next.delete(task.id)
                        return next
                      })
                    }
                  }}
                  className="flex-1 text-sm"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveTitle(task.id, titleValues.get(task.id) || '')}
                  className="text-lg text-green-600 hover:text-green-800 hover:bg-green-50 w-8 h-8 flex items-center justify-center rounded"
                  title="Save"
                >
                  ✓
                </button>
              </div>
            ) : (
              <span
                className={`text-sm cursor-pointer hover:bg-gray-50 px-1 py-1 rounded ${
                  isCompleted ? 'line-through text-gray-500' : ''
                }`}
                onClick={() => handleStartEditing(task)}
              >
                {task.title || task.id}
              </span>
            )}
          </div>

          {/* Add sub-task button for deeper levels - only show for saved tasks */}
          {!isTemporary && (
            <button
              onClick={() => handleStartCreating(task.id)}
              title="Add sub-task"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 w-8 h-8 flex items-center justify-center rounded"
            >
              +
            </button>
          )}
        </div>

        {/* Sub-task creation for this task */}
        {creatingSubTasks.has(task.id) && (
          <div className="space-y-1 border-t pt-2 ml-6">
            {(newTaskTitles.get(task.id) || []).map((title, index) => (
              <div key={index} className="flex items-center gap-2 py-1">
                <div className="w-4 h-4 rounded border-2 border-gray-300"></div>
                <InputText
                  value={title}
                  onChange={(e) => {
                    const titles = newTaskTitles.get(task.id) || []
                    const newTitles = [...titles]
                    newTitles[index] = e.target.value
                    setNewTaskTitles(prev => new Map([...prev, [task.id, newTitles]]))

                    if (e.target.value.trim()) {
                      debouncedAutoSave(task.id)
                    }
                  }}
                  onBlur={(e) => {
                    // Cancel pending save and save immediately
                    if (saveTimeoutRef.current) {
                      clearTimeout(saveTimeoutRef.current)
                      saveTimeoutRef.current = null
                    }
                    if (e.target.value.trim()) {
                      handleCreateTasks(task.id)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.ctrlKey) {
                      e.preventDefault()

                      // First, save the current sub-tasks if there's content
                      const currentInput = e.target as HTMLInputElement
                      if (currentInput.value.trim()) {
                        // Cancel pending debounced save and save immediately
                        if (saveTimeoutRef.current) {
                          clearTimeout(saveTimeoutRef.current)
                          saveTimeoutRef.current = null
                        }
                        handleCreateTasks(task.id)
                      } else {
                        // If current input is empty, just add another input field
                        const titles = newTaskTitles.get(task.id) || []
                        setNewTaskTitles(prev => new Map([...prev, [task.id, [...titles, '']]]))
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      setCreatingSubTasks(prev => {
                        const next = new Set(prev)
                        next.delete(task.id)
                        return next
                      })
                      setNewTaskTitles(prev => {
                        const next = new Map(prev)
                        next.delete(task.id)
                        return next
                      })
                    }
                  }}
                  className="flex-1 text-sm"
                  placeholder="New sub-task..."
                  autoFocus={index === (newTaskTitles.get(task.id) || []).length - 1}
                />
              </div>
            ))}
            {!compact && (
              <div className="text-xs text-gray-500">
                Press Enter for another sub-task, Esc to cancel. Auto-saves after 1.5s
              </div>
            )}
          </div>
        )}

        {/* Recursive sub-tasks */}
        {subTasks.map(subTask => (
          <TaskItem key={subTask.id} task={subTask} depth={depth + 1} />
        ))}
      </div>
    )
  }

  const handleToggleTaskComplete = useCallback(async (task: GraphNode) => {
    const isCompleted = !!task.archivedAt

    // OPTIMISTIC UPDATE: Update UI immediately
    setOptimisticNodes(prev => prev.map(node =>
      node.id === task.id
        ? {
            ...node,
            archivedAt: isCompleted ? undefined : new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        : node
    ))

    // Background sync with server
    try {
      const url = `/api/endeavors/${encodeURIComponent(task.id)}/archive`
      const response = await fetch(url, {
        method: isCompleted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isCompleted ? undefined : JSON.stringify({ reason: 'Task completed' })
      })

      if (!response.ok) {
        // Revert optimistic update on error
        setOptimisticNodes(prev => prev.map(node =>
          node.id === task.id ? task : node
        ))
        const error = await response.json()
        throw new Error(error.error || 'Failed to update task')
      }

      // Success - trigger background refresh to sync with server
      router.refresh()
    } catch (error) {
      console.error('Failed to toggle task:', error)
      alert('Failed to update task: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [router])

  const handleSaveTitle = useCallback(async (taskId: string, title: string) => {
    if (!title.trim()) return

    setLoading(true)

    // OPTIMISTIC UPDATE: Update title immediately
    setOptimisticNodes(prev => prev.map(node =>
      node.id === taskId
        ? { ...node, title: title.trim(), updatedAt: new Date().toISOString() }
        : node
    ))

    // Exit editing mode immediately
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

    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(taskId)}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update title')
      }

      // Success - trigger background refresh
      router.refresh()
    } catch (error) {
      console.error('Failed to save title:', error)
      alert('Failed to save title: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [router, setLoading])

  const debouncedTitleSave = useCallback((taskId: string) => {
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
    }

    titleSaveTimeoutRef.current = setTimeout(() => {
      const title = titleValues.get(taskId)
      if (title && title.trim()) {
        handleSaveTitle(taskId, title)
      }
    }, 1500)
  }, [titleValues, handleSaveTitle])

  const handleCreateTasks = useCallback(async (parentId: string) => {
    const titles = newTaskTitles.get(parentId) || []
    const validTitles = titles.filter(title => title.trim() !== '')

    if (validTitles.length === 0) return

    setLoading(true)

    // OPTIMISTIC UPDATE: Create tasks immediately in UI
    const newOptimisticTasks: GraphNode[] = validTitles.map((title, index) => ({
      id: `temp-${parentId}-${Date.now()}-${index}`,
      title: title.trim(),
      description: '',
      node_type: DatabaseNodeType.enum.Task,
      parent_id: parentId,
      archived_at: null,
      created_at: new Date().toISOString(),
      status: 'active',
      metadata: {}
    }))

    setOptimisticNodes(prev => [...prev, ...newOptimisticTasks])

    // Clean up creation state immediately
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

    try {
      // Background sync with server
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

      // Success - trigger background refresh to replace temp IDs with real ones
      router.refresh()
    } catch (error) {
      console.error('Failed to create tasks:', error)
      // Remove optimistic tasks on error
      setOptimisticNodes(prev => prev.filter(node => !node.id.startsWith(`temp-${parentId}`)))
      alert('Failed to create tasks: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoading(false)
    }
  }, [newTaskTitles, router, setLoading])

  const debouncedAutoSave = useCallback((parentId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleCreateTasks(parentId)
    }, 1500)
  }, [handleCreateTasks])

  const handleStartCreating = (parentId: string) => {
    setCreatingSubTasks(prev => new Set([...prev, parentId]))
    setNewTaskTitles(prev => new Map([...prev, [parentId, ['']]]))
  }

  const handleStartEditing = (task: GraphNode) => {
    setEditingTitles(prev => new Set([...prev, task.id]))
    setTitleValues(prev => new Map([...prev, [task.id, task.title || '']]))
  }


  const handleDropOnTask = useCallback(async (draggedTaskId: string, targetTaskId: string) => {
    // Make dragged task a child of target task
    const draggedTask = optimisticNodes.find(t => t.id === draggedTaskId)
    if (!draggedTask) return

    // OPTIMISTIC UPDATE: Change parent immediately
    setOptimisticNodes(prev => prev.map(node =>
      node.id === draggedTaskId
        ? { ...node, parent_id: targetTaskId, updated_at: new Date().toISOString() }
        : node
    ))

    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(draggedTaskId)}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: targetTaskId })
      })

      if (!response.ok) {
        // Revert on error
        setOptimisticNodes(prev => prev.map(node =>
          node.id === draggedTaskId ? draggedTask : node
        ))
        const error = await response.json()
        throw new Error(error.error || 'Failed to move task')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to move task:', error)
      alert('Failed to move task: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [optimisticNodes, router])

  const handleDropOnRoot = useCallback(async (draggedTaskId: string) => {
    // Make dragged task a top-level task under the current context
    const draggedTask = optimisticNodes.find(t => t.id === draggedTaskId)
    if (!draggedTask) return

    // OPTIMISTIC UPDATE: Change parent to taskId (root)
    setOptimisticNodes(prev => prev.map(node =>
      node.id === draggedTaskId
        ? { ...node, parent_id: taskId, updatedAt: new Date().toISOString() }
        : node
    ))

    try {
      const response = await fetch(`/api/endeavors/${encodeURIComponent(draggedTaskId)}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: taskId })
      })

      if (!response.ok) {
        // Revert on error
        setOptimisticNodes(prev => prev.map(node =>
          node.id === draggedTaskId ? draggedTask : node
        ))
        const error = await response.json()
        throw new Error(error.error || 'Failed to move task to root')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to move task to root:', error)
      alert('Failed to move task to root: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [optimisticNodes, taskId, router])

  if (tasks.length === 0 && !creatingSubTasks.has(taskId)) {
    return (
      <div className="space-y-1">
        <div className="text-sm text-gray-500 italic">
{!compact ? "Break down this work into manageable tasks." : "None yet."}
        </div>
        {/* Add task button - positioned at bottom right */}
        {!hideAddButton && (
          <div className="flex justify-end">
            <button
              onClick={() => handleStartCreating(taskId)}
              disabled={loading}
              className="text-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 w-8 h-8 flex items-center justify-center rounded"
              title="Add task"
            >
              +
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative group transition-colors ${compact ? 'space-y-0' : 'space-y-1'}`}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        e.currentTarget.classList.add('bg-blue-50', 'border', 'border-blue-200', 'rounded')
        e.currentTarget.classList.remove('bg-white')
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove('bg-blue-50', 'border', 'border-blue-200', 'rounded')
        e.currentTarget.classList.add('bg-white')
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove('bg-blue-50', 'border', 'border-blue-200', 'rounded')
        e.currentTarget.classList.add('bg-white')

        const draggedTaskId = e.dataTransfer.getData('text/plain')
        if (draggedTaskId) {
          handleDropOnRoot(draggedTaskId)
        }
      }}
    >
      {/* Add task button - positioned at bottom right */}
      {!hideAddButton && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => handleStartCreating(taskId)}
            disabled={loading}
            className="text-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 w-8 h-8 flex items-center justify-center rounded"
            title="Add task"
          >
            +
          </button>
        </div>
      )}

      {/* Existing tasks - using recursive TaskItem component */}
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} depth={0} />
      ))}

      {/* New task creation */}
      {creatingSubTasks.has(taskId) && (
        <div className="space-y-1 border-t pt-2">
          {(newTaskTitles.get(taskId) || []).map((title, index) => (
            <div key={index} className="flex items-center gap-2 py-1">
              <div className="w-4 h-4 rounded border-2 border-gray-300"></div>
              <InputText
                value={title}
                onChange={(e) => {
                  const titles = newTaskTitles.get(taskId) || []
                  const newTitles = [...titles]
                  newTitles[index] = e.target.value
                  setNewTaskTitles(prev => new Map([...prev, [taskId, newTitles]]))

                  if (e.target.value.trim()) {
                    debouncedAutoSave(taskId)
                  }
                }}
                onBlur={(e) => {
                  // Cancel pending save and save immediately
                  if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current)
                    saveTimeoutRef.current = null
                  }
                  if (e.target.value.trim()) {
                    handleCreateTasks(taskId)
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault()

                    // First, save the current tasks if there's content
                    const currentInput = e.target as HTMLInputElement
                    if (currentInput.value.trim()) {
                      // Cancel pending debounced save and save immediately
                      if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current)
                        saveTimeoutRef.current = null
                      }
                      handleCreateTasks(taskId)
                    } else {
                      // If current input is empty, just add another input field
                      const titles = newTaskTitles.get(taskId) || []
                      setNewTaskTitles(prev => new Map([...prev, [taskId, [...titles, '']]]))
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setCreatingSubTasks(prev => {
                      const next = new Set(prev)
                      next.delete(taskId)
                      return next
                    })
                    setNewTaskTitles(prev => {
                      const next = new Map(prev)
                      next.delete(taskId)
                      return next
                    })
                  }
                }}
                className="flex-1 text-sm"
                placeholder="New task..."
                autoFocus={index === (newTaskTitles.get(taskId) || []).length - 1}
              />
            </div>
          ))}
          {!compact && (
            <div className="text-xs text-gray-500">
              Press Enter for another task, Esc to cancel. Auto-saves after 1.5s
            </div>
          )}
        </div>
      )}

    </div>
  )
}