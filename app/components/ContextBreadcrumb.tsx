'use client'

import { useState, useEffect } from 'react'
import { Tag } from 'primereact/tag'

interface ContextInfo {
  id: string
  title: string
}

interface ContextBreadcrumbProps {
  contextId: string | null
  className?: string
}

export function ContextBreadcrumb({ contextId, className = '' }: ContextBreadcrumbProps) {
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!contextId) {
      setContextInfo(null)
      return
    }

    const loadContextInfo = async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/contexts')
        if (response.ok) {
          const data = await response.json()
          const contexts = data.contexts || []
          const context = contexts.find((c: any) => c.id === contextId)

          if (context) {
            setContextInfo({
              id: context.id,
              title: context.title
            })
          }
        }
      } catch (error) {
        console.error('Failed to load context info:', error)
      } finally {
        setLoading(false)
      }
    }

    loadContextInfo()
  }, [contextId])

  if (loading) {
    return null
  }

  // No fallback - if no contextId, show nothing or error
  if (!contextId) {
    return null
  }

  if (!contextInfo) {
    return null
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs text-gray-500">Viewing in:</span>
      <Tag
        value={contextInfo.title}
        severity="info"
        className="text-xs"
        icon="pi pi-users"
      />
    </div>
  )
}

export default ContextBreadcrumb