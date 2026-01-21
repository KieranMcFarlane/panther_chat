'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isStreaming?: boolean
}

interface StreamChunk {
  type: 'status' | 'text' | 'agui-event' | 'tool_use' | 'tool_result' | 'final' | 'error'
  status?: string
  message?: string
  text?: string
  tool?: string
  result?: any
  data?: any
  error?: string
}

export default function SimpleComposePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentStatus, setCurrentStatus] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setCurrentStatus('Initializing sports intelligence tools...')

    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/copilotkit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          variables: {
            data: {
              messages: [
                {
                  id: userMessage.id,
                  textMessage: {
                    role: 'user',
                    content: userMessage.content
                  }
                }
              ],
              threadId: `compose_generic`
            }
          }
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body reader available')
      }

      let assistantMessage: Message | null = null
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6))
              
              switch (chunk.type) {
                case 'status':
                  setCurrentStatus(chunk.message || '')
                  break

                case 'text':
                  if (!assistantMessage) {
                    assistantMessage = {
                      id: `assistant_${Date.now()}`,
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isStreaming: true
                    }
                    setMessages(prev => [...prev, assistantMessage])
                  }
                  
                  if (chunk.text) {
                    assistantMessage.content += chunk.text
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === assistantMessage!.id 
                          ? { ...msg, content: assistantMessage!.content }
                          : msg
                      )
                    )
                  }
                  break

                case 'error':
                  console.error('Stream error:', chunk.error)
                  const errorMessage: Message = {
                    id: `error_${Date.now()}`,
                    role: 'assistant',
                    content: chunk.message || 'An error occurred while processing your request.',
                    timestamp: new Date(),
                    isStreaming: false
                  }
                  setMessages(prev => [...prev, errorMessage])
                  break

                default:
                  // Ignore other chunk types (agui-event, etc.)
                  break
              }
            } catch (parseError) {
              console.error('Error parsing chunk:', parseError)
            }
          }
        }
      }

      // Finalize assistant message
      if (assistantMessage) {
        assistantMessage.isStreaming = false
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage!.id 
              ? { ...msg, isStreaming: false }
              : msg
          )
        )
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted')
      } else {
        console.error('Error sending message:', error)
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
          timestamp: new Date(),
          isStreaming: false
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } finally {
      setIsLoading(false)
      setCurrentStatus('')
      abortControllerRef.current = null
    }
  }, [isLoading])

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const message = formData.get('message') as string
    
    if (!message?.trim()) return

    // Clear form
    e.currentTarget.reset()

    // Send message
    await handleSendMessage(message)
  }, [handleSendMessage])

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
      setCurrentStatus('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const formData = new FormData(e.currentTarget.form!)
      const message = formData.get('message') as string
      if (message?.trim()) {
        e.currentTarget.form!.reset()
        handleSendMessage(message)
      }
    }
  }

  // Simple text formatter for basic markdown-like rendering
  const formatText = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="bg-white border-b p-4">
          <h1 className="text-2xl font-bold text-gray-800">Simple AI Chat</h1>
          <p className="text-gray-600">Direct Claude Agent SDK integration with minimal complexity</p>
        </div>

        {/* Status Bar */}
        {(isLoading || currentStatus) && (
          <div className="bg-blue-50 border-b p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isLoading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
                <span className="text-sm text-blue-800">{currentStatus || 'Processing...'}</span>
              </div>
              {isLoading && (
                <button
                  onClick={handleStopGeneration}
                  className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
                >
                  Stop
                </button>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 py-16">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Claude Agent SDK Chat</h3>
              <p className="text-sm">Direct integration with Claude Agent SDK and MCP tools. Ask me anything!</p>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                } ${message.isStreaming ? 'animate-pulse' : ''}`}
              >
                {message.role === 'assistant' ? (
                  <div 
                    className="text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: `<p>${formatText(message.content)}</p>` }}
                  />
                ) : (
                  <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                )}
                {message.isStreaming && (
                  <div className="flex items-center mt-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t bg-white p-4">
          <form onSubmit={handleSubmit} className="flex space-x-3">
            <input
              name="message"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about sports, business, or general knowledge..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                'Send'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}