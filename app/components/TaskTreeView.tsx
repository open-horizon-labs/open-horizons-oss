'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { GraphNode, DatabaseNodeType } from '../../lib/contracts/endeavor-contract'
import { getEndeavorLink } from '../../lib/utils/endeavor-links'
import { Tree } from 'primereact/tree'
import { TreeNode } from 'primereact/treenode'
import { InputText } from 'primereact/inputtext'
import { Button } from 'primereact/button'
import { ContextMenu } from 'primereact/contextmenu'
import { MenuItem } from 'primereact/menuitem'

interface TaskTreeViewProps {
  taskId: string
  allNodes: GraphNode[]
  date: string
  loading: boolean
  setLoading: (loading: boolean) => void
  compact?: boolean
  onDataChange?: () => void
}

export function TaskTreeView({ taskId, allNodes, date, loading, setLoading, compact = false, onDataChange }: TaskTreeViewProps) {
  const router = useRouter()
  const [editingTitles, setEditingTitles] = useState<Set<string>>(new Set())
  const [titleValues, setTitleValues] = useState<Map<string, string>>(new Map())
  const [creatingSubTasks, setCreatingSubTasks] = useState<Set<string>>(new Set())
  const [newTaskTitles, setNewTaskTitles] = useState<Map<string, string[]>>(new Map())
  const [expandedKeys, setExpandedKeys] = useState<{[key: string]: boolean}>({})
  const [optimisticNodes, setOptimisticNodes] = useState<GraphNode[]>(allNodes)
  const contextMenuRef = useRef<ContextMenu>(null)
  const [contextMenuNodeId, setContextMenuNodeId] = useState<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const newTaskTitlesRef = useRef<Map<string, string[]>>(new Map())
  const titleValuesRef = useRef<Map<string, string>>(new Map())

  // Keep refs in sync with state
  useEffect(() => {
    newTaskTitlesRef.current = newTaskTitles
  }, [newTaskTitles])

  useEffect(() => {
    titleValuesRef.current = titleValues
  }, [titleValues])

  // Sync optimistic state when server data changes
  useEffect(() => {
    setOptimisticNodes(allNodes)
  }, [allNodes])

  // Cleanup timeout refs on unmount
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

  const getSubTasks = useCallback((parentId: string): GraphNode[] => {
    const children = allNodes.filter(n => n.parent_id === parentId && n.node_type === DatabaseNodeType.enum.Task)
    // Sort so active tasks come first, then completed tasks
    return children.sort((a, b) => {
      const aCompleted = !!a.archivedAt
      const bCompleted = !!b.archivedAt
      if (aCompleted === bCompleted) return 0
      return aCompleted ? 1 : -1 // Active first, completed last
    })
  }, [allNodes])

  const formatTimeAgo = (archivedAt: string): string => {
    const now = new Date()
    const archived = new Date(archivedAt)
    const diffMs = now.getTime() - archived.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  const handleToggleTaskComplete = useCallback(async (taskId: string, isCurrentlyCompleted: boolean) => {
    setLoading(true)
    try {
      if (isCurrentlyCompleted) {
        const response = await fetch(`/api/endeavors/${encodeURIComponent(taskId)}/archive`, {
          method: 'DELETE'
        })
        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to restore task')
        }
      } else {
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
      // Refresh the page data without full reload
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
  }, [setLoading, onDataChange, router])

  const handleStartTitleEdit = (taskId: string, currentTitle: string) => {
    setEditingTitles(prev => new Set([...prev, taskId]))
    setTitleValues(prev => new Map([...prev, [taskId, currentTitle]]))
  }

  const handleSaveTitle = useCallback(async (taskId: string, title: string) => {
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
  }, [setLoading, onDataChange, router])

  const handleStartCreatingSubTasks = (parentId: string) => {
    setCreatingSubTasks(prev => new Set([...prev, parentId]))
    setNewTaskTitles(prev => new Map([...prev, [parentId, ['']]]))
  }

  const debouncedAutoSave = useCallback((parentId: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      const titles = newTaskTitlesRef.current.get(parentId) || []
      const validTitles = titles.filter(title => title.trim() !== '')

      if (validTitles.length === 0) return

      setLoading(true)

      // Optimistically create tasks immediately in the UI
      const newOptimisticTasks: GraphNode[] = validTitles.map((title, index) => ({
        id: `temp-${parentId}-${Date.now()}-${index}`, // Temporary ID
        node_type: DatabaseNodeType.enum.Task,
        parent_id: parentId,
        title: title.trim(),
        description: '',
        status: 'active',
        metadata: {},
        archived_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        context_id: '',
        created_by: '',
        updated_by: ''
      }))

      // Add optimistic tasks to UI immediately
      setOptimisticNodes(prev => [...prev, ...newOptimisticTasks])

      // Clean up creation state immediately (so user can start typing more)
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
        // Now sync with server in background
        const createdTasks = []
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
          const result = await response.json()
          createdTasks.push(result.endeavorId)
        }

        // Replace optimistic tasks with real server data
        router.refresh() // This will update allNodes with real data
      } catch (error) {
        console.error('Failed to create tasks:', error)
      } finally {
        setLoading(false)
      }
    }, 1500) // 1.5 second delay
  }, [setLoading, router])

  const debouncedTitleSave = useCallback((taskId: string) => {
    if (titleSaveTimeoutRef.current) {
      clearTimeout(titleSaveTimeoutRef.current)
    }

    titleSaveTimeoutRef.current = setTimeout(async () => {
      const title = titleValuesRef.current.get(taskId)
      if (!title || title.trim() === '') return

      // Auto-save the title
      await handleSaveTitle(taskId, title)
    }, 1000) // 1 second delay for title changes
  }, [handleSaveTitle])

  // Context menu items
  const contextMenuItems: MenuItem[] = useMemo(() => {
    if (!contextMenuNodeId) return []

    const node = allNodes.find(n => n.id === contextMenuNodeId)
    if (!node) return []

    const isCompleted = !!node.archivedAt

    return [
      {
        label: isCompleted ? 'Restore Task' : 'Complete Task',
        icon: isCompleted ? 'pi pi-replay' : 'pi pi-check',
        command: () => {
          handleToggleTaskComplete(contextMenuNodeId, isCompleted)
        }
      },
      {
        label: 'Edit Title',
        icon: 'pi pi-pencil',
        command: () => {
          handleStartTitleEdit(contextMenuNodeId, node.title || node.id)
        }
      },
      {
        label: 'Add Sub-task',
        icon: 'pi pi-plus',
        command: () => {
          handleStartCreatingSubTasks(contextMenuNodeId)
        }
      },
      {
        separator: true
      },
      {
        label: 'Open Task',
        icon: 'pi pi-external-link',
        command: () => {
          window.location.href = getEndeavorLink(contextMenuNodeId, date)
        }
      }
    ]
  }, [contextMenuNodeId, allNodes, date, handleToggleTaskComplete])

  const buildTreeData = useCallback((parentId: string): TreeNode[] => {
    const children = getSubTasks(parentId)

    return children.map(task => {
      const isCompleted = !!task.archivedAt
      const isEditing = editingTitles.has(task.id)
      const isCreating = creatingSubTasks.has(task.id)
      const subTasks = buildTreeData(task.id)

      // Tree node title - will be handled by nodeTemplate
      const nodeTitle = isEditing
        ? `Editing: ${task.title || task.id}`
        : (task.title || task.id)

      const node: TreeNode = {
        key: `${parentId}-${task.id}`,
        label: nodeTitle,
        data: task,
        children: subTasks.length > 0 ? subTasks : undefined,
        style: {
          opacity: isCompleted ? 0.7 : 1
        }
      }

      // Add creation UI as a child node if creating
      if (isCreating) {
        const creationTitles = newTaskTitles.get(task.id) || []
        const creationNodes: TreeNode[] = creationTitles.map((title, index) => ({
          key: `${task.id}-creation-${index}`,
          label: title || 'New sub-task...',
          data: { isCreation: true, parentId: task.id, index }
        }))

        node.children = [...(node.children || []), ...creationNodes]
      }

      return node
    })
  }, [getSubTasks, editingTitles, creatingSubTasks, newTaskTitles])

  const treeData = useMemo(() => buildTreeData(taskId), [taskId, buildTreeData])

  const handleNodeContextMenu = (e: any) => {
    const nodeKey = e.node.key
    if (!nodeKey.includes('-creation-')) {
      setContextMenuNodeId(nodeKey)
      contextMenuRef.current?.show(e.originalEvent)
    }
  }

  // Calculate task depth based on parent hierarchy
  const getTaskDepth = (taskId: string): number => {
    if (taskId.includes('-creation-')) {
      const parentId = taskId.split('-creation-')[0]
      return getTaskDepth(parentId) + 1
    }

    const task = allNodes.find(n => n.id === taskId)
    if (!task) return 0

    let depth = 0
    let current = task
    const visited = new Set<string>()

    while (current.parent_id && !visited.has(current.id)) {
      visited.add(current.id)
      const parent = allNodes.find(n => n.id === current.parent_id)
      if (parent && parent.node_type === DatabaseNodeType.enum.Task) {
        depth++
        current = parent
      } else {
        break
      }
    }

    return depth
  }

  // Custom node template with checkbox functionality
  const nodeTemplate = (node: TreeNode, options: any) => {
    // Calculate indentation based on task hierarchy depth
    const depth = getTaskDepth(node.key as string)
    const indentationStyle = { paddingLeft: `${depth * 20}px` }
    if (node.data?.isCreation) {
      const { parentId, index } = node.data
      const titles = newTaskTitles.get(parentId) || []
      const title = titles[index] || ''

      return (
        <div className="flex items-center gap-2 py-1" style={indentationStyle}>
          <div className="w-4 h-4 rounded border-2 border-gray-300"></div>
          <InputText
            value={title}
            onChange={(e) => {
              const newTitles = [...titles]
              newTitles[index] = e.target.value
              setNewTaskTitles(prev => new Map([...prev, [parentId, newTitles]]))

              if (e.target.value.trim()) {
                debouncedAutoSave(parentId)
              }
            }}
            onBlur={(e) => {
              // Save on blur to ensure last character is saved
              if (e.target.value.trim()) {
                debouncedAutoSave(parentId)
              }
            }}
            onKeyDown={(e) => {
              const input = e.target as HTMLInputElement
              const cursorPosition = input.selectionStart || 0

              if (e.key === 'Enter' && !e.ctrlKey) {
                e.preventDefault()
                setNewTaskTitles(prev => new Map([...prev, [parentId, [...titles, '']]]))
              } else if (e.key === 'Escape') {
                e.preventDefault()
                // Cancel creation - exit creation mode without saving
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
            }}
          />
        </div>
      )
    }

    const task = node.data as GraphNode
    const isCompleted = !!task.archivedAt
    const isEditing = editingTitles.has(task.id)

    return (
      <div
        className="flex items-center gap-2 py-1 w-full hover:bg-gray-50 rounded px-2"
        style={indentationStyle}
        onContextMenu={(e) => handleNodeContextMenu({ node, originalEvent: e })}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            handleToggleTaskComplete(task.id, isCompleted)
          }}
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            isCompleted
              ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
              : 'border-gray-300 hover:border-green-400 hover:bg-green-50'
          }`}
          disabled={loading}
          title={isCompleted ? 'Click to restore task' : 'Click to complete task'}
        >
          {isCompleted && <i className="pi pi-check text-xs"></i>}
        </button>

        {/* Task content */}
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center gap-2 flex-1">
              <InputText
                value={titleValues.get(task.id) || task.title || task.id}
                onChange={(e) => {
                  setTitleValues(prev => new Map([...prev, [task.id, e.target.value]]))
                  // Auto-save after typing stops
                  if (e.target.value.trim()) {
                    debouncedTitleSave(task.id)
                  }
                }}
                onBlur={(e) => {
                  // Cancel any pending debounced save
                  if (titleSaveTimeoutRef.current) {
                    clearTimeout(titleSaveTimeoutRef.current)
                    titleSaveTimeoutRef.current = null
                  }
                  // Save immediately on blur to ensure last character is saved
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
                    // Cancel editing - revert to original title and exit edit mode
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
                className="flex-1 p-1 text-sm"
                autoFocus
              />
              <Button
                icon="pi pi-check"
                size="small"
                className="p-1"
                onClick={() => handleSaveTitle(task.id, titleValues.get(task.id) || '')}
                loading={loading}
                text
              />
              <Button
                icon="pi pi-times"
                size="small"
                className="p-1"
                onClick={() => {
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
                }}
                text
                severity="secondary"
              />
            </div>
          ) : (
            <div className={`flex items-center gap-2 ${isCompleted ? 'opacity-70' : ''}`}>
              <a
                href={getEndeavorLink(task.id, date)}
                className={`text-sm text-blue-600 hover:text-blue-800 ${
                  isCompleted ? 'line-through' : ''
                }`}
              >
                {task.title || task.id}
              </a>
              {isCompleted && task.archivedAt && !compact && (
                <div className="text-xs text-gray-400 mt-1">
                  Completed {formatTimeAgo(task.archivedAt)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (treeData.length === 0 && !creatingSubTasks.has(taskId)) {
    return (
      <div className="space-y-2">
        <div className="text-sm text-gray-500 italic">
          No sub-tasks yet.
        </div>
        <Button
          label="Add first sub-task"
          icon="pi pi-plus"
          onClick={() => handleStartCreatingSubTasks(taskId)}
          text
          size="small"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ContextMenu model={contextMenuItems} ref={contextMenuRef} />

      <Tree
        value={treeData}
        expandedKeys={expandedKeys}
        onToggle={(e) => setExpandedKeys(e.value)}
        nodeTemplate={nodeTemplate}
        className="w-full border-none"
        style={{ background: 'transparent' }}
        pt={{
          content: { className: 'p-0' },
          node: { className: 'p-0' },
          subgroup: { className: 'ml-4' }
        }}
      />

      {/* Root-level creation */}
      {creatingSubTasks.has(taskId) && (
        <div className="ml-6 space-y-1">
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
                  // Save on blur to ensure last character is saved
                  if (e.target.value.trim()) {
                    debouncedAutoSave(taskId)
                  }
                }}
                className="flex-1 p-1 text-sm"
                placeholder="New sub-task..."
                autoFocus={index === (newTaskTitles.get(taskId) || []).length - 1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey) {
                    e.preventDefault()
                    const titles = newTaskTitles.get(taskId) || []
                    setNewTaskTitles(prev => new Map([...prev, [taskId, [...titles, '']]]))
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
              />
            </div>
          ))}
          {!compact && (
            <div className="text-xs text-gray-500 mt-1">
              Press Enter for another task, Esc to cancel. Auto-saves after 1.5s
            </div>
          )}
        </div>
      )}

      {!creatingSubTasks.has(taskId) && (
        <Button
          label="Add sub-task"
          icon="pi pi-plus"
          onClick={() => handleStartCreatingSubTasks(taskId)}
          text
          size="small"
          className="ml-6"
        />
      )}
    </div>
  )
}