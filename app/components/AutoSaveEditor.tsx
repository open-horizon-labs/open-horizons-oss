'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useFormStatus } from 'react-dom'

interface AutoSaveEditorProps {
  initialBody: string
  onSaveServerAction: (formData: FormData) => Promise<void>
}

type SaveState = 'saved' | 'saving' | 'pending' | 'error'

export function AutoSaveEditor({ initialBody, onSaveServerAction }: AutoSaveEditorProps) {
  const [body, setBody] = useState(initialBody)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSavedRef = useRef(initialBody)
  
  const debouncedSave = useCallback(async (content: string) => {
    if (content === lastSavedRef.current) return
    
    setSaveState('saving')
    try {
      const formData = new FormData()
      formData.append('body', content)
      await onSaveServerAction(formData)
      lastSavedRef.current = content
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
    }
  }, [onSaveServerAction])
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    setBody(newValue)
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    setSaveState('pending')
    timeoutRef.current = setTimeout(() => {
      debouncedSave(newValue)
    }, 1000) // Auto-save after 1 second of no typing
  }, [debouncedSave])
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  const getSaveStatus = () => {
    switch (saveState) {
      case 'saving': return { text: 'Saving...', color: 'text-blue-600' }
      case 'saved': return { text: 'Saved', color: 'text-green-600' }
      case 'pending': return { text: 'Unsaved changes', color: 'text-orange-600' }
      case 'error': return { text: 'Save failed', color: 'text-red-600' }
    }
  }
  
  const status = getSaveStatus()
  
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold">Daily Log</h2>
        <div className={`text-xs ${status.color} flex items-center gap-1`}>
          {saveState === 'saving' && (
            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          )}
          {status.text}
        </div>
      </div>
      <textarea
        value={body}
        onChange={handleChange}
        rows={16}
        className="w-full border rounded p-2 font-mono text-sm"
        placeholder="Keep adding throughout the day...&#10;&#10;• 9:30 - Started working on X, discovered Y&#10;• 11:15 - Meeting with Z revealed...&#10;• 2:45 - Breakthrough on problem A&#10;&#10;This running log feeds your Daily Note synthesis."
      />
      <div className="text-xs text-gray-500 mt-2">
        <strong>Auto-saves after 1 second of inactivity.</strong> Add timestamps, quick notes, breakthroughs, blockers.
        The Review panel will help you synthesize this into structured Daily Notes.
      </div>
    </div>
  )
}