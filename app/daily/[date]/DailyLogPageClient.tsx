'use client'

import { useState, useEffect, use } from 'react'
import { LoggingInterface } from '../../../components/LoggingInterface'

interface DailyLogPageClientProps {
  params: Promise<{ date: string }>
  searchParams: Promise<{ context?: string }>
  userId: string
}

export function DailyLogPageClient({ params, searchParams, userId }: DailyLogPageClientProps) {
  const { date } = use(params)
  const { context } = use(searchParams)

  const [loading, setLoading] = useState(true)
  const [contextDisplayName, setContextDisplayName] = useState<string>('Loading...')
  const [entityInfo, setEntityInfo] = useState<{ entity_type: 'context', entity_id: string } | null>(null)

  // Parse and validate date with fallback to today
  let logDate: string
  try {
    const parsedDate = new Date(date)
    if (isNaN(parsedDate.getTime())) {
      throw new Error('Invalid date')
    }
    logDate = parsedDate.toISOString().split('T')[0]
  } catch {
    logDate = new Date().toISOString().split('T')[0]
  }

  // Format date for display
  const displayDate = new Date(logDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Auto-populate entity context from available sources and fetch display names
  useEffect(() => {
    const setupContextInfo = async () => {
      setLoading(true)

      // Get context from multiple sources with priority
      const getContextInfo = () => {
        // 1. URL context parameter (highest priority)
        if (context) {
          return { entity_type: 'context' as const, entity_id: context }
        }

        // 2. LocalStorage selected context
        const savedContextId = localStorage.getItem('selectedContextId')
        if (savedContextId && savedContextId !== 'null') {
          return { entity_type: 'context' as const, entity_id: savedContextId }
        }

        // 3. Fallback to personal context for the user
        return { entity_type: 'context' as const, entity_id: `personal:${userId}` }
      }

      const contextInfo = getContextInfo()
      setEntityInfo(contextInfo)

      // Fetch and set display name for the context
      try {
        if (contextInfo.entity_id.startsWith('personal:')) {
          setContextDisplayName('Personal Workspace')
        } else {
          // Fetch context title from contexts API
          const response = await fetch('/api/contexts')
          if (response.ok) {
            const data = await response.json()
            const contextItem = data.contexts?.find((ctx: any) => ctx.id === contextInfo.entity_id)
            setContextDisplayName(contextItem?.title || contextInfo.entity_id)
          } else {
            setContextDisplayName(contextInfo.entity_id)
          }
        }
      } catch (err) {
        console.error('Failed to fetch context name:', err)
        setContextDisplayName(contextInfo.entity_id)
      } finally {
        setLoading(false)
      }
    }

    setupContextInfo()
  }, [logDate, context, userId])

  if (loading || !entityInfo) {
    return (
      <div className="container mx-auto max-w-6xl p-6">
        <div className="text-center py-8">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-3">
          <span>📝</span>
          Daily Log - {displayDate}
        </h1>
        {context && (
          <p className="text-gray-600 mt-2">
            Context: <span className="font-medium">{contextDisplayName}</span>
          </p>
        )}
      </header>

      <LoggingInterface
        entityType={entityInfo.entity_type}
        entityId={entityInfo.entity_id}
        entityDisplayName={contextDisplayName}
        logDate={logDate}
        userId={userId}
      />

      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="text-blue-800 text-sm">
          <p className="font-medium mb-2">📊 Debug Information</p>
          <div className="space-y-1 text-xs">
            <p><strong>Raw Date Parameter:</strong> {date}</p>
            <p><strong>Validated Date:</strong> {logDate}</p>
            <p><strong>Context Filter:</strong> {context || 'None (showing all logs)'}</p>
            <p><strong>Entity:</strong> {entityInfo.entity_type}:{entityInfo.entity_id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}