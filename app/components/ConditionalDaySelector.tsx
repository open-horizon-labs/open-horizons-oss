'use client'

import { useUiMode } from '../../lib/ui/UiModeContext'
import { DaySelector } from './DaySelector'

interface ConditionalDaySelectorProps {
  currentDate: string
  basePath: string
}

export function ConditionalDaySelector({ currentDate, basePath }: ConditionalDaySelectorProps) {
  const { mode } = useUiMode()

  // Always render the container to prevent layout jumping, but hide content in Aim and Reflect modes
  return (
    <div className="min-h-[2.5rem] flex items-center justify-end">
      {mode === 'do' && (
        <DaySelector
          currentDate={currentDate}
          basePath={basePath}
        />
      )}
    </div>
  )
}