'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContextAwareData } from './ContextAwareDataProvider'
import { EndeavorLogModeView } from './EndeavorLogModeView'
import { DailyFrontMatter } from '../../lib/graph/types'
import { extractBlocksFromBody } from '../../lib/validators'
import { ConditionalDaySelector } from './ConditionalDaySelector'
import { EndeavorMoveButton } from './EndeavorMoveButton'
import { ContextBreadcrumb } from './ContextBreadcrumb'
import { ChangeParentModal } from './ChangeParentModal'
import { getEndeavorLink } from '../../lib/utils/endeavor-links'
import { buildContextAwareBreadcrumbs } from '../../lib/ui/breadcrumb-utils'
import Link from 'next/link'

// Copy short ID button - git-style short hash for easy reference
function CopyShortId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const shortId = id.slice(0, 8)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shortId)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access denied or unavailable
      console.warn('Failed to copy to clipboard')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs text-gray-400 hover:text-gray-600 font-mono bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors"
      title={`Copy short ID: ${shortId}`}
    >
      {copied ? 'copied!' : shortId}
    </button>
  )
}

interface EndeavorPageClientProps {
  id: string
  date: string
  userId: string
  contextId?: string
  initialBody: string
  initialFrontMatter: DailyFrontMatter
  onSaveBodyOnly: (body: string) => Promise<void>
  onApplyReviewEdit: (edit: {
    block: 'done' | 'aims' | 'next' | 'reflection'
    mode: 'append' | 'replace'
    content: string
  }) => Promise<void>
}

export function EndeavorPageClient({
  id,
  date,
  userId,
  contextId: urlContextId,
  initialBody,
  initialFrontMatter,
  onSaveBodyOnly,
  onApplyReviewEdit
}: EndeavorPageClientProps) {
  const { nodes, selectedContextId, ensureNodeIncluded, reloadNodes } = useContextAwareData()

  // Use URL context parameter if available, fall back to selected context
  const effectiveContextId = urlContextId || selectedContextId
  const router = useRouter()
  const [contextAvailabilityChecked, setContextAvailabilityChecked] = useState(false)
  const [showNotFound, setShowNotFound] = useState(false)
  const [showChangeParentModal, setShowChangeParentModal] = useState(false)

  // INTENTIONAL: Auto-switch user's context when viewing cross-context endeavors
  // User explicitly requested this behavior - when accessing an endeavor the user has access to,
  // embrace/inject the endeavor's context so subsequent navigation stays in that context
  useEffect(() => {
    if (urlContextId && urlContextId !== selectedContextId) {
      localStorage.setItem('selectedContextId', urlContextId)
      window.dispatchEvent(new CustomEvent('contextChanged', { detail: { contextId: urlContextId } }))
    }
  }, [urlContextId, selectedContextId])

  // Check context availability and handle isolation
  useEffect(() => {
    const checkContextAvailability = async () => {
      // If server passed urlContextId, the endeavor exists and user has access
      // Trust the server's verification - don't 404 based on client-side node filtering
      if (urlContextId) {
        setContextAvailabilityChecked(true)
        return
      }

      const endeavor = nodes.find(n => n.id === id)

      if (!endeavor) {
        // If we're in personal context (selectedContextId is null), try to ensure the node is included
        if (!effectiveContextId) {
          await ensureNodeIncluded(id)
        } else {
          // If we're in a specific context, the endeavor should already be in the filtered nodes
          // If it's not, that means it's not available in this context
          setShowNotFound(true)
          setContextAvailabilityChecked(true)
          return
        }
      }

      setContextAvailabilityChecked(true)
    }

    checkContextAvailability()
  }, [id, nodes, effectiveContextId, urlContextId, ensureNodeIncluded])

  // Listen for context changes and re-check availability
  useEffect(() => {
    const handleContextChange = () => {
      setContextAvailabilityChecked(false)
      setShowNotFound(false) // Reset not found state on context change
    }

    window.addEventListener('contextChanged', handleContextChange)
    return () => window.removeEventListener('contextChanged', handleContextChange)
  }, [id])

  // Find the specific endeavor in the context-filtered nodes
  const endeavor = nodes.find(n => n.id === id)

  // Show not found state if endeavor is not available in context
  if (showNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-300">404</h1>
            <h2 className="text-2xl font-semibold text-gray-900 mt-4">Endeavor Not Available</h2>
            <p className="text-gray-600 mt-2">
              This endeavor isn&apos;t available in the current context. Switch to a different context to see all your endeavors.
            </p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!contextAvailabilityChecked || !endeavor) {
    return <div>Loading endeavor...</div>
  }

  // Extract validation blocks
  const blocks = extractBlocksFromBody(initialBody)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Context indicators */}
          <div className="flex items-center gap-4 mb-2">
            <ContextBreadcrumb contextId={effectiveContextId} />
          </div>

          {/* Breadcrumb navigation - context-aware */}
          <nav className="text-sm text-gray-600 mb-2 flex flex-wrap items-center gap-1">
            {(() => {
              // Use the context-aware breadcrumb utility
              const breadcrumbs = buildContextAwareBreadcrumbs(endeavor, nodes)

              return breadcrumbs.map((ancestor) => (
                <span key={ancestor.id}>
                  <Link href={getEndeavorLink(ancestor.id, date)} className="hover:underline">
                    {ancestor.title || ancestor.id}
                  </Link>
                  <span className="mx-2">→</span>
                </span>
              ))
            })()}
            <Link href={getEndeavorLink(id, date)} className="hover:underline">{endeavor.title || endeavor.id}</Link>
          </nav>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold">
              {endeavor.title || endeavor.id}
            </h1>
            <CopyShortId id={id} />
          </div>

          {/* Parent section - show for non-Missions */}
          {endeavor.node_type?.toLowerCase() !== 'mission' && (
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <span>Parent:</span>
              {endeavor.parent_id ? (
                (() => {
                  const parentNode = nodes.find(n => n.id === endeavor.parent_id)
                  return parentNode ? (
                    <Link
                      href={getEndeavorLink(parentNode.id, date)}
                      className="text-blue-600 hover:underline"
                    >
                      {parentNode.title || parentNode.id}
                    </Link>
                  ) : (
                    <span className="text-gray-400">{endeavor.parent_id}</span>
                  )
                })()
              ) : (
                <span className="text-gray-400 italic">None (root level)</span>
              )}
              {!endeavor.archived_at && (
                <button
                  onClick={() => setShowChangeParentModal(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                >
                  [Edit]
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <EndeavorMoveButton
            endeavorId={id}
            endeavorTitle={endeavor.title || endeavor.id}
            currentContextId={effectiveContextId || `personal:${userId}`}
            onMoved={() => router.refresh()}
          />
          <ConditionalDaySelector currentDate={date} basePath={`/endeavor/${encodeURIComponent(id)}`} />
        </div>
      </div>

      <EndeavorLogModeView
        endeavor={endeavor}
        date={date}
        body={initialBody}
        fm={initialFrontMatter}
        blocks={blocks}
        allNodes={nodes}
        userId={userId}
        onSaveBody={onSaveBodyOnly}
        onApplyReviewEdit={onApplyReviewEdit}
      />

      <ChangeParentModal
        visible={showChangeParentModal}
        onHide={() => setShowChangeParentModal(false)}
        endeavorId={id}
        endeavorTitle={endeavor.title || endeavor.id}
        currentParentId={endeavor.parent_id}
        nodeType={endeavor.node_type as any}
        allNodes={nodes}
        onChanged={() => { reloadNodes(); router.refresh() }}
      />
    </div>
  )
}