'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContextAwareData } from './ContextAwareDataProvider'
import { EndeavorDetailClient } from './EndeavorDetailClient'
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
}

export function EndeavorPageClient({
  id,
  date,
  userId,
  contextId: urlContextId,
}: EndeavorPageClientProps) {
  const { nodes, selectedContextId, ensureNodeIncluded, reloadNodes } = useContextAwareData()

  // Use URL context parameter if available, fall back to selected context
  const effectiveContextId = urlContextId || selectedContextId
  const router = useRouter()
  const [contextAvailabilityChecked, setContextAvailabilityChecked] = useState(false)
  const [showNotFound, setShowNotFound] = useState(false)
  const [showChangeParentModal, setShowChangeParentModal] = useState(false)

  // Auto-switch user's context when viewing cross-context endeavors
  useEffect(() => {
    if (urlContextId && urlContextId !== selectedContextId) {
      localStorage.setItem('selectedContextId', urlContextId)
      window.dispatchEvent(new CustomEvent('contextChanged', { detail: { contextId: urlContextId } }))
    }
  }, [urlContextId, selectedContextId])

  // Check context availability
  useEffect(() => {
    const checkContextAvailability = async () => {
      if (urlContextId) {
        setContextAvailabilityChecked(true)
        return
      }

      const endeavor = nodes.find(n => n.id === id)

      if (!endeavor) {
        if (!effectiveContextId) {
          await ensureNodeIncluded(id)
        } else {
          setShowNotFound(true)
          setContextAvailabilityChecked(true)
          return
        }
      }

      setContextAvailabilityChecked(true)
    }

    checkContextAvailability()
  }, [id, nodes, effectiveContextId, urlContextId, ensureNodeIncluded])

  // Listen for context changes
  useEffect(() => {
    const handleContextChange = () => {
      setContextAvailabilityChecked(false)
      setShowNotFound(false)
    }

    window.addEventListener('contextChanged', handleContextChange)
    return () => window.removeEventListener('contextChanged', handleContextChange)
  }, [id])

  const endeavor = nodes.find(n => n.id === id)

  if (showNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-gray-300">404</h1>
            <h2 className="text-2xl font-semibold text-gray-900 mt-4">Endeavor Not Available</h2>
            <p className="text-gray-600 mt-2">
              This endeavor isn&apos;t available in the current context.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!contextAvailabilityChecked || !endeavor) {
    return <div>Loading endeavor...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          {/* Context indicators */}
          <div className="flex items-center gap-4 mb-2">
            <ContextBreadcrumb contextId={effectiveContextId} />
          </div>

          {/* Breadcrumb navigation */}
          <nav className="text-sm text-gray-600 mb-2 flex flex-wrap items-center gap-1">
            {(() => {
              const breadcrumbs = buildContextAwareBreadcrumbs(endeavor, nodes)
              return breadcrumbs.map((ancestor) => (
                <span key={ancestor.id}>
                  <Link href={getEndeavorLink(ancestor.id, date)} className="hover:underline">
                    {ancestor.title || ancestor.id}
                  </Link>
                  <span className="mx-2">&rarr;</span>
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
      </div>

      {/* Endeavor detail with description editor */}
      <EndeavorDetailClient
        node={endeavor as any}
        allNodes={nodes as any}
        userId={userId}
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
