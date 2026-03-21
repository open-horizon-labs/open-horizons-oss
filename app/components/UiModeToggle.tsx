'use client'

import { useUiMode } from '../../lib/ui/UiModeContext'

interface UiModeToggleProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function UiModeToggle({ className = '', size = 'md' }: UiModeToggleProps) {
  const { mode, toggleMode } = useUiMode()

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base'
  }

  return (
    <button
      onClick={toggleMode}
      className={`
        inline-flex items-center gap-2 rounded-md font-medium transition-colors
        ${sizeClasses[size]}
        ${mode === 'aim'
          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          : mode === 'do'
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          : 'bg-green-100 text-green-700 hover:bg-green-200'
        }
        ${className}
      `}
      title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode. Click to cycle through modes.`}
    >
      {mode === 'aim' ? (
        <>
          Target <span>Aim</span>
        </>
      ) : mode === 'do' ? (
        <>
          Lightning <span>Do</span>
        </>
      ) : (
        <>
          Think <span>Reflect</span>
        </>
      )}
    </button>
  )
}

/**
 * Compact toggle for use in headers or tight spaces
 */
export function CompactUiModeToggle({ className = '' }: { className?: string }) {
  const { mode, toggleMode } = useUiMode()

  return (
    <button
      onClick={toggleMode}
      className={`
        inline-flex items-center gap-2 px-3 py-2 rounded-md transition-colors font-medium text-sm
        ${mode === 'aim'
          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
          : mode === 'do'
          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          : 'bg-green-100 text-green-700 hover:bg-green-200'
        }
        ${className}
      `}
      title={`${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode`}
    >
      {mode === 'aim' ? (
        <>Target <span>Aim</span></>
      ) : mode === 'do' ? (
        <>Lightning <span>Do</span></>
      ) : (
        <>Think <span>Reflect</span></>
      )}
    </button>
  )
}
