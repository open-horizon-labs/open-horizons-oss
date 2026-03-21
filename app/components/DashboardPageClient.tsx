'use client'

import { useState, useEffect, use } from 'react'
import { GraphNode } from '../../lib/graph/types'
import { DashboardClient } from './DashboardClient'
import { PendingInvitations } from './PendingInvitations'
import { LoggingInterface } from '../../components/LoggingInterface'
import { UiModeToggle } from './UiModeToggle'
import { useUiMode, ShowInMode } from '../../lib/ui/UiModeContext'
import Link from 'next/link'
import { LLMChat } from './LLMChat'
import { HierarchyNavigator } from './HierarchyNavigator'
import { byId } from '../../lib/graph/traverse'
import { ReflectModeContainer } from './reflect'

interface DashboardPageClientProps {
  searchParams: Promise<{ deleted?: string; archived?: string; context?: string }>
}

export function DashboardPageClient({ searchParams }: DashboardPageClientProps) {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedContext, setSelectedContext] = useState<string | null>(null)
  const [contexts, setContexts] = useState<any[]>([])
  const [today, setToday] = useState<string>('')
  const { mode } = useUiMode()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const resolvedSearchParams = use(searchParams)

  const showDeletedMessage = resolvedSearchParams.deleted === 'true'
  const archivedEndeavorName = resolvedSearchParams.archived
  const urlContextId = resolvedSearchParams.context

  // Load initial data and set up context change listener
  useEffect(() => {
    // Set today's date on client side to avoid hydration mismatch
    setToday(new Date().toISOString().slice(0, 10))

    async function loadInitialData() {
      try {
        // Get user and contexts
        const [userResponse, contextsResponse] = await Promise.all([
          fetch('/api/auth/user'),
          fetch('/api/contexts')
        ])

        if (userResponse.ok) {
          const userData = await userResponse.json()
          setUser(userData.user)
        }

        let contextsData: any = null
        if (contextsResponse.ok) {
          contextsData = await contextsResponse.json()
          console.log('🏠 DashboardPageClient - Contexts loaded:', contextsData.contexts?.length || 0, contextsData.contexts?.map((c: any) => ({ id: c.id, title: c.title })))
          setContexts(contextsData.contexts || [])
        } else {
          console.error('🏠 DashboardPageClient - Failed to load contexts:', contextsResponse.status)
        }

        // Use context from URL, falling back to localStorage, then default to personal
        let contextToLoad = urlContextId ||
          (() => {
            const savedContextId = localStorage.getItem('selectedContextId')
            return savedContextId && savedContextId !== 'null' ? savedContextId : null
          })()

        // If still no context and we have contexts, default to personal context
        if (!contextToLoad && contextsData?.contexts && contextsData.contexts.length > 0) {
          const personalContext = contextsData.contexts.find((ctx: any) => ctx.id.startsWith('personal:'))
          if (personalContext) {
            contextToLoad = personalContext.id
            localStorage.setItem('selectedContextId', personalContext.id)
            console.log('🏠 DashboardPageClient - Auto-selected personal context:', personalContext.id)
          }
        }

        setSelectedContext(contextToLoad)
        // Also update localStorage to match URL
        if (urlContextId) {
          localStorage.setItem('selectedContextId', urlContextId)
        }
        await loadDashboardData(contextToLoad)
      } catch (error) {
        console.error('Failed to load initial data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()

    // Listen for context changes from the ContextSwitcher
    const handleContextChange = (event: CustomEvent) => {
      const contextId = event.detail.contextId
      setSelectedContext(contextId)
      // Save to localStorage to persist across navigation
      localStorage.setItem('selectedContextId', contextId || 'null')
      loadDashboardData(contextId)
    }

    window.addEventListener('contextChanged', handleContextChange as EventListener)

    return () => {
      window.removeEventListener('contextChanged', handleContextChange as EventListener)
    }
  }, [urlContextId])

  const loadDashboardData = async (contextId: string | null) => {
    try {
      const url = contextId
        ? `/api/dashboard?contextId=${encodeURIComponent(contextId)}`
        : '/api/dashboard'

      const response = await fetch(url, {
        cache: 'no-store', // Prevent caching
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setNodes(data.nodes || [])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2">
          <i className="pi pi-spin pi-spinner" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <div>Please sign in</div>
  }

  return (
    <div className="space-y-6">
      {/* Show success message after data deletion */}
      {showDeletedMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">✅</div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Data Deleted Successfully</h3>
              <p className="text-sm text-green-700 mt-1">
                All your data has been permanently deleted. You&apos;re starting fresh!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show success message after archiving */}
      {archivedEndeavorName && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-blue-400 mr-3">🗃️</div>
              <div>
                <h3 className="text-sm font-medium text-blue-800">Endeavor Archived Successfully</h3>
                <p className="text-sm text-blue-700 mt-1">
                  &quot;{decodeURIComponent(archivedEndeavorName)}&quot; has been archived and is no longer shown in the active view.
                </p>
              </div>
            </div>
            <Link
              href="/archived"
              className="px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-sm font-medium"
            >
              View Archived
            </Link>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div>
            <h1 className="text-2xl font-semibold">Welcome{user?.email ? `, ${user.email}` : ''}</h1>
            <p className="text-gray-700 mt-1">Keep your daily log updated throughout the day with thoughts, progress, and breakthroughs.</p>
          </div>

          <div className="flex items-center gap-2 mt-3 min-w-0">
            <span className="text-sm text-gray-500 whitespace-nowrap">Context:</span>
            <span className="font-medium text-gray-700 truncate">
              {selectedContext && selectedContext !== 'null'
                ? contexts.find(c => c.id === selectedContext)?.title || 'Unknown Context'
                : 'Open Horizons'
              }
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <Link
            className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
            href="/settings"
          >
            ⚙️ Settings
          </Link>
          <Link
            className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
            href="/archived"
          >
            🗃️ Archived
          </Link>
        </div>
      </div>

      {/* Pending Invitations */}
      <PendingInvitations />

      {/* Mode-Specific Content */}
      <ShowInMode mode="aim">
        <div className="border-t pt-6">
          {/* Aim mode header with AI Chat toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Endeavor Graph</h2>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
            >
              {isChatOpen ? '✕ Close AI Chat' : '💬 AI Chat'}
            </button>
          </div>

          {/* Hierarchy Navigator */}
          {selectedContext && (
            <div className="mb-4">
              <HierarchyNavigator
                currentEndeavorId={selectedContext}
                nodes={nodes}
              />
            </div>
          )}

          {/* Dashboard Client (existing graph view) */}
          <DashboardClient
            nodes={nodes as any}
            userId={user.id}
            today={today}
            contextId={selectedContext || undefined}
            onDataChange={() => loadDashboardData(selectedContext)}
          />

          {/* AI Chat Sidebar */}
          {(() => {
            if (!selectedContext) return null
            const contextNode = byId(nodes, selectedContext)
            if (!contextNode) return null

            // Build hierarchy: ancestors + current + children
            const hierarchy: GraphNode[] = []
            let current = contextNode
            const visited = new Set<string>()

            // Add ancestors
            while (current.parent_id && !visited.has(current.id)) {
              visited.add(current.id)
              const parent = nodes.find(n => n.id === current.parent_id)
              if (parent) {
                hierarchy.unshift(parent)
                current = parent
              } else break
            }

            // Add current
            hierarchy.push(contextNode)

            // Add children
            const children = nodes.filter(n => n.parent_id === contextNode.id)
            hierarchy.push(...children)

            return (
              <LLMChat
                userId={user.id}
                date={today}
                contextId={selectedContext}
                contextNode={contextNode}
                contextHierarchy={hierarchy}
                dailyNoteBody="" // Empty for Aim mode
                contextNotes={new Map()} // Empty Map for Aim mode
                mode="aim" // 7-day time filtering
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
              />
            )
          })()}
        </div>
      </ShowInMode>

      <ShowInMode mode="do">
        <div className="border-t pt-6">
          {today && selectedContext ? (
            <LoggingInterface
              entityType="context"
              entityId={selectedContext}
              entityDisplayName={contexts.find(c => c.id === selectedContext)?.title || 'Personal Context'}
              logDate={today}
              userId={user?.id}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-lg mb-2">Ready to capture your work</div>
              <div className="text-sm">
                Loading your context for daily logging...
              </div>
            </div>
          )}
        </div>
      </ShowInMode>

      <ShowInMode mode="reflect">
        <div className="border-t pt-6">
          {/* Reflect mode header with AI Chat toggle */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">💭 Reflect Mode</h2>
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
            >
              {isChatOpen ? '✕ Close AI Chat' : '💬 AI Chat'}
            </button>
          </div>

          {/* Hierarchy Navigator */}
          {selectedContext && (
            <div className="mb-4">
              <HierarchyNavigator
                currentEndeavorId={selectedContext}
                nodes={nodes}
              />
            </div>
          )}

          {/* Knowledge Review UI */}
          {selectedContext ? (
            <div className="mb-6">
              <ReflectModeContainer endeavorId={selectedContext} />
            </div>
          ) : (
            <div className="mb-6 bg-gray-50 rounded-lg border border-dashed p-8 text-center">
              <p className="text-gray-500 text-sm">Select an endeavor to review knowledge</p>
            </div>
          )}

          {/* AI Chat Sidebar */}
          {(() => {
            if (!selectedContext) return null
            const contextNode = byId(nodes, selectedContext)
            if (!contextNode) return null

            // Build hierarchy: ancestors + current + children
            const hierarchy: GraphNode[] = []
            let current = contextNode
            const visited = new Set<string>()

            // Add ancestors
            while (current.parent_id && !visited.has(current.id)) {
              visited.add(current.id)
              const parent = nodes.find(n => n.id === current.parent_id)
              if (parent) {
                hierarchy.unshift(parent)
                current = parent
              } else break
            }

            // Add current
            hierarchy.push(contextNode)

            // Add children
            const children = nodes.filter(n => n.parent_id === contextNode.id)
            hierarchy.push(...children)

            return (
              <LLMChat
                userId={user.id}
                date={today}
                contextId={selectedContext}
                contextNode={contextNode}
                contextHierarchy={hierarchy}
                dailyNoteBody="" // Empty for Reflect mode
                contextNotes={new Map()} // Empty Map for Reflect mode
                mode="reflect" // 7-day time filtering
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
              />
            )
          })()}
        </div>
      </ShowInMode>
    </div>
  )
}

export default DashboardPageClient