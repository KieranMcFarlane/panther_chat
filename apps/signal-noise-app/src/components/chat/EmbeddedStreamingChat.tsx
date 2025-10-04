'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '@/contexts/UserContext';
import DynamicStatus from '@/components/ui/DynamicStatus';
import { Markdown } from '@copilotkit/react-ui';

interface EmbeddedStreamingChatProps {
  className?: string;
  suggestions?: string[];
  onThinkingChange?: (thinking: string[]) => void;
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

export function EmbeddedStreamingChat({ 
  className, 
  suggestions = [], 
  onThinkingChange 
}: EmbeddedStreamingChatProps) {
  const { userId } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [currentTool, setCurrentTool] = useState<string>('');
  const [currentThinking, setCurrentThinking] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (onThinkingChange) {
      onThinkingChange(currentThinking);
    }
  }, [currentThinking, onThinkingChange]);

  const handleSendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: messageToSend.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setCurrentStatus('Initializing sports intelligence tools...');
    setCurrentThinking([]);

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
                  setCurrentStatus(chunk.message || `Executing ${chunk.tool}...`);
                  setCurrentTool(chunk.tool || '');
                  
                  // Add to thinking for canvas integration
                  const thinkingMessage = `🔧 Executing ${chunk.tool}`;
                  setCurrentThinking(prev => [...prev, thinkingMessage]);
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
                  const resultStatus = `Completed ${chunk.tool} operation`;
                  setCurrentStatus(resultStatus);
                  
                  const thinkingResult = `✅ Completed ${chunk.tool} operation`;
                  setCurrentThinking(prev => [...prev, thinkingResult]);
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
      setCurrentThinking([]);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStatus('');
      setCurrentTool('');
      setCurrentThinking([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  
  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Status Bar */}
      {isLoading && (
        <div className="bg-gray-50 border-b p-3 flex-shrink-0">
          <div className="flex flex-col items-center space-y-2">
            <DynamicStatus 
              currentTool={currentTool} 
              isLoading={isLoading} 
              statusMessage={currentStatus} 
            />
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ minHeight: '0' }}>
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
                <div className="text-sm leading-relaxed">
                  <Markdown content={message.content} />
                </div>
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

        {/* Current thinking display */}
        {currentThinking.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-full px-4 py-2 rounded-lg bg-purple-50 text-purple-800 border border-purple-200">
              <div className="text-xs font-medium mb-1">🤔 Thinking:</div>
              {currentThinking.map((thought, index) => (
                <div key={index} className="text-xs mb-1">{thought}</div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="border-t p-4 flex-shrink-0">
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm transition-colors"
              >
                <div className="font-medium text-gray-900">{suggestion}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4 flex-shrink-0">
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
            onClick={() => handleSendMessage()}
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

export default EmbeddedStreamingChat;