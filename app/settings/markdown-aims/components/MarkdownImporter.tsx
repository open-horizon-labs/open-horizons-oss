'use client'

import { useState, useCallback } from 'react'
import { MarkdownInput } from './MarkdownInput'
import { ImportPreview } from './ImportPreview'
import { ImportSettings } from './ImportSettings'
import { CommitDialog } from './CommitDialog'
import { UpsertPlan, ImportReport, ImportOptions, UpsertAction } from '../../../../lib/import/types'

type Step = 'input' | 'preview' | 'commit' | 'complete'

export function MarkdownImporter() {
  const [step, setStep] = useState<Step>('input')
  const [markdown, setMarkdown] = useState('')
  const [sourceFile, setSourceFile] = useState<string>()
  const [importOptions, setImportOptions] = useState<Partial<ImportOptions>>({
    dry_run: true,
    upsert_policy: {
      merge_titles: true,
      overwrite_outcome: false,
      auto_link: false,
      similarity_threshold: {
        update: 0.87,
        review_band: 0.78
      }
    }
  })
  
  const [isProcessing, setIsProcessing] = useState(false)
  const [preview, setPreview] = useState<UpsertPlan>()
  const [selectedActions, setSelectedActions] = useState<UpsertAction[]>([])
  const [report, setReport] = useState<ImportReport>()
  const [error, setError] = useState<string>()

  const handleMarkdownSubmit = useCallback(async (content: string, fileName?: string) => {
    if (!content.trim()) {
      setError('Please provide markdown content')
      return
    }

    setMarkdown(content)
    setSourceFile(fileName)
    setIsProcessing(true)
    setError(undefined)

    try {
      // Generate preview
      const response = await fetch('/api/import/markdown-aims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          markdown: content,
          options: {
            ...importOptions,
            source_uri: fileName,
            dry_run: true
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Preview generation failed')
      }

      if (data.success && data.preview) {
        setPreview(data.preview)
        setStep('preview')
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsProcessing(false)
    }
  }, [importOptions])

  const handleSettingsChange = useCallback((options: Partial<ImportOptions>) => {
    setImportOptions(prev => ({
      ...prev,
      ...options,
      upsert_policy: {
        ...prev.upsert_policy,
        ...options.upsert_policy
      }
    }))
  }, [])

  const handleCommit = useCallback(async () => {
    console.log('handleCommit called', { preview: !!preview, selectedActionsLength: selectedActions.length, selectedActions })
    if (!preview || selectedActions.length === 0) {
      console.log('Early return from handleCommit - no preview or no selected actions')
      return
    }

    setIsProcessing(true)
    setError(undefined)

    try {
      const response = await fetch('/api/import/markdown-aims/commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plan: {
            ...preview,
            actions: selectedActions
          },
          options: {
            ...importOptions,
            source_uri: sourceFile,
            dry_run: false
          }
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import execution failed')
      }

      if (data.success && data.report) {
        setReport(data.report)
        setStep('complete')
      } else {
        throw new Error('Unexpected response format')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setIsProcessing(false)
    }
  }, [preview, importOptions, sourceFile, selectedActions])

  const handleStartOver = useCallback(() => {
    setStep('input')
    setMarkdown('')
    setSourceFile(undefined)
    setPreview(undefined)
    setReport(undefined)
    setError(undefined)
  }, [])

  const handleBackToPreview = useCallback(() => {
    setStep('preview')
    setError(undefined)
  }, [])

  // Progress indicator
  const getStepNumber = (currentStep: Step) => {
    switch (currentStep) {
      case 'input': return 1
      case 'preview': return 2
      case 'commit': return 3
      case 'complete': return 4
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="bg-gray-50 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            {['input', 'preview', 'commit', 'complete'].map((stepName, index) => {
              const stepNum = index + 1
              const currentStepNum = getStepNumber(step)
              const isActive = stepNum === currentStepNum
              const isComplete = stepNum < currentStepNum
              
              return (
                <div key={stepName} className="flex items-center">
                  <div className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isActive 
                      ? 'bg-blue-600 text-white' 
                      : isComplete 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-200 text-gray-500'}
                  `}>
                    {isComplete ? '✓' : stepNum}
                  </div>
                  {index < 3 && (
                    <div className={`w-16 h-0.5 ml-2 ${
                      stepNum < currentStepNum ? 'bg-green-500' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {step === 'input' && 'Paste or upload your markdown content'}
          {step === 'preview' && 'Review planned changes and configure import settings'}
          {step === 'commit' && 'Confirm and execute the import'}
          {step === 'complete' && 'Import completed successfully'}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="text-red-400 mr-3 mt-0.5">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">Import Error</h3>
              <p className="text-sm text-red-700">{error}</p>
              {step === 'preview' && (
                <button 
                  onClick={() => setStep('input')}
                  className="mt-2 text-sm text-red-600 underline hover:text-red-800"
                >
                  ← Back to input
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="border rounded-lg bg-white">
        {step === 'input' && (
          <MarkdownInput
            onSubmit={handleMarkdownSubmit}
            isProcessing={isProcessing}
            initialContent={markdown}
          />
        )}

        {step === 'preview' && preview && (
          <div className="space-y-6">
            <ImportPreview 
              plan={preview}
              sourceFile={sourceFile}
              onSelectionChange={setSelectedActions}
            />
            
            <div className="border-t pt-6">
              <ImportSettings
                options={importOptions}
                onChange={handleSettingsChange}
              />
            </div>

            <div className="flex items-center justify-between pt-6 border-t">
              <button
                onClick={() => setStep('input')}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                ← Back to input
              </button>
              
              <div className="flex items-center space-x-3">
                {selectedActions.length === 0 ? (
                  <div className="text-sm text-gray-600">
                    Select at least one item to import
                  </div>
                ) : (
                  <button
                    onClick={() => setStep('commit')}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    disabled={isProcessing}
                  >
                    {isProcessing ? 'Processing...' : `Import ${selectedActions.length} Item${selectedActions.length !== 1 ? 's' : ''}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 'commit' && preview && (
          <CommitDialog
            plan={preview}
            options={importOptions}
            onCommit={handleCommit}
            onCancel={handleBackToPreview}
            isProcessing={isProcessing}
          />
        )}

        {step === 'complete' && report && (
          <div className="p-6 space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="text-2xl text-green-600">✅</div>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Import Completed Successfully
              </h2>
              <p className="text-gray-600">
                Your markdown content has been imported into your graph.
              </p>
            </div>

            {/* Import Report Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">Import Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{report.summary.created}</div>
                  <div className="text-gray-600">Created</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-600">{report.summary.updated}</div>
                  <div className="text-gray-600">Updated</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-600">{report.summary.review_required}</div>
                  <div className="text-gray-600">Need Review</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600">{report.summary.failed}</div>
                  <div className="text-gray-600">Failed</div>
                </div>
              </div>
            </div>

            {report.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 mb-2">Warnings</h4>
                <ul className="text-sm text-yellow-700 space-y-1">
                  {report.warnings.map((warning, i) => (
                    <li key={i}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Errors</h4>
                <ul className="text-sm text-red-700 space-y-1">
                  {report.errors.map((error, i) => (
                    <li key={i}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-center space-x-4">
              <button
                onClick={handleStartOver}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Import Another File
              </button>
              <a
                href="/dashboard"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}