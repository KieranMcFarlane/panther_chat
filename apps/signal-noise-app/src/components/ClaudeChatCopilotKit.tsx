'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useCopilotChat } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
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
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [currentThinking, setCurrentThinking] = useState<string[]>([]);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  
  // Use CopilotKit's chat hook
  const {
    visibleMessages: copilotMessages,
    appendMessage,
    setMessages,
    isLoading,
  } = useCopilotChat({
    labels: {
      title: "Sports Intelligence Assistant",
      initial: "Hi! 👋 I'm your Sports Intelligence AI. I can help you analyze sports entities, find business opportunities, and identify key decision makers. How can I assist you today?",
      placeholder: "Ask about sports clubs, business opportunities, or decision makers..."
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [copilotMessages, currentThinking]);

  useEffect(() => {
    if (onThinkingChange) {
      onThinkingChange(currentThinking);
    }
  }, [currentThinking, onThinkingChange]);

  // Convert CopilotKit messages to our format
  const convertCopilotMessage = (msg: any): Message => {
    return {
      id: msg.id || `msg_${Date.now()}_${Math.random()}`,
      type: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content || '',
      timestamp: new Date(msg.createdAt || Date.now()),
    };
  };

  // Combine CopilotKit messages with local state
  const allMessages = [
    ...localMessages,
    ...copilotMessages.map(convertCopilotMessage)
  ];

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const currentUserId = ensureUserId();
    
    // Add thinking state
    setCurrentThinking(['🤔 Processing your request...']);

    try {
      // Use CopilotKit's appendMessage
      await appendMessage(messageText, {
        userId: currentUserId,
        context: { projectType: 'sports intelligence', userRole: 'analyst' }
      });
      
      setCurrentThinking([]);
    } catch (error) {
      console.error('Error sending message:', error);
      setCurrentThinking([`❌ Error: ${error.message}`]);
      
      // Add error message to local state
      setLocalMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      }]);
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

  // For the input field, we'll use a controlled state
  const [input, setInput] = useState('');

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {allMessages.length === 0 && (
          <div className="text-center py-8">
            <h3 className="text-lg font-semibold mb-2">🏆 Sports Intelligence Platform</h3>
            <p className="text-gray-600 mb-4">
              Ask me about sports clubs, business opportunities, or decision makers!
            </p>
            <div className="text-xs text-gray-500 max-w-md mx-auto">
              Try: "Analyze Manchester United", "find football clubs in England", or "execute Neo4j queries"
            </div>
          </div>
        )}

        {allMessages.map((message) => (
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
      {suggestions.length > 0 && allMessages.length === 0 && (
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