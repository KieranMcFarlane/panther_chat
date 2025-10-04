'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'thinking';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
}

interface ToolCall {
  tool: string;
  args: any;
  result?: any;
  status: 'pending' | 'completed' | 'error';
}

interface ClaudeChatProps {
  className?: string;
  suggestions?: { title: string; message: string }[];
  onThinkingChange?: (thinking: string[]) => void;
}

export default function ClaudeChat({ 
  className = '', 
  suggestions = [],
  onThinkingChange 
}: ClaudeChatProps) {
  const { userId, ensureUserId } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string[]>([]);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [streamingText, setStreamingText] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  useEffect(() => {
    if (onThinkingChange) {
      onThinkingChange(currentThinking);
    }
  }, [currentThinking, onThinkingChange]);

  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;

    let currentAssistantMessage = '';
    let currentMessageId = `msg_${Date.now()}`;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'text':
                  currentAssistantMessage += data.text || data.content || '';
                  setStreamingText(currentAssistantMessage);
                  break;
                  
                case 'thinking':
                  const thinkingContent = data.content || data.text || '';
                  setCurrentThinking(prev => [...prev, thinkingContent]);
                  
                  // Add thinking as a message in the chat flow
                  if (thinkingContent) {
                    setMessages(prev => [...prev, {
                      id: `thinking_${Date.now()}`,
                      type: 'thinking',
                      content: thinkingContent,
                      timestamp: new Date(),
                    }]);
                  }
                  break;
                  
                case 'tool_use':
                  const toolCall: ToolCall = {
                    tool: data.tool,
                    args: data.args,
                    status: 'pending'
                  };
                  setCurrentToolCall(toolCall);
                  setMessages(prev => [...prev, {
                    id: currentMessageId,
                    type: 'assistant',
                    content: currentAssistantMessage,
                    timestamp: new Date(),
                    toolCalls: [toolCall]
                  }]);
                  break;
                  
                case 'tool_result':
                  if (currentToolCall) {
                    const completedToolCall: ToolCall = {
                      ...currentToolCall,
                      result: data.result,
                      status: data.result?.success ? 'completed' : 'error'
                    };
                    setCurrentToolCall(completedToolCall);
                    
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastMessage = newMessages[newMessages.length - 1];
                      if (lastMessage && lastMessage.toolCalls) {
                        lastMessage.toolCalls[0] = completedToolCall;
                      }
                      return newMessages;
                    });
                  }
                  break;
                  
                case 'done':
                  if (currentAssistantMessage || streamingText) {
                    setMessages(prev => [...prev, {
                      id: currentMessageId,
                      type: 'assistant',
                      content: currentAssistantMessage || streamingText,
                      timestamp: new Date(),
                      toolCalls: currentToolCall ? [currentToolCall] : undefined
                    }]);
                  }
                  setStreamingText('');
                  setCurrentThinking([]);
                  setCurrentToolCall(null);
                  break;
                  
                case 'error':
                  console.error('Stream error:', data.error);
                  setMessages(prev => [...prev, {
                    id: currentMessageId,
                    type: 'system',
                    content: `Error: ${data.error}`,
                    timestamp: new Date()
                  }]);
                  break;
              }
            } catch (e) {
              console.error('Error parsing stream data:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream reading error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const currentUserId = ensureUserId();
    
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/claude-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          context: {
            userId: currentUserId
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await processStream(response);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: `msg_${Date.now()}`,
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleSuggestionClick = (suggestion: { title: string; message: string }) => {
    sendMessage(suggestion.message);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingText && (
          <div className="text-center py-8" suppressHydrationWarning>
            <h3 className="text-lg font-semibold mb-2">🏆 Sports Intelligence Platform</h3>
            <p className="text-gray-600 mb-4" suppressHydrationWarning>
              Ask me about sports clubs, business opportunities, or decision makers!
            </p>
            <div className="text-xs text-gray-500 max-w-md mx-auto">
              Try: "Analyze Manchester United", "find football clubs in England", or "execute Neo4j queries"
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.type === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-blue-500 text-white'
                  : message.type === 'system'
                  ? 'bg-red-100 text-red-800 border border-red-200'
                  : message.type === 'thinking'
                  ? 'bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 text-blue-800 border border-blue-200 text-sm shadow-sm border-l-4 border-l-blue-400'
                  : 'bg-gray-100 text-gray-800 border border-gray-200'
              }`}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Tool calls display */}
              {message.toolCalls && message.toolCalls.map((toolCall, index) => (
                <div key={index} className="mt-2 text-sm">
                  <div className={`inline-flex items-center px-2 py-1 rounded ${
                    toolCall.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    toolCall.status === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    <span className="font-medium">{toolCall.tool}</span>
                    {toolCall.status === 'pending' && '...'}
                  </div>
                  {toolCall.result && (
                    <div className="mt-1 text-xs opacity-75">
                      {toolCall.result.success ? 
                        `✓ ${toolCall.result.count || 'Success'}` : 
                        `✗ ${toolCall.result.error || 'Failed'}`
                      }
                    </div>
                  )}
                </div>
              ))}
              
              <div className="flex items-center justify-between mt-1">
                <div className="text-xs opacity-75">
                  {message.timestamp.toLocaleTimeString()}
                </div>
                {message.type === 'thinking' && (
                  <div className="flex items-center gap-1">
                    <div className="animate-pulse flex gap-1">
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Current streaming text */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-gray-100 text-gray-800 border border-gray-200">
              <div className="whitespace-pre-wrap">{streamingText}</div>
              {isLoading && <div className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />}
            </div>
          </div>
        )}

        {/* Current thinking display */}
        {currentThinking.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-purple-50 text-purple-800 border border-purple-200">
              <div className="text-xs font-medium mb-1">🤔 Thinking:</div>
              {currentThinking.map((thought, index) => (
                <div key={index} className="text-xs mb-1">{thought}</div>
              ))}
            </div>
          </div>
        )}

        {/* Current tool call */}
        {currentToolCall && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-yellow-50 text-yellow-800 border border-yellow-200">
              <div className="text-sm font-medium">🔧 Using: {currentToolCall.tool}</div>
              <div className="text-xs opacity-75 mt-1">
                {currentToolCall.status === 'pending' ? 'Working...' : 'Done!'}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && messages.length === 0 && (
        <div className="border-t p-4">
          <div className="grid grid-cols-1 gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 text-sm transition-colors"
              >
                <div className="font-medium text-gray-900">{suggestion.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Try MCP tools: search web, scrape URLs, remember, research..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}