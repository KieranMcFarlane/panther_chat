'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext';

interface StreamingChatSidebarProps {
  userId?: string;
  context?: any;
  className?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
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


// Simple markdown renderer (basic text formatting for now)
const MarkdownRenderer = ({ content }: { content: string }) => {
  // Split content by newlines and handle basic formatting
  const lines = content.split('\n');
  
  const formattedContent = lines.map((line, index) => {
    // Handle headers
    if (line.startsWith('### ')) {
      return <h3 key={index} className="text-sm font-semibold text-gray-900 mb-2 mt-3">{line.substring(4)}</h3>;
    }
    if (line.startsWith('## ')) {
      return <h2 key={index} className="text-base font-semibold text-gray-900 mb-2 mt-3">{line.substring(3)}</h2>;
    }
    if (line.startsWith('# ')) {
      return <h1 key={index} className="text-lg font-bold text-gray-900 mb-2 mt-3">{line.substring(2)}</h1>;
    }
    
    // Handle lists
    if (line.startsWith('* ') || line.startsWith('- ')) {
      return <li key={index} className="text-sm ml-4 mb-1 list-disc">{line.substring(2)}</li>;
    }
    if (/^\d+\. /.test(line)) {
      return <li key={index} className="text-sm ml-4 mb-1 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
    }
    
    // Handle blockquotes
    if (line.startsWith('> ')) {
      return <blockquote key={index} className="border-l-4 border-blue-500 pl-4 italic text-gray-700 my-2">{line.substring(2)}</blockquote>;
    }
    
    // Handle code blocks
    if (line.startsWith('```')) {
      return null; // Skip code block markers for now
    }
    
    // Handle empty lines
    if (!line.trim()) {
      return <br key={index} />;
    }
    
    // Handle regular text with basic inline formatting
    let formattedLine = line;
    
    // Bold text **text**
    formattedLine = formattedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic text *text*
    formattedLine = formattedLine.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code `text`
    formattedLine = formattedLine.replace(/`(.*?)`/g, '<code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
    
    return (
      <p 
        key={index} 
        className="text-sm leading-relaxed mb-2"
        dangerouslySetInnerHTML={{ __html: formattedLine }}
      />
    );
  });

  return <div className="space-y-1">{formattedContent}</div>;
};

export function StreamingChatSidebar({
  userId,
  context = {},
  className
}: StreamingChatSidebarProps) {
  const { userId: contextUserId } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [activeTool, setActiveTool] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    // Create abort controller for this request
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
              threadId: userId || contextUserId
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
                  if (chunk.status === 'tools_ready') {
                    setCurrentStatus('Analyzing your request...');
                  }
                  break;

                case 'tool_use':
                  setActiveTool(chunk.tool || 'Unknown tool');
                  setCurrentStatus(chunk.message || '');
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

                case 'tool_result':
                  setCurrentStatus(`Processed ${chunk.tool} results`);
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
                    assistantMessage.content += chunk.result;
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
                    // Fallback for final CopilotKit formatted message
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
      setActiveTool('');
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
      setCurrentStatus('');
      setActiveTool('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-lg transform hover:scale-105 transition-all duration-200 z-30"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {/* Chat Sidebar */}
      {isOpen && (
        <div className={`fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-40 flex flex-col ${className}`}>
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
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600">{currentStatus}</span>
                {activeTool && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {activeTool}
                  </span>
                )}
                {isLoading && (
                  <button
                    onClick={handleStopGeneration}
                    className="ml-auto text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200"
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
                <p className="text-sm">I can help you analyze sports entities, find business opportunities, and provide real-time insights using advanced AI tools.</p>
                <div className="mt-4 text-xs text-gray-400">
                  <p>🔍 Neo4j Database: 3,325+ sports entities</p>
                  <p>🌐 Real-time web search via BrightData</p>
                  <p>🤖 AI-powered analysis with Perplexity</p>
                  <p>📝 Markdown formatting supported</p>
                </div>
                <div className="mt-4 p-3 bg-gray-50 rounded-lg text-left">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Try asking:</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    <li>• "Analyze Manchester United's decision makers"</li>
                    <li>• "Find Premier League clubs under $100M valuation"</li>
                    <li>• "Search for recent football transfer news"</li>
                    <li>• "Show me top 5 valuable sports leagues"</li>
                  </ul>
                </div>
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
                    <MarkdownRenderer content={message.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
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
                placeholder="Ask about sports clubs, business opportunities, or market intelligence..."
                className="flex-1 px-3 py-2 border text-gray-800 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      )}
    </>
  );
}

export default StreamingChatSidebar;