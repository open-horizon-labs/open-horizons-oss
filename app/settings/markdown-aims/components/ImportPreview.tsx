'use client'

import { useState, useMemo, useEffect } from 'react'
import { UpsertPlan, UpsertAction } from '../../../../lib/import/types'
import { getRoleIcon } from '../../../../lib/constants/icons'

interface ImportPreviewProps {
  plan: UpsertPlan
  sourceFile?: string
  onSelectionChange?: (selectedActions: UpsertAction[]) => void
}

export function ImportPreview({ plan, sourceFile, onSelectionChange }: ImportPreviewProps) {
  const [selectedAction, setSelectedAction] = useState<UpsertAction>()
  const [showDetails, setShowDetails] = useState(false)
  const [selectedActionIds, setSelectedActionIds] = useState<Set<number>>(
    new Set(plan.actions.map((_, i) => i)) // Default: select all
  )
  const [actionOverrides, setActionOverrides] = useState<Map<number, Partial<UpsertAction>>>(new Map())

  const selectedActions = useMemo(() => {
    return plan.actions
      .map((action, i) => {
        const override = actionOverrides.get(i)
        return override ? { ...action, ...override } : action
      })
      .filter((_, i) => selectedActionIds.has(i))
  }, [plan.actions, selectedActionIds, actionOverrides])

  // Notify parent when selection changes
  useEffect(() => {
    console.log('ImportPreview selectedActions changed:', selectedActions.length, selectedActions)
    onSelectionChange?.(selectedActions)
  }, [selectedActions, onSelectionChange])

  const toggleAction = (index: number) => {
    const newSelected = new Set(selectedActionIds)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedActionIds(newSelected)
  }

  const selectAll = () => {
    setSelectedActionIds(new Set(plan.actions.map((_, i) => i)))
  }

  const selectNone = () => {
    setSelectedActionIds(new Set())
  }

  const actionCounts = plan.actions.reduce((acc, action) => {
    acc[action.action] = (acc[action.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return '➕'
      case 'UPDATE': return '🔄'
      case 'REVIEW': return '🔍'
      case 'SKIP': return '⏭️'
      default: return '❓'
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'text-green-600 bg-green-50 border-green-200'
      case 'UPDATE': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'REVIEW': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'SKIP': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getArtifactTypeIcon = (tags: string[]) => {
    // Get the first tag which should be the role/type
    const primaryTag = tags?.[0] || ''
    
    return getRoleIcon(primaryTag)
  }

  const hasBlockingErrors = false // No validation errors in simplified import system

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Import Preview</h2>
          {sourceFile && (
            <p className="text-sm text-gray-600 mt-1">Source: {sourceFile}</p>
          )}
        </div>
        
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(actionCounts).map(([action, count]) => (
            <div key={action} className="text-center">
              <div className="text-2xl mb-1">{getActionIcon(action)}</div>
              <div className="text-xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-600 capitalize">{action.toLowerCase()}</div>
            </div>
          ))}
        </div>
      </div>


      {/* Warnings */}
      {plan.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-medium text-yellow-800 mb-3 flex items-center">
            ⚠️ Warnings
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1">
            {plan.warnings.map((warning, i) => (
              <li key={i} className="flex items-start">
                <span className="mr-2 mt-0.5">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">
            Planned Actions ({selectedActions.length} of {plan.actions.length} selected)
          </h3>
          <div className="flex items-center space-x-3">
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Select None
            </button>
          </div>
        </div>
        
        <div className="space-y-2">
          {plan.actions.map((action, i) => {
            const isSelected = selectedActionIds.has(i)
            const override = actionOverrides.get(i)
            const effectiveAction = override ? { ...action, ...override } : action
            return (
              <div
                key={i}
                className={`border rounded-lg p-4 transition-colors ${
                  selectedAction === action
                    ? 'ring-2 ring-blue-500 bg-blue-50'
                    : 'hover:bg-gray-50'
                } ${getActionColor(effectiveAction.action)} ${
                  isSelected ? 'opacity-100' : 'opacity-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAction(i)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{getActionIcon(action.action)}</span>
                      <span className="text-lg">{getArtifactTypeIcon(action.endeavor.tags || [])}</span>
                    </div>
                    <div
                      className="cursor-pointer flex-1"
                      onClick={() => setSelectedAction(selectedAction === action ? undefined : action)}
                    >
                      <div className="font-medium text-gray-900">
                        {action.endeavor.title}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {action.endeavor.summary && action.endeavor.summary.length > 100
                          ? `${action.endeavor.summary.substring(0, 100)}...`
                          : action.endeavor.summary}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`text-xs px-2 py-1 rounded font-medium ${getActionColor(effectiveAction.action)}`}>
                    {effectiveAction.action}{override ? ' (overridden)' : ''}
                  </div>
                  {action.match_confidence && (
                    <div className="text-xs text-gray-500 mt-1">
                      {(action.match_confidence * 100).toFixed(1)}% match
                    </div>
                  )}
                </div>

                {selectedAction === action && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  {/* Endeavor Details */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-2">Endeavor Details</h4>
                    <div className="bg-white rounded p-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">ID:</span>
                        <span className="font-mono">{action.endeavor.id}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Slug:</span>
                        <span className="font-mono">{action.endeavor.slug}</span>
                      </div>
                      {action.endeavor.tags && action.endeavor.tags.length > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Tags:</span>
                          <span>{action.endeavor.tags.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Match Information */}
                  {action.matched_node_id && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Match Information</h4>
                      <div className="bg-white rounded p-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Matched Node:</span>
                          <span className="font-mono">{action.matched_node_id}</span>
                        </div>
                        {action.match_confidence && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Confidence:</span>
                            <span>{(action.match_confidence * 100).toFixed(1)}%</span>
                          </div>
                        )}
                        {action.rationale && (
                          <div className="text-sm">
                            <span className="text-gray-600">Rationale:</span>
                            <p className="mt-1 text-gray-800">{action.rationale}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Action Override for REVIEW items */}
                  {action.action === 'REVIEW' && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Action Decision</h4>
                      <div className="bg-white rounded p-3">
                        <p className="text-sm text-gray-700 mb-3">
                          The system found a potential match. Choose how to proceed:
                        </p>
                        <div className="space-y-2">
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`action-${i}`}
                              value="UPDATE"
                              checked={effectiveAction.action === 'UPDATE'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setActionOverrides(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(i, { action: 'UPDATE' as const })
                                    return newMap
                                  })
                                }
                              }}
                              className="mr-2 h-4 w-4 text-blue-600"
                            />
                            <span className="text-sm">
                              <strong>Update existing:</strong> The match is correct, update the existing endeavor with this content
                            </span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`action-${i}`}
                              value="INSERT"
                              checked={effectiveAction.action === 'INSERT'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setActionOverrides(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(i, { 
                                      action: 'INSERT' as const, 
                                      matched_node_id: undefined, 
                                      match_confidence: undefined, 
                                      rationale: undefined 
                                    })
                                    return newMap
                                  })
                                }
                              }}
                              className="mr-2 h-4 w-4 text-blue-600"
                            />
                            <span className="text-sm">
                              <strong>Create new:</strong> The match is wrong, create this as a new endeavor instead
                            </span>
                          </label>
                          <label className="flex items-center">
                            <input 
                              type="radio" 
                              name={`action-${i}`}
                              value="SKIP"
                              checked={effectiveAction.action === 'SKIP'}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setActionOverrides(prev => {
                                    const newMap = new Map(prev)
                                    newMap.set(i, { action: 'SKIP' as const })
                                    return newMap
                                  })
                                }
                              }}
                              className="mr-2 h-4 w-4 text-blue-600"
                            />
                            <span className="text-sm">
                              <strong>Skip:</strong> Don&apos;t import this endeavor at all
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Raw Markdown */}
                  {showDetails && action.endeavor.body_md && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Source Markdown</h4>
                      <pre className="bg-gray-100 rounded p-3 text-xs overflow-x-auto">
                        {action.endeavor.body_md}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
          })}
        </div>
      </div>

      {/* Parent Relationships Summary */}
      {showDetails && (
        <div>
          <h3 className="font-medium text-gray-900 mb-3">Parent Relationships ({plan.edges.filter((e: any) => e.kind === 'supports').length})</h3>
          <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
            {plan.edges.filter((edge: any) => edge.kind === 'supports').map((edge: any, i: number) => (
              <div key={i} className="text-sm py-1 border-b border-gray-200 last:border-b-0">
                <div className="font-mono text-xs text-gray-600 truncate">
                  {edge.from_id}
                </div>
                <div className="text-center text-gray-500 text-xs">
                  parent → {edge.to_id} ({(edge.confidence * 100).toFixed(0)}%)
                </div>
              </div>
            ))}
            {plan.edges.filter((edge: any) => edge.kind !== 'supports').length > 0 && (
              <div className="mt-2 p-2 bg-yellow-100 rounded text-xs text-yellow-700">
                Note: {plan.edges.filter((edge: any) => edge.kind !== 'supports').length} other relationship types will be ignored in the new parent-based model.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}