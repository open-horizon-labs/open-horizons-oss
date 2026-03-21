'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface EndeavorMatch {
  id: string
  title: string
}

/**
 * QuickNav - Jump to endeavor by short ID (git-style)
 *
 * Paste or type a short ID (e.g., "bc4a860b") to navigate directly to an endeavor.
 * Opens with Cmd+K / Ctrl+K keyboard shortcut.
 */
export function QuickNav() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Keyboard shortcut: Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        setQuery('')
        setError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      // Try to fetch the endeavor by short ID
      const res = await fetch(`/api/endeavors/${encodeURIComponent(query.trim())}`)
      const data = await res.json()

      if (!res.ok) {
        if (data.matches) {
          // Ambiguous match
          setError(`Ambiguous: ${data.matches.map((m: EndeavorMatch) => m.title).join(', ')}`)
        } else {
          setError(data.error || 'Not found')
        }
        return
      }

      // Navigate to the endeavor
      const endeavorId = data.endeavor.id
      router.push(`/endeavor/${encodeURIComponent(endeavorId)}`)
      setIsOpen(false)
      setQuery('')
    } catch (err) {
      setError('Failed to lookup')
    } finally {
      setLoading(false)
    }
  }, [query, router])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 hover:border-gray-300 transition-colors"
        title="Quick nav (Cmd+K)"
      >
        <span className="hidden sm:inline">Go to ID </span>
        <kbd className="font-mono text-[10px] bg-gray-100 px-1 rounded">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setIsOpen(false)}>
      <div className="absolute inset-0 bg-black/20" />
      <div
        className="relative bg-white rounded-lg shadow-xl border w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Quick navigation"
      >
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setError(null) }}
            placeholder="Paste ID (e.g., bc4a860b or full UUID)"
            className="w-full px-4 py-3 text-lg font-mono border-b focus:outline-none rounded-t-lg"
            autoComplete="off"
            spellCheck={false}
          />
        </form>
        {error && (
          <div className="px-4 py-2 text-sm text-red-600 bg-red-50">
            {error}
          </div>
        )}
        {loading && (
          <div className="px-4 py-2 text-sm text-gray-500">
            Looking up...
          </div>
        )}
        <div className="px-4 py-2 text-xs text-gray-400 border-t">
          Enter to navigate • Esc to close
        </div>
      </div>
    </div>
  )
}
