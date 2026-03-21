'use client'

import { UpsertPlan, ImportOptions } from '../../../../lib/import/types'

interface CommitDialogProps {
  plan: UpsertPlan
  options: Partial<ImportOptions>
  onCommit: () => void
  onCancel: () => void
  isProcessing: boolean
}

export function CommitDialog({ plan, options, onCommit, onCancel, isProcessing }: CommitDialogProps) {
  const actionCounts = plan.actions.reduce((acc, action) => {
    acc[action.action] = (acc[action.action] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const hasReviewItems = actionCounts.REVIEW > 0
  const hasUpdateItems = actionCounts.UPDATE > 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <div className="text-2xl">⚠️</div>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Confirm Import Changes
        </h2>
        <p className="text-gray-600 max-w-lg mx-auto">
          You&apos;re about to make changes to your graph. This is an <strong>all-or-nothing</strong> operation - either all changes succeed or none are applied.
        </p>
      </div>

      {/* Change Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium text-gray-900 mb-3">Changes Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {Object.entries(actionCounts).map(([action, count]) => {
            const colors = {
              INSERT: 'text-green-600',
              UPDATE: 'text-blue-600', 
              REVIEW: 'text-yellow-600',
              SKIP: 'text-gray-600'
            }[action] || 'text-gray-600'
            
            return (
              <div key={action}>
                <div className={`text-2xl font-bold ${colors}`}>{count}</div>
                <div className="text-sm text-gray-600 capitalize">{action.toLowerCase()}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Impact Summary */}
      <div className="space-y-3">
        <h3 className="font-medium text-gray-900">What will happen:</h3>
        <div className="space-y-2 text-sm">
          {actionCounts.INSERT > 0 && (
            <div className="flex items-start space-x-2">
              <span className="text-green-600 mt-0.5">➕</span>
              <span>
                <strong>{actionCounts.INSERT}</strong> new endeavor{actionCounts.INSERT > 1 ? 's' : ''} will be created
              </span>
            </div>
          )}
          
          {actionCounts.UPDATE > 0 && (
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 mt-0.5">🔄</span>
              <span>
                <strong>{actionCounts.UPDATE}</strong> existing endeavor{actionCounts.UPDATE > 1 ? 's' : ''} will be updated
              </span>
            </div>
          )}

          {actionCounts.REVIEW > 0 && (
            <div className="flex items-start space-x-2">
              <span className="text-yellow-600 mt-0.5">🔍</span>
              <span>
                <strong>{actionCounts.REVIEW}</strong> item{actionCounts.REVIEW > 1 ? 's' : ''} flagged for manual review
                {options.upsert_policy?.auto_link ? ' (will be auto-linked)' : ''}
              </span>
            </div>
          )}


          <div className="flex items-start space-x-2">
            <span className="text-indigo-600 mt-0.5">↗️</span>
            <span>
              <strong>{plan.edges.filter((e: any) => e.kind === 'supports').length}</strong> parent relationship{plan.edges.filter((e: any) => e.kind === 'supports').length !== 1 ? 's' : ''} will be created
              {plan.edges.filter((e: any) => e.kind !== 'supports').length > 0 && (
                <span className="text-yellow-600 text-sm block">
                  ({plan.edges.filter((e: any) => e.kind !== 'supports').length} other relationships will be ignored)
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Warnings */}
      {(hasReviewItems || hasUpdateItems) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">⚠️ Important Notes</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>Transaction-based:</strong> If any part fails, all changes are rolled back automatically.</li>
            {hasUpdateItems && (
              <li>• Existing content will be modified. This action cannot be easily undone.</li>
            )}
            {hasReviewItems && !options.upsert_policy?.auto_link && (
              <li>• Items marked for review will be created as new content. You can merge them manually later.</li>
            )}
            {hasReviewItems && options.upsert_policy?.auto_link && (
              <li>• Review items will be automatically linked due to auto-link setting.</li>
            )}
            <li>• All changes will include full provenance tracking for audit purposes.</li>
          </ul>
        </div>
      )}

      {/* Settings Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Import Settings</h4>
        <div className="text-sm text-blue-700 space-y-1">
          <div>• Merge titles: {options.upsert_policy?.merge_titles ? 'Yes' : 'No'}</div>
          <div>• Overwrite outcomes: {options.upsert_policy?.overwrite_outcome ? 'Yes' : 'No'}</div>
          <div>• Auto-link review band: {options.upsert_policy?.auto_link ? 'Yes' : 'No'}</div>
          <div>• Update threshold: {((options.upsert_policy?.similarity_threshold?.update || 0.87) * 100).toFixed(0)}%</div>
          <div>• Review threshold: {((options.upsert_policy?.similarity_threshold?.review_band || 0.78) * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <button
          onClick={onCancel}
          disabled={isProcessing}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
        >
          ← Back to Preview
        </button>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            onClick={onCommit}
            disabled={isProcessing}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>Execute Import</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
          <div className="text-blue-800 text-sm">
            🔄 Processing import... This may take a few seconds.
          </div>
        </div>
      )}
    </div>
  )
}