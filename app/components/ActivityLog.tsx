'use client'

import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface LogEntry {
  id: string
  entity_type: string
  entity_id: string
  content: string
  content_type: string
  log_date: string
  created_at: string
  updated_at: string
}

interface ActivityLogProps {
  endeavorId: string
}

export function ActivityLog({ endeavorId }: ActivityLogProps) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchLogs() {
      try {
        const params = new URLSearchParams({
          entity_id: endeavorId,
          entity_type: 'endeavor',
        })
        const response = await fetch(`/api/logs?${params}`)
        if (response.ok) {
          const data = await response.json()
          setLogs(data.logs || [])
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [endeavorId])

  if (loading) {
    return null
  }

  if (logs.length === 0) {
    return null
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Activity ({logs.length})
      </label>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="p-3 bg-gray-50 rounded border">
            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
              <time dateTime={log.log_date}>
                {new Date(log.log_date).toLocaleDateString()}
              </time>
              {log.content_type && log.content_type !== 'markdown' && (
                <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-600">
                  {log.content_type}
                </span>
              )}
            </div>
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {log.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
