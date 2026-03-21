'use client'

import { useState, useEffect, use } from 'react'
import { GraphNode } from '../../lib/graph/types'
import { DashboardClient } from './DashboardClient'
import Link from 'next/link'
import { HierarchyNavigator } from './HierarchyNavigator'

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
          setContexts(contextsData.contexts || [])
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
          }
        }

        setSelectedContext(contextToLoad)
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
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
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
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Show success message after data deletion */}
      {showDeletedMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-green-400 mr-3">OK</div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Data Deleted Successfully</h3>
              <p className="text-sm text-green-700 mt-1">
                All your data has been permanently deleted.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show success message after archiving */}
      {archivedEndeavorName && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="text-blue-400 mr-3">Archived</div>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Endeavor Archived Successfully</h3>
              <p className="text-sm text-blue-700 mt-1">
                &quot;{decodeURIComponent(archivedEndeavorName)}&quot; has been archived.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div>
            <h1 className="text-2xl font-semibold">Strategy Graph</h1>
            <p className="text-gray-700 mt-1">View and manage your strategy graph.</p>
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
            Settings
          </Link>
        </div>
      </div>

      {/* Endeavor Graph */}
      <div className="border-t pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Endeavor Graph</h2>
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

        {/* Dashboard Client (graph view) */}
        <DashboardClient
          nodes={nodes as any}
          userId={user.id}
          today={today}
          contextId={selectedContext || undefined}
          onDataChange={() => loadDashboardData(selectedContext)}
        />
      </div>
    </div>
  )
}

export default DashboardPageClient
