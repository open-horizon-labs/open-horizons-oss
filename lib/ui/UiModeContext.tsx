'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type UiMode = 'aim' | 'do' | 'reflect'

interface UiModeContextType {
  mode: UiMode
  setMode: (mode: UiMode) => void
  toggleMode: () => void
}

const UiModeContext = createContext<UiModeContextType | undefined>(undefined)

const UI_MODE_STORAGE_KEY = 'open-horizons-ui-mode'

interface UiModeProviderProps {
  children: ReactNode
  defaultMode?: UiMode
}

export function UiModeProvider({ children, defaultMode = 'do' }: UiModeProviderProps) {
  const [mode, setModeState] = useState<UiMode>(defaultMode)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(UI_MODE_STORAGE_KEY) as UiMode | null
    if (stored && (stored === 'aim' || stored === 'do' || stored === 'reflect')) {
      setModeState(stored)
    }
    setIsLoaded(true)
  }, [])

  // Save mode to localStorage when it changes
  const setMode = (newMode: UiMode) => {
    setModeState(newMode)
    localStorage.setItem(UI_MODE_STORAGE_KEY, newMode)
  }

  const toggleMode = () => {
    // Cycle through Aim → Do → Reflect → Aim
    if (mode === 'aim') setMode('do')
    else if (mode === 'do') setMode('reflect') 
    else setMode('aim')
  }

  const value = {
    mode,
    setMode,
    toggleMode
  }

  // Don't render children until we've loaded from localStorage to prevent hydration mismatch
  if (!isLoaded) {
    return null
  }

  return (
    <UiModeContext.Provider value={value}>
      {children}
    </UiModeContext.Provider>
  )
}

export function useUiMode(): UiModeContextType {
  const context = useContext(UiModeContext)
  if (!context) {
    throw new Error('useUiMode must be used within a UiModeProvider')
  }
  return context
}

/**
 * Higher-order component to conditionally render content based on UI mode
 */
interface ConditionalRenderProps {
  children: ReactNode
  mode: UiMode
}

export function ShowInMode({ children, mode: targetMode }: ConditionalRenderProps) {
  const { mode } = useUiMode()
  return mode === targetMode ? <>{children}</> : null
}

/**
 * Component for mode-aware styling
 */
interface ModeAwareProps {
  children: (mode: UiMode) => ReactNode
}

export function ModeAware({ children }: ModeAwareProps) {
  const { mode } = useUiMode()
  return <>{children(mode)}</>
}