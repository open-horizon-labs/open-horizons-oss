'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface MarkdownInputProps {
  onSubmit: (content: string, fileName?: string) => void
  isProcessing: boolean
  initialContent?: string
}

export function MarkdownInput({ onSubmit, isProcessing, initialContent = '' }: MarkdownInputProps) {
  const [content, setContent] = useState(initialContent)
  const [fileName, setFileName] = useState<string>()
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (initialContent && textareaRef.current) {
      // Auto-resize textarea to fit content
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [initialContent])

  const handleFileRead = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setContent(text)
      setFileName(file.name)
      
      // Auto-resize textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
        }
      }, 0)
    }
    reader.readAsText(file)
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'text/markdown' || file.name.endsWith('.md') || file.type === 'text/plain')) {
      handleFileRead(file)
    } else if (file) {
      alert('Please select a markdown file (.md) or plain text file.')
    }
  }, [handleFileRead])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'text/markdown' || file.name.endsWith('.md') || file.type === 'text/plain')) {
      handleFileRead(file)
    } else if (file) {
      alert('Please drop a markdown file (.md) or plain text file.')
    }
  }, [handleFileRead])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value
    setContent(newContent)
    setFileName(undefined) // Clear file name when manually editing
    
    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }, [])

  const handleSubmit = useCallback(() => {
    if (content.trim()) {
      onSubmit(content, fileName)
    }
  }, [content, fileName, onSubmit])

  const handlePasteExample = useCallback(() => {
    const exampleContent = `# Mission

Empower teams to create outcomes that matter by weaving technology, data, and strategy with clarity, honesty, and adaptability, while building margin.

## Aim 1 — Create Leverage Through Technology

People and organizations achieve outcomes they couldn't without new tools—acting as a true force-multiplier.

### Tactics:
- Join roles where technology is central to strategy
- Run prototypes and pilots that show behavior change
- Publish force-multiplier patterns

### Signals:
- Prototype adoption rates
- Time-to-first-use metrics
- Before/after capability measurements

## Initiative — Q1 Prototype Launch

Build and validate first force-multiplier tool by end of Q1.

### Acceptance Criteria:
- Working prototype deployed
- 3+ early adopters testing
- Feedback loop established`

    setContent(exampleContent)
    setFileName('example.md')
    
    // Auto-resize textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      }
    }, 0)
  }, [])

  const handlePasteOnboarding = useCallback(() => {
    const onboardingContent = `# Mission

Get onboarded to Open Horizons and establish a personal growth system built around adaptive rituals.

## Aim 1 — Learn the Open Horizons Framework

Understand the core principles and rituals that make Open Horizons effective for sustained personal growth.

### Tactics:
- Complete the reflection on achievements exercise
- Identify and document personal strengths
- Define clear quarterly aims with outcomes
- Establish weekly and daily review rituals

### Signals:
- First quarterly reflection completed
- Personal strengths clearly articulated
- Weekly review rhythm established
- Daily focus routine active for 2+ weeks

## Aim 2 — Build Effective Growth Habits

Establish sustainable rituals that support long-term momentum and adaptability.

### Tactics:
- Practice daily focus sessions (5-10 minutes)
- Conduct weekly reviews with wins/learnings/adjustments
- Schedule quarterly reflection sessions
- Connect daily work to long-term aims

### Signals:
- 80%+ daily focus completion rate
- Weekly review completion for 4+ weeks
- First quarterly goals successfully defined
- Visible progress on personal aims

## Initiative — First 30 Days Setup

Complete core setup activities to establish foundation for Open Horizons practice.

### Tasks:
- Document 3-5 significant past achievements
- Identify top 3-5 personal strengths
- Define mission statement
- Set first quarterly aims
- Create weekly review template
- Establish daily focus routine

### Success Criteria:
- All foundation documents created
- First weekly review completed
- Daily focus practiced for 7+ consecutive days
- Quarterly aims clearly defined with tactics and signals

## Strength — Growth Mindset

Natural tendency to view challenges as opportunities and embrace continuous learning.

### Evidence:
- Seeks feedback regularly
- Adapts approach based on new information
- Views setbacks as learning experiences
- Maintains curiosity about better ways of working

## Achievement — Starting Open Horizons Journey

Taking the initiative to implement a structured approach to personal growth and productivity.

### Impact:
- Committed to systematic self-improvement
- Moving beyond ad-hoc goal setting
- Building foundation for sustained growth
- Creating accountability systems`

    setContent(onboardingContent)
    setFileName('onboarding-open-horizons.md')
    
    // Auto-resize textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
      }
    }, 0)
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Import Markdown Content
        </h2>
        <p className="text-gray-600">
          Paste your markdown content below or upload a .md file. We support missions, aims, initiatives, strengths, and accomplishments.
        </p>
      </div>

      {/* Input Methods */}
      <div className="grid md:grid-cols-4 gap-4">
        {/* Default Onboarding */}
        <div 
          className="border-2 border-dashed border-green-300 rounded-lg p-4 text-center cursor-pointer hover:border-green-400 transition-colors bg-green-50"
          onClick={handlePasteOnboarding}
        >
          <div className="text-green-400 mb-2">🚀</div>
          <div className="text-sm font-medium text-green-700 mb-1">
            Start Here
          </div>
          <div className="text-xs text-green-600">
            Open Horizons onboarding
          </div>
        </div>

        {/* File Upload */}
        <div 
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${isDragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-gray-400 mb-2">📄</div>
          <div className="text-sm font-medium text-gray-700 mb-1">
            Upload File
          </div>
          <div className="text-xs text-gray-500">
            .md or .txt files
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        {/* Paste from Clipboard */}
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={() => textareaRef.current?.focus()}
        >
          <div className="text-gray-400 mb-2">📋</div>
          <div className="text-sm font-medium text-gray-700 mb-1">
            Paste Content
          </div>
          <div className="text-xs text-gray-500">
            Click to focus textarea
          </div>
        </div>

        {/* Try Example */}
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
          onClick={handlePasteExample}
        >
          <div className="text-gray-400 mb-2">✨</div>
          <div className="text-sm font-medium text-gray-700 mb-1">
            Try Example
          </div>
          <div className="text-xs text-gray-500">
            Load sample content
          </div>
        </div>
      </div>

      {/* Text Area */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="markdown-content" className="text-sm font-medium text-gray-700">
            Markdown Content
          </label>
          {fileName && (
            <div className="text-xs text-gray-500 flex items-center">
              📁 {fileName}
              <button 
                onClick={() => {setFileName(undefined); setContent('')}}
                className="ml-2 text-gray-400 hover:text-gray-600"
                title="Clear file"
              >
                ×
              </button>
            </div>
          )}
        </div>
        
        <textarea
          ref={textareaRef}
          id="markdown-content"
          value={content}
          onChange={handleTextareaChange}
          placeholder={`Paste or type your markdown content here...

Examples:
# Mission
Your mission statement

## Aim 1 — Create Something Great
Description of your aim

### Tactics:
- Action item 1
- Action item 2

### Signals:
- Success metric 1
- Success metric 2`}
          className="w-full min-h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          style={{ overflow: 'hidden' }}
        />
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div>
            {content.length} characters, ~{content.split('\n').length} lines
          </div>
          <div>
            Supports: # Mission, ## Aim, ### Initiative, ## Strengths, ## Accomplishments
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || isProcessing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Analyzing...</span>
            </>
          ) : (
            <span>Preview Import</span>
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Tips</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use standard markdown headings: # Mission, ## Aim, ### Initiative</li>
          <li>• Add tactics as bullet lists under aims and initiatives</li>
          <li>• Include signals/metrics to measure success</li>
          <li>• The system will intelligently match against existing content</li>
        </ul>
      </div>
    </div>
  )
}