'use client'

import React, { useState, useRef, useEffect } from 'react'

export default function MinimalTestPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return

    console.log('🚀 Starting sendMessage:', messageText)
    
    const userMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageText.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setInput('')

    // Create unique thread ID for each request to avoid caching issues
    const uniqueThreadId = `minimal_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    console.log('📤 Sending message to backend:', messageText)
    console.log('🆔 Unique thread ID:', uniqueThreadId)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => {
        console.log('⏰ Request timeout reached, aborting...')
        controller.abort()
      }, 120000) // 2 minute timeout

      const response = await fetch('/api/copilotkit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
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
              threadId: uniqueThreadId
            }
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      console.log('✅ Response status:', response.status)
      console.log('✅ Response ok:', response.ok)

      if (!response.ok) {
        console.error('❌ HTTP Error Details:', {
          status: response.status,
          statusText: response.statusText
        })
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body reader available')
      }

      let assistantMessage = null
      let buffer = ''
      let chunkCount = 0

      console.log('🔄 Starting to read stream...')

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('🏁 Stream reading completed')
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              chunkCount++
              const chunk = JSON.parse(line.slice(6))
              console.log(`📦 Chunk ${chunkCount}:`, chunk.type)
              
              if (chunk.type === 'text' && chunk.text) {
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
                
                assistantMessage.content += chunk.text
                setMessages(prev => 
                  prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: assistantMessage.content }
                      : msg
                  )
                )
              }

              if (chunk.type === 'error') {
                console.error('❌ Stream error:', chunk.error)
                const errorMessage = {
                  id: `error_${Date.now()}`,
                  role: 'assistant',
                  content: chunk.message || 'An error occurred while processing your request.',
                  timestamp: new Date(),
                  isStreaming: false
                }
                setMessages(prev => [...prev, errorMessage])
              }
            } catch (parseError) {
              console.error('❌ Error parsing chunk:', parseError)
            }
          }
        }
      }

      console.log(`📊 Stream summary: ${chunkCount} chunks processed`)

      // Finalize assistant message
      if (assistantMessage) {
        assistantMessage.isStreaming = false
        setMessages(prev => 
          prev.map(msg => 
            msg.id === assistantMessage.id 
              ? { ...msg, isStreaming: false }
              : msg
          )
        )
      }

    } catch (error) {
      console.error('❌ Error sending message:', error)
      const errorMessage = {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
        timestamp: new Date(),
        isStreaming: false
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
      console.log('🏁 sendMessage completed at:', new Date().toISOString())
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const message = formData.get('message') as string
    if (message?.trim()) {
      e.currentTarget.reset()
      sendMessage(message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Fixed Minimal Test Page</h1>
        <p className="text-gray-600 mb-8">Robust frontend request handling with retry logic</p>

        <div className="bg-white rounded-lg shadow-sm border p-4 h-96 overflow-y-auto mb-4">
          {messages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              Send a message to test Claude Agent SDK integration with retry logic
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div
                  className={`inline-block px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800'
                  } ${message.isStreaming ? 'animate-pulse' : ''}`}
                >
                  {message.content}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            name="message"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything... (requests now have retry logic)"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}