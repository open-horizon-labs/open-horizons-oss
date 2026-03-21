"use client"
import { useState, useTransition } from 'react'
import { GraphNode, DailyFrontMatter } from '../../lib/graph/types'
import { ancestors, descendants } from '../../lib/graph/traverse'

export function HierarchicalContextView({
  contexts,
  contextNotes,
  activeContext,
  date,
  onJumpToContext
}: {
  contexts: GraphNode[]
  contextNotes: Map<string, { body: string; fm: DailyFrontMatter | null }>
  activeContext: GraphNode
  date: string
  onJumpToContext: (contextId: string) => Promise<void> | void
}) {
  const [switchingTo, setSwitchingTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  
  // Split the contexts array: contexts = [...ancestorNodes, active, ...descendantNodes]
  const activeIndex = contexts.findIndex(c => c.id === activeContext.id)
  const ancestorContexts = activeIndex > 0 ? contexts.slice(0, activeIndex) : []
  const descendantContexts = activeIndex >= 0 ? contexts.slice(activeIndex + 1) : []
  const relatedContexts = [...ancestorContexts, ...descendantContexts]
  
  if (relatedContexts.length === 0) return null
  
  const renderContextGroup = (contexts: GraphNode[], title: string) => {
    if (contexts.length === 0) return null
    
    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-gray-700">
          {title} ({contexts.length})
        </h4>
        {contexts.map(context => {
          const notes = contextNotes.get(context.id)
          const hasNotes = notes && notes.body.trim().length > 0
          const preview = hasNotes ? notes.body.slice(0, 150) + (notes.body.length > 150 ? '...' : '') : ''
          const isLoading = switchingTo === context.id
          
          return (
            <div key={context.id} className="rounded border bg-white p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium text-sm">
                  {context.node_type}: {context.title || context.id}
                </div>
                <button
                  onClick={() => {
                    setSwitchingTo(context.id)
                    startTransition(async () => {
                      await onJumpToContext(context.id)
                      setSwitchingTo(null)
                    })
                  }}
                  disabled={isLoading || isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded border text-xs bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Switching...
                    </>
                  ) : (
                    <>
                      <span>Go to</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
              {preview ? (
                <div className="text-xs text-gray-600 font-mono bg-gray-50 p-2 rounded">
                  {preview}
                </div>
              ) : (
                <div className="text-xs text-gray-400 italic">
                  No notes for {date}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4 bg-gray-50">
      <h3 className="font-medium text-sm text-gray-700 mb-3">
        Related Context Notes
      </h3>
      <div className="space-y-6">
        {renderContextGroup(ancestorContexts.slice().reverse(), "Parent/Ancestor Contexts (↑)")}
        {renderContextGroup(descendantContexts, "Child/Descendant Contexts (↓)")}
      </div>
    </div>
  )
}