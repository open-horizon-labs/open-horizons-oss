'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface ContextAwarePageWrapperProps {
  children: React.ReactNode
  currentContext?: string
}

/**
 * This wrapper detects URL context changes and forces a page reload
 * to ensure server components re-render with the new context.
 */
export function ContextAwarePageWrapper({ children, currentContext }: ContextAwarePageWrapperProps) {
  const searchParams = useSearchParams()
  const urlContext = searchParams?.get('context')

  useEffect(() => {
    // If URL context differs from server-rendered context, force reload
    if (urlContext !== currentContext) {
      window.location.href = window.location.href
    }
  }, [urlContext, currentContext])

  return <>{children}</>
}