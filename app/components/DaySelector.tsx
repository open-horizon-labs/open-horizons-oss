'use client'

import Link from 'next/link'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useState } from 'react'

interface DaySelectorProps {
  currentDate: string
  basePath?: string // Custom path prefix (e.g., "/endeavors/123/daily")
}

export function DaySelector({ currentDate, basePath }: DaySelectorProps) {
  const [showCalendar, setShowCalendar] = useState(false)
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  
  const date = new Date(currentDate)
  const yesterday = new Date(date)
  yesterday.setDate(date.getDate() - 1)
  
  const tomorrow = new Date(date)
  tomorrow.setDate(date.getDate() + 1)
  
  const today = new Date()
  const isToday = currentDate === today.toISOString().slice(0, 10)
  
  const formatDate = (date: Date) => date.toISOString().slice(0, 10)
  const formatDisplay = (date: Date) => {
    const today = new Date()
    const diffTime = date.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Today'
    if (diffDays === -1) return 'Yesterday'
    if (diffDays === 1) return 'Tomorrow'
    if (diffDays > 1) return `In ${diffDays} days`
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`
    
    return date.toLocaleDateString()
  }
  
  const buildUrl = (dateStr: string) => {
    const context = searchParams.get('context')
    if (basePath && basePath.includes('/endeavors/')) {
      // For endeavor-specific pages: /endeavors/123?date=2024-01-15&context=...
      const endeavorPath = basePath.replace('/daily', '')
      const queryParams = new URLSearchParams()
      queryParams.set('date', dateStr)
      if (context) queryParams.set('context', context)
      return `${endeavorPath}?${queryParams.toString()}`
    }
    // For global daily logs: /daily/2024-01-15?context=...
    return `/daily/${dateStr}${context ? `?context=${context}` : ''}`
  }

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = event.target.value
    if (selectedDate) {
      router.push(buildUrl(selectedDate))
      setShowCalendar(false)
    }
  }
  
  return (
    <div className="flex items-center gap-2">
      <Link
        href={buildUrl(formatDate(yesterday))}
        className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 w-28 text-center"
        title={formatDisplay(yesterday)}
      >
        ← {formatDisplay(yesterday)}
      </Link>
      
      <div className="relative">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="px-3 py-1 rounded border text-sm font-medium bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100 cursor-pointer flex items-center justify-center gap-1 w-28"
          title="Click to select date"
        >
          {formatDisplay(date)}
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>
        
        {showCalendar && (
          <div className="absolute top-full left-0 mt-1 z-50">
            <input
              type="date"
              value={currentDate}
              onChange={handleDateChange}
              className="px-3 py-2 border rounded shadow-lg bg-white"
              autoFocus
              onBlur={() => setShowCalendar(false)}
            />
          </div>
        )}
      </div>
      
      <Link
        href={buildUrl(formatDate(tomorrow))}
        className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-800 w-28 text-center"
        title={formatDisplay(tomorrow)}
      >
        {formatDisplay(tomorrow)} →
      </Link>
      
      {!isToday && (
        <Link
          href={buildUrl(formatDate(today))}
          className="px-3 py-1 rounded border text-sm bg-white hover:bg-gray-50 text-blue-600 hover:text-blue-800"
        >
          Jump to Today
        </Link>
      )}
    </div>
  )
}