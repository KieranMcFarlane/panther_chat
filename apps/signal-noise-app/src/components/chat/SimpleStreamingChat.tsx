'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';

interface SimpleStreamingChatProps {
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface StreamChunk {
  type: 'status' | 'text' | 'tool_use' | 'tool_result' | 'final' | 'error';
  status?: string;
  message?: string;
  text?: string;
  tool?: string;
  result?: any;
  data?: any;
  error?: string;
}

export function SimpleStreamingChat({ className }: SimpleStreamingChatProps) {
  const { userId } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Click outside to close functionality
  const handleClickOutside = useCallback((event: MouseEvent) => {
    if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
      setIsOpen(false);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, handleClickOutside]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentStatus('Initializing sports intelligence tools...');

    abortControllerRef.current = new AbortController();

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
              threadId: userId
            }
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      let assistantMessage: Message | null = null;
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const chunk: StreamChunk = JSON.parse(line.slice(6));
              
              switch (chunk.type) {
                case 'status':
                  setCurrentStatus(chunk.message || '');
                  if (chunk.message?.includes('tools_ready')) {
                    setCurrentTool('');
                  }
                  break;

                case 'tool_use':
                  // Don't set generic status text - let DynamicStatus handle the display
                  // setCurrentStatus(chunk.message || `Using ${chunk.tool}...`);
                  setCurrentTool(chunk.tool || '');
                  console.log('Frontend tool execution:', {
                    tool: chunk.tool,
                    message: chunk.message,
                    args: chunk.args
                  });
                  break;

                case 'text':
                  if (!assistantMessage) {
                    assistantMessage = {
                      id: `assistant_${Date.now()}`,
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isStreaming: true
                    };
                    setMessages(prev => [...prev, assistantMessage]);
                  }
                  
                  if (chunk.text) {
                    assistantMessage.content += chunk.text;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === assistantMessage!.id 
                          ? { ...msg, content: assistantMessage!.content }
                          : msg
                      )
                    );
                  }
                  break;

                case 'final':
                  if (assistantMessage) {
                    assistantMessage.isStreaming = false;
                    setMessages(prev => 
                      prev.map(msg => 
                        msg.id === assistantMessage!.id 
                          ? { ...msg, isStreaming: false }
                          : msg
                      )
                    );
                  } else if (chunk.data?.data?.generateCopilotResponse?.messages?.[0]?.content?.[0]) {
                    const finalMessage: Message = {
                      id: `assistant_${Date.now()}`,
                      role: 'assistant',
                      content: chunk.data.data.generateCopilotResponse.messages[0].content[0],
                      timestamp: new Date(),
                      isStreaming: false
                    };
                    setMessages(prev => [...prev, finalMessage]);
                  }
                  break;

                case 'tool_result':
                  const resultStatus = `Processed ${chunk.tool} results`;
                  setCurrentStatus(resultStatus);
                  console.log('Frontend tool result received:', {
                    tool: chunk.tool,
                    resultLength: chunk.result ? JSON.stringify(chunk.result).length : 0,
                    resultPreview: chunk.result ? JSON.stringify(chunk.result).slice(0, 200) : 'No result'
                  });
                  // Optionally add tool results to the message
                  if (chunk.result && typeof chunk.result === 'string') {
                    if (!assistantMessage) {
                      assistantMessage = {
                        id: `assistant_${Date.now()}`,
                        role: 'assistant',
                        content: '',
                        timestamp: new Date(),
                        isStreaming: true
                      };
                      setMessages(prev => [...prev, assistantMessage]);
                    }
                    // Check for duplicate content to prevent repetition
                    const contentToAdd = chunk.result.trim();
                    const currentContent = assistantMessage.content || '';
                    
                    if (!currentContent.includes(contentToAdd)) {
                      assistantMessage.content += (currentContent ? '\n\n' : '') + contentToAdd;
                      
                      setMessages(prev => 
                        prev.map(msg => 
                          msg.id === assistantMessage!.id 
                            ? { ...msg, content: assistantMessage!.content }
                            : msg
                        )
                      );
                    }
                  }
                  break;

                case 'error':
                  console.error('Stream error:', chunk.error);
                  const errorMessage: Message = {
                    id: `error_${Date.now()}`,
                    role: 'assistant',
                    content: chunk.message || 'An error occurred while processing your request.',
                    timestamp: new Date(),
                    isStreaming: false
                  };
                  setMessages(prev => [...prev, errorMessage]);
                  break;
              }
            } catch (parseError) {
              console.error('Error parsing chunk:', parseError);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Error sending message:', error);
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error.message || 'Unknown error'}`,
          timestamp: new Date(),
          isStreaming: false
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setCurrentStatus('');
      setCurrentTool('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStatus('');
      setCurrentTool('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Simple text formatter for basic markdown-like rendering
  const formatText = (text: string) => {
    // Convert basic markdown to HTML
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br />');
    
    return `<p>${formatted}</p>`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transform hover:scale-105 transition-all duration-200 z-30"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      </button>
    );
  }

  return (
    <div ref={sidebarRef} className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-40 flex flex-col ${className}`}>
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Sports Intelligence</h3>
          <p className="text-sm opacity-90">Real-time AI Analysis</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-white hover:bg-blue-700 rounded p-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Status Bar */}
      {(isLoading || currentStatus) && (
        <div className="bg-gray-50 border-b p-3">
          <div className="flex flex-col items-center space-y-2">
            {currentTool && (
              <div className="text-sm text-gray-600 text-center max-w-xs">
                Using <span className="font-medium text-blue-500">{currentTool.replace('mcp__', '').replace(/__/g, ' - ')}</span>
              </div>
            )}
            {currentStatus && (
              <div className="text-xs text-gray-500 text-center max-w-xs">
                {currentStatus}
              </div>
            )}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="mb-4">
              <svg className="w-12 h-12 mx-auto text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h4 className="font-semibold mb-2">Sports Intelligence Assistant</h4>
            <p className="text-sm">I can help you analyze sports entities and provide real-time insights.</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-full px-4 py-2 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              } ${message.isStreaming ? 'animate-pulse' : ''}`}
            >
              {message.role === 'assistant' ? (
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatText(message.content) }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
              )}
              {message.isStreaming && (
                <div className="flex items-center mt-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about sports entities, business opportunities, or market intelligence..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg transition-colors"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SimpleStreamingChat;