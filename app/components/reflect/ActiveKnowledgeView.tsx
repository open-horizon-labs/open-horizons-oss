'use client'

import { useState } from 'react'
import { ActiveKnowledgeResponse, Severity } from '../../../lib/contracts/reflect-contract'

interface ActiveKnowledgeViewProps {
  knowledge: ActiveKnowledgeResponse | null
  loading: boolean
  error?: string | null
}

type MetisEntry = ActiveKnowledgeResponse['metis'][0]
type GuardrailEntry = ActiveKnowledgeResponse['guardrails'][0]

function MetisCard({ entry }: { entry: MetisEntry }) {
  const [expanded, setExpanded] = useState(false)

  const freshnessColor = {
    recent: 'bg-green-100 text-green-700',
    stale: 'bg-yellow-100 text-yellow-700',
    historical: 'bg-gray-100 text-gray-600'
  }[entry.freshness] || 'bg-gray-100 text-gray-600'

  const confidenceColor = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-gray-100 text-gray-600'
  }[entry.confidence] || 'bg-gray-100 text-gray-600'

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-600">💡</span>
            <h4 className="font-medium text-gray-900">{entry.title}</h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded ${freshnessColor}`}>
              {entry.freshness}
            </span>
            <span className={`px-2 py-0.5 rounded ${confidenceColor}`}>
              {entry.confidence} confidence
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 ml-2"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          <p className="text-sm text-gray-700">{entry.content}</p>

          {entry.violated_expectation && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase">Expected</h5>
              <p className="text-sm text-gray-700 mt-1">{entry.violated_expectation}</p>
            </div>
          )}

          {entry.observed_reality && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase">Reality</h5>
              <p className="text-sm text-gray-700 mt-1">{entry.observed_reality}</p>
            </div>
          )}

          {entry.consequence && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase">Consequence</h5>
              <p className="text-sm text-gray-700 mt-1">{entry.consequence}</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Created {new Date(entry.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}

function GuardrailCard({ entry }: { entry: GuardrailEntry }) {
  const [expanded, setExpanded] = useState(false)

  const severityColor = {
    hard: 'bg-red-100 text-red-700',
    soft: 'bg-yellow-100 text-yellow-700',
    advisory: 'bg-blue-100 text-blue-700'
  }[entry.severity as Severity] || 'bg-gray-100 text-gray-600'

  const enforcementLabel = {
    block: 'Blocks action',
    require_rationale: 'Requires rationale',
    warn: 'Advisory only'
  }[entry.enforcement] || entry.enforcement

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-600">🛡️</span>
            <h4 className="font-medium text-gray-900">{entry.title}</h4>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`px-2 py-0.5 rounded ${severityColor}`}>
              {entry.severity}
            </span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
              {enforcementLabel}
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 ml-2"
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-3">
          {entry.description && (
            <p className="text-sm text-gray-700">{entry.description}</p>
          )}

          {entry.override_protocol && (
            <div>
              <h5 className="text-xs font-medium text-gray-500 uppercase">Override Protocol</h5>
              <p className="text-sm text-gray-700 mt-1">{entry.override_protocol}</p>
            </div>
          )}

          <p className="text-xs text-gray-400">
            Created {new Date(entry.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}

export function ActiveKnowledgeView({ knowledge, loading, error }: ActiveKnowledgeViewProps) {
  const [activeTab, setActiveTab] = useState<'metis' | 'guardrails'>('metis')

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-8 bg-gray-100 rounded animate-pulse w-1/4"></div>
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-lg border p-4 space-y-2 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-1/3"></div>
            <div className="h-3 bg-gray-100 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!knowledge) {
    return (
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-yellow-800 text-sm font-medium">Unable to load knowledge base</p>
        {error && (
          <p className="text-yellow-700 text-xs mt-2">
            {error}
          </p>
        )}
      </div>
    )
  }

  const { metis, guardrails } = knowledge

  const isEmpty = metis.length === 0 && guardrails.length === 0

  if (isEmpty) {
    return (
      <div className="bg-gray-50 rounded-lg border border-dashed p-8 text-center">
        <p className="text-gray-500 text-sm">No active knowledge yet</p>
        <p className="text-gray-400 text-xs mt-1">
          Promote candidates from the review queue to build your knowledge base
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-2 border-b">
        <button
          onClick={() => setActiveTab('metis')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'metis'
              ? 'border-purple-600 text-purple-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Metis ({metis.length})
        </button>
        <button
          onClick={() => setActiveTab('guardrails')}
          className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
            activeTab === 'guardrails'
              ? 'border-orange-600 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Guardrails ({guardrails.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {activeTab === 'metis' && (
          <>
            {metis.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border border-dashed p-6 text-center">
                <p className="text-gray-500 text-sm">No metis entries yet</p>
              </div>
            ) : (
              metis.map(entry => <MetisCard key={entry.id} entry={entry} />)
            )}
          </>
        )}

        {activeTab === 'guardrails' && (
          <>
            {guardrails.length === 0 ? (
              <div className="bg-gray-50 rounded-lg border border-dashed p-6 text-center">
                <p className="text-gray-500 text-sm">No guardrails yet</p>
              </div>
            ) : (
              guardrails.map(entry => <GuardrailCard key={entry.id} entry={entry} />)
            )}
          </>
        )}
      </div>
    </div>
  )
}
