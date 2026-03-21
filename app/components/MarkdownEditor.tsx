'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownEditorProps {
  initialBody: string
  onSaveServerAction: (formData: FormData) => Promise<void>
  title?: string
  placeholder?: string
  height?: string
  variant?: 'full' | 'compact' | 'minimal'
  storageKey?: string // Optional key for localStorage persistence
}

type SaveState = 'saved' | 'saving' | 'pending' | 'error'
type ViewMode = 'edit' | 'preview' | 'split'

export function MarkdownEditor({
  initialBody,
  onSaveServerAction,
  title = "Content",
  placeholder = "Start typing...",
  height = "600px",
  variant = "full",
  storageKey
}: MarkdownEditorProps) {
  const [body, setBody] = useState(initialBody)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [viewMode, setViewMode] = useState<ViewMode>('preview')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef(initialBody)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)

  // Get initial height from localStorage if available, otherwise use prop
  const getStorageKey = useCallback(() => storageKey ? `markdown-editor-height-${storageKey}` : null, [storageKey])
  const getInitialHeight = () => {
    if (typeof window === 'undefined') return parseInt(height.replace('px', ''))
    const key = getStorageKey()
    if (key) {
      const stored = localStorage.getItem(key)
      if (stored) return parseInt(stored)
    }
    return parseInt(height.replace('px', ''))
  }

  const [editorHeight, setEditorHeight] = useState(getInitialHeight)
  
  const debouncedSave = useCallback(async (content: string) => {
    if (content === lastSavedRef.current) return
    
    setSaveState('saving')
    try {
      const formData = new FormData()
      formData.append('body', content)
      await onSaveServerAction(formData)
      lastSavedRef.current = content
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
    }
  }, [onSaveServerAction])
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setBody(newValue)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    setSaveState('pending')
    timeoutRef.current = setTimeout(() => {
      debouncedSave(newValue)
    }, 1000)
  }, [debouncedSave])

  // Save height to localStorage when it changes
  useEffect(() => {
    const key = getStorageKey()
    if (key) {
      localStorage.setItem(key, editorHeight.toString())
    }
  }, [editorHeight, getStorageKey])

  // Resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    const startY = e.clientY
    const startHeight = editorHeight

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return
      const deltaY = e.clientY - startY
      const newHeight = Math.max(200, Math.min(800, startHeight + deltaY)) // Min 200px, max 800px
      setEditorHeight(newHeight)
    }

    const handleMouseUp = () => {
      isResizingRef.current = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [editorHeight])

  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Handle keyboard shortcuts and click-to-edit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Escape switches from edit to preview
        if (viewMode === 'edit') {
          setViewMode('preview')
        }
      } else if (e.metaKey || e.ctrlKey) {
        if (e.key === 'Enter') {
          // Cmd+Enter toggles between edit and preview
          e.preventDefault()
          if (viewMode === 'edit') {
            setViewMode('preview')
          } else if (viewMode === 'preview') {
            setViewMode('edit')
            // Focus textarea after switching to edit
            setTimeout(() => {
              textareaRef.current?.focus()
            }, 0)
          }
        } else if (e.key === 'e') {
          e.preventDefault()
          setViewMode('edit')
          // Focus textarea after switching to edit mode
          setTimeout(() => {
            textareaRef.current?.focus()
          }, 0)
        } else if (e.key === 'p') {
          e.preventDefault()
          setViewMode('preview')
        } else if (e.key === 'b') {
          e.preventDefault()
          setViewMode('split')
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      // If in edit mode and click outside the editor, switch to preview
      if (viewMode === 'edit' && editorRef.current && !editorRef.current.contains(e.target as Node)) {
        setViewMode('preview')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [viewMode])

  // Handle preview click to edit
  const handlePreviewClick = useCallback(() => {
    if (viewMode === 'preview') {
      setViewMode('edit')
      // Focus the textarea after switching to edit mode
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    }
  }, [viewMode])
  
  const getSaveStatus = () => {
    switch (saveState) {
      case 'saving': return { text: 'Saving...', color: 'text-blue-600' }
      case 'saved': return { text: 'Saved', color: 'text-green-600' }
      case 'pending': return { text: 'Unsaved changes', color: 'text-orange-600' }
      case 'error': return { text: 'Save failed', color: 'text-red-600' }
    }
  }
  
  const status = getSaveStatus()
  
  return (
    <div ref={containerRef} className="rounded-lg border relative">
      {/* Header - Different layouts based on variant */}
      {variant === 'full' && (
        <div className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div className="flex items-center gap-4">
            <h2 className="font-semibold">{title}</h2>

            {/* View Mode Toggle */}
            <div className="flex border rounded-lg bg-white">
              <button
                onClick={() => {
                  setViewMode('edit')
                  // Focus textarea after switching to edit mode
                  setTimeout(() => {
                    textareaRef.current?.focus()
                  }, 0)
                }}
                className={`px-3 py-1 text-xs rounded-l ${
                  viewMode === 'edit'
                    ? 'bg-blue-100 text-blue-700 border-r'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Edit only (⌘E)"
              >
                Edit
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-3 py-1 text-xs border-x ${
                  viewMode === 'split'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Split view (⌘B)"
              >
                Split
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs rounded-r ${
                  viewMode === 'preview'
                    ? 'bg-blue-100 text-blue-700 border-l'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Preview only (⌘P)"
              >
                Preview
              </button>
            </div>
          </div>

          {/* Save Status */}
          <div className={`text-xs ${status.color} flex items-center gap-1`}>
            {saveState === 'saving' && (
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            {status.text}
          </div>
        </div>
      )}

      {/* Compact header - simplified for collapsed description use */}
      {variant === 'compact' && (
        <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{title}</span>

            {/* Simplified mode toggle */}
            <div className="flex border rounded bg-white">
              <button
                onClick={() => {
                  setViewMode(viewMode === 'edit' ? 'preview' : 'edit')
                  if (viewMode === 'preview') {
                    setTimeout(() => {
                      textareaRef.current?.focus()
                    }, 0)
                  }
                }}
                className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                title="Toggle edit/preview"
              >
                {viewMode === 'edit' ? '👀 Preview' : '✏️ Edit'}
              </button>
            </div>
          </div>

          {/* Save Status - smaller */}
          <div className={`text-xs ${status.color} flex items-center gap-1`}>
            {saveState === 'saving' && (
              <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            {status.text}
          </div>
        </div>
      )}

      {/* Minimal - no header */}
      {variant === 'minimal' && viewMode !== 'preview' && (
        <div className="flex justify-end px-2 py-1 border-b bg-gray-50">
          <div className={`text-xs ${status.color} flex items-center gap-1`}>
            {saveState === 'saving' && (
              <div className="w-2 h-2 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            )}
            {status.text}
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className={`grid ${viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ height: `${editorHeight}px` }}>
        {/* Editor */}
        {viewMode !== 'preview' && (
          <div ref={editorRef} className={`${viewMode === 'split' ? 'border-r' : ''}`}>
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleChange}
              className="w-full h-full p-4 font-mono text-sm resize-none border-0 focus:ring-0 focus:outline-none overflow-y-auto"
              placeholder={placeholder}
              style={{ resize: 'none' }}
            />
          </div>
        )}
        
        {/* Preview */}
        {viewMode !== 'edit' && (
          <div
            ref={previewRef}
            onClick={handlePreviewClick}
            className={`p-6 bg-gray-50 overflow-y-auto h-full ${viewMode === 'preview' ? 'cursor-text' : ''}`}
            title={viewMode === 'preview' ? 'Click to edit' : ''}
          >
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style headers with better spacing to match Aim/Do/Reflect views
                  h1: ({children}) => <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-8 first:mt-0 border-b border-gray-200 pb-2">{children}</h1>,
                  h2: ({children}) => <h2 className="text-xl font-semibold text-gray-800 mb-3 mt-8 first:mt-0">{children}</h2>,
                  h3: ({children}) => <h3 className="text-lg font-medium text-gray-700 mb-2 mt-6 first:mt-0">{children}</h3>,
                  h4: ({children}) => <h4 className="text-base font-medium text-gray-700 mb-2 mt-4">{children}</h4>,

                  // Style paragraphs and lists with better spacing
                  p: ({children}) => <p className="text-gray-700 mb-4 leading-relaxed">{children}</p>,
                  ul: ({children}) => <ul className="list-disc list-outside ml-6 mb-4 space-y-2">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal list-outside ml-6 mb-4 space-y-2">{children}</ol>,
                  li: ({children}) => <li className="text-gray-700 leading-relaxed">{children}</li>,
                  
                  // Style code blocks with better spacing
                  code: ({className, children, ...props}) => {
                    const match = /language-(\w+)/.exec(className || '')
                    return match ? (
                      <code className="block bg-gray-800 text-gray-100 rounded-md p-4 text-sm font-mono overflow-x-auto mb-4" {...props}>
                        {children}
                      </code>
                    ) : (
                      <code className="bg-gray-200 px-2 py-1 rounded text-sm font-mono text-gray-800" {...props}>
                        {children}
                      </code>
                    )
                  },

                  // Style blockquotes with better spacing
                  blockquote: ({children}) => (
                    <blockquote className="border-l-4 border-blue-300 pl-6 py-3 bg-blue-50 text-gray-700 italic mb-4 rounded-r-md">
                      {children}
                    </blockquote>
                  ),

                  // Style links
                  a: ({children, href}) => (
                    <a href={href} className="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-500" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),

                  // Style horizontal rules
                  hr: () => <hr className="border-t-2 border-gray-200 my-8" />,

                  // Style tables
                  table: ({children}) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="min-w-full border border-gray-300 rounded-md">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({children}) => <thead className="bg-gray-100">{children}</thead>,
                  th: ({children}) => <th className="border border-gray-300 px-4 py-2 text-left font-semibold text-gray-900">{children}</th>,
                  td: ({children}) => <td className="border border-gray-300 px-4 py-2 text-gray-700">{children}</td>
                }}
              >
                {body || '*Start typing to see your markdown rendered here...*'}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Footer - Different layouts based on variant */}
      {variant === 'full' && (
        <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <div>
              Auto-saves • Use <code>## Done</code>, <code>## Next</code>, <code>## Reflection</code>
            </div>
            <div className="text-right font-mono min-w-0">
              <span className="inline-block w-12 text-right">{body.length}</span> chars • ⌘E/B/P modes
            </div>
          </div>
        </div>
      )}

      {variant === 'compact' && (
        <div className="px-3 py-1 bg-gray-50 border-t text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <div>Auto-saves</div>
            <div className="font-mono">{body.length} chars</div>
          </div>
        </div>
      )}

      {/* Minimal - no footer */}

      {/* Resize Handle - only show if storageKey is provided */}
      {storageKey && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-transparent hover:bg-gray-200 flex items-center justify-center group"
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        >
          <div className="w-8 h-0.5 bg-gray-300 group-hover:bg-gray-400 rounded-full"></div>
        </div>
      )}
    </div>
  )
}