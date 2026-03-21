'use client'

import { useState, useEffect } from 'react'

interface DbStatus {
  ok: boolean
  endeavors_count?: number
  contexts_count?: number
  error?: string
}

export default function GeneralSettingsPage() {
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA || 'dev'

  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch('/api/status')
        if (res.ok) {
          const data = await res.json()
          setDbStatus({
            ok: true,
            endeavors_count: data.database?.endeavors_count,
            contexts_count: data.database?.contexts_count,
          })
        } else {
          setDbStatus({ ok: false, error: `HTTP ${res.status}` })
        }
      } catch (err) {
        setDbStatus({ ok: false, error: err instanceof Error ? err.message : 'Connection failed' })
      } finally {
        setLoading(false)
      }
    }
    checkStatus()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">General</h2>
        <p className="text-gray-600">Application information and status.</p>
      </div>

      <div className="space-y-6">
        {/* App info */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Application</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <dt className="text-sm text-gray-500">Version</dt>
              <dd className="text-sm font-mono font-medium text-gray-900 mt-1">{appVersion}</dd>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <dt className="text-sm text-gray-500">Git SHA</dt>
              <dd className="text-sm font-mono font-medium text-gray-900 mt-1">
                {gitSha === 'dev' ? 'dev (local)' : gitSha.slice(0, 8)}
              </dd>
            </div>
          </dl>
        </div>

        {/* Database status */}
        <div>
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Database</h3>
          {loading ? (
            <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-500">
              Checking connection...
            </div>
          ) : dbStatus?.ok ? (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg px-4 py-3">
                <dt className="text-sm text-green-700">Status</dt>
                <dd className="text-sm font-medium text-green-900 mt-1">Connected</dd>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <dt className="text-sm text-gray-500">Endeavors</dt>
                <dd className="text-sm font-mono font-medium text-gray-900 mt-1">{dbStatus.endeavors_count}</dd>
              </div>
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <dt className="text-sm text-gray-500">Contexts</dt>
                <dd className="text-sm font-mono font-medium text-gray-900 mt-1">{dbStatus.contexts_count}</dd>
              </div>
            </dl>
          ) : (
            <div className="bg-red-50 rounded-lg px-4 py-3">
              <dt className="text-sm text-red-700">Status</dt>
              <dd className="text-sm font-medium text-red-900 mt-1">
                Disconnected {dbStatus?.error ? `-- ${dbStatus.error}` : ''}
              </dd>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
