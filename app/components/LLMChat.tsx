'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { GraphNode } from '../../lib/contracts/endeavor-contract'
import { DailyFrontMatter } from '../../lib/graph/types'

interface LLMChatProps {
  userId: string
  date: string
  contextId: string
  contextNode: GraphNode
  contextHierarchy: GraphNode[]
  dailyNoteBody: string
  contextNotes: Map<string, { body: string; fm: DailyFrontMatter | null }>
  mode?: 'aim' | 'do' | 'reflect' // Mode for time-aware filtering
  isOpen: boolean
  onClose: () => void
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metrics?: {
    tokens_used: number
    latency_ms: number
    cached_tokens?: number
  }
  debugInfo?: {
    context_included?: {
      daily_note: string
      context_hierarchy: string[]
    }
    full_prompt?: string
  }
}

export function LLMChat({ userId, date, contextId, contextNode, contextHierarchy, dailyNoteBody, contextNotes, mode = 'do', isOpen, onClose }: LLMChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [expandedDebug, setExpandedDebug] = useState<Set<number>>(new Set())
  const [width, setWidth] = useState(384) // Default to w-96 (384px)
  const [isResizing, setIsResizing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // Auto-focus textarea when chat opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      // Small delay to ensure the panel is fully rendered
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Handle resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      const newWidth = window.innerWidth - e.clientX
      setWidth(Math.max(300, Math.min(800, newWidth))) // Min 300px, max 800px
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isResizing])

  const toggleDebugInfo = (messageIndex: number) => {
    setExpandedDebug(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageIndex)) {
        newSet.delete(messageIndex)
      } else {
        newSet.add(messageIndex)
      }
      return newSet
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleSendMessage = () => {
    if (!inputValue.trim() || isLoading) return
    sendMessage()
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Build conversation history for multi-turn support (exclude system messages, just user/assistant)
      const conversationHistory = messages
        .filter(msg => msg.role !== 'user' || msg !== userMessage) // Don't include the current message
        .map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }))

      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_id: userId,
          date,
          context_id: contextId,
          mode, // Include mode for time-aware filtering
          prompt: userMessage.content,
          conversation_history: conversationHistory,
          daily_note_body: dailyNoteBody,
          context_node: {
            id: contextNode.id,
            title: contextNode.title,
            description: contextNode.description,
            node_type: contextNode.node_type,
            status: contextNode.status,
            metadata: contextNode.metadata
          },
          context_hierarchy: contextHierarchy.map(node => ({
            id: node.id,
            title: node.title,
            description: node.description,
            node_type: node.node_type,
            status: node.status,
            metadata: node.metadata
          })),
          hierarchical_notes: contextHierarchy.map(node => {
            const notes = contextNotes.get(node.id)
            return {
              context_id: node.id,
              context_title: node.title || node.id,
              context_type: node.node_type,
              daily_notes: notes?.body || ''
            }
          }).filter(note => note.daily_notes.trim().length > 0)
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metrics: data.metrics,
        debugInfo: {
          context_included: data.context_included,
          full_prompt: `System: You are an AI assistant helping with daily reflection and work planning. You have access to the user's daily note and context information.

DAILY NOTE (${date}):
${data.context_included?.daily_note || ''}

${data.context_included?.context_hierarchy?.join('\n') || 'Context: Unknown'}

Please respond to the user's question/prompt based on this context. Be helpful, insightful, and concise.

User: ${userMessage.content}`
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      
    } catch (error) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      setTimeout(scrollToBottom, 100)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-y-0 right-0 bg-white border-l shadow-lg z-50 flex flex-col" style={{ width: `${width}px` }}>
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors"
        onMouseDown={() => setIsResizing(true)}
        title="Drag to resize"
      />
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div>
          <h3 className="font-semibold text-gray-900">AI Chat</h3>
          <p className="text-xs text-gray-500">Ask about your daily note</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close chat"
        >
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">
            <div className="mb-2">🤖</div>
            <p>Start a conversation about your daily note!</p>
            <p className="text-xs mt-2">
              Try asking: &quot;What are my key wins today?&quot; or &quot;What should I focus on next?&quot;
            </p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({children}) => <ul className="ml-4 mb-2 list-disc">{children}</ul>,
                      ol: ({children}) => <ol className="ml-4 mb-2 list-decimal">{children}</ol>,
                      li: ({children}) => <li className="mb-1">{children}</li>,
                      code: ({children}) => <code className="bg-gray-200 px-1 py-0.5 rounded text-xs">{children}</code>,
                      strong: ({children}) => <strong className="font-medium">{children}</strong>
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm">{message.content}</p>
              )}
              
              <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <div className="flex items-center gap-2">
                  {message.metrics && (
                    <span>
                      {message.metrics.tokens_used} tokens
                      {message.metrics.cached_tokens ? ` (${message.metrics.cached_tokens} cached)` : ''}
                      • {message.metrics.latency_ms}ms
                    </span>
                  )}
                  {message.debugInfo && message.role === 'assistant' && (
                    <button
                      onClick={() => toggleDebugInfo(index)}
                      className="text-xs opacity-60 hover:opacity-100 underline"
                      title="Show context sent to AI"
                    >
                      {expandedDebug.has(index) ? 'Hide' : 'Show'} Context
                    </button>
                  )}
                </div>
              </div>
              
              {/* Debug Info Panel */}
              {message.debugInfo && expandedDebug.has(index) && (
                <div className="mt-3 p-3 bg-gray-50 rounded border text-xs">
                  <div className="font-medium mb-2 text-gray-700">Context sent to AI:</div>
                  
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-gray-600 mb-1">Daily Note Content:</div>
                      <div className="bg-white p-2 rounded border max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs text-gray-800">
                          {message.debugInfo.context_included?.daily_note || '(empty)'}
                        </pre>
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-600 mb-1">Context Hierarchy:</div>
                      <div className="bg-white p-2 rounded border">
                        {message.debugInfo.context_included?.context_hierarchy?.map((ctx, i) => (
                          <div key={i} className="text-gray-800 mb-1">{ctx}</div>
                        )) || <div className="text-gray-500">No context</div>}
                      </div>
                    </div>
                    
                    <div>
                      <div className="font-medium text-gray-600 mb-1">Full Prompt:</div>
                      <div className="bg-white p-2 rounded border max-h-48 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-xs text-gray-800">
                          {message.debugInfo.full_prompt}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[80%]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your daily note... (Enter to send, Shift+Enter for new line)"
            className="w-full px-3 py-3 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[60px] max-h-[200px]"
            disabled={isLoading}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Includes your daily notes and hierarchical context as background
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  Send
                  <span className="text-xs opacity-70">⏎</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}