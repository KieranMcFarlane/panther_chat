'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTabs } from '@/contexts/TabContext';
import { Message, ToolCall } from '@/types/tab-system';
import { useUser } from '@/contexts/UserContext';

interface TabChatInstanceProps {
  tabId: string;
  className?: string;
}

export default function TabChatInstance({ tabId, className = '' }: TabChatInstanceProps) {
  const { helpers, actions } = useTabs();
  const { userId, ensureUserId } = useUser();
  
  const tab = helpers.getTabById(tabId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string[]>([]);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [streamingText, setStreamingText] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when tab becomes active
  useEffect(() => {
    if (tab && inputRef.current) {
      inputRef.current.focus();
    }
  }, [tab]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [tab?.messages, streamingText]);

  // Process streaming response from Claude Agent SDK
  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;

    let currentAssistantMessage = '';
    let currentMessageId = `msg_${Date.now()}`;
    let accumulatedThinking: string[] = [];

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
                  if (thinkingContent) {
                    accumulatedThinking.push(thinkingContent);
                    setCurrentThinking([...accumulatedThinking]);
                  }
                  break;
                  
                case 'tool_use':
                  const toolCall: ToolCall = {
                    tool: data.tool,
                    args: data.args,
                    status: 'pending'
                  };
                  setCurrentToolCall(toolCall);
                  
                  // Add a message showing tool use
                  const toolMessage: Message = {
                    id: `tool_${Date.now()}`,
                    type: 'assistant',
                    content: currentAssistantMessage || `Using tool: ${data.tool}`,
                    timestamp: new Date(),
                    toolCalls: [toolCall]
                  };
                  await actions.addMessage(tabId, toolMessage);
                  break;
                  
                case 'tool_result':
                  if (currentToolCall) {
                    const completedToolCall: ToolCall = {
                      ...currentToolCall,
                      result: data.result,
                      status: data.result?.success ? 'completed' : 'error'
                    };
                    setCurrentToolCall(completedToolCall);
                  }
                  break;
                  
                case 'done':
                  // Add the final assistant message
                  if (currentAssistantMessage || streamingText) {
                    const finalMessage: Message = {
                      id: currentMessageId,
                      type: 'assistant',
                      content: currentAssistantMessage || streamingText,
                      timestamp: new Date(),
                      toolCalls: currentToolCall ? [currentToolCall] : undefined
                    };
                    await actions.addMessage(tabId, finalMessage);
                  }
                  
                  // Add thinking messages if any
                  if (accumulatedThinking.length > 0) {
                    for (let i = 0; i < accumulatedThinking.length; i++) {
                      const thinkingMessage: Message = {
                        id: `thinking_${Date.now()}_${i}`,
                        type: 'thinking',
                        content: accumulatedThinking[i],
                        timestamp: new Date()
                      };
                      await actions.addMessage(tabId, thinkingMessage);
                    }
                  }
                  
                  setStreamingText('');
                  setCurrentThinking([]);
                  setCurrentToolCall(null);
                  accumulatedThinking = [];
                  break;
                  
                case 'error':
                  console.error('Stream error:', data.error);
                  const errorMessage: Message = {
                    id: `error_${Date.now()}`,
                    type: 'system',
                    content: `Error: ${data.error}`,
                    timestamp: new Date()
                  };
                  await actions.addMessage(tabId, errorMessage);
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
      const errorMessage: Message = {
        id: `stream_error_${Date.now()}`,
        type: 'system',
        content: `Connection error: ${error.message}`,
        timestamp: new Date()
      };
      await actions.addMessage(tabId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !tab) return;

    const currentUserId = ensureUserId();
    
    // Add user message
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
      userId: currentUserId
    };

    await actions.addMessage(tabId, userMessage);
    setInput('');
    setIsLoading(true);

    try {
      // Call the Claude Agent SDK API with tab-specific context
      const response = await fetch('/api/claude-agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText,
          context: {
            userId: currentUserId,
            tabId: tabId,
            tabType: tab.type,
            tabConfig: tab.claudeConfig,
            conversationHistory: tab.messages.map(msg => ({
              role: msg.type === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
            tabContext: {
              name: tab.name,
              toolsAvailable: tab.claudeConfig.tools,
              systemPrompt: tab.claudeConfig.systemPrompt
            }
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await processStream(response);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date()
      };
      await actions.addMessage(tabId, errorMessage);
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const regenerateResponse = async () => {
    if (!tab || tab.messages.length === 0) return;
    
    // Remove the last assistant message and regenerate
    const lastMessage = tab.messages[tab.messages.length - 1];
    if (lastMessage.type === 'assistant') {
      const newMessages = tab.messages.slice(0, -1);
      actions.updateMessages(tabId, newMessages);
      
      // Find the last user message and resend it
      for (let i = newMessages.length - 1; i >= 0; i--) {
        if (newMessages[i].type === 'user') {
          await sendMessage(newMessages[i].content);
          break;
        }
      }
    }
  };

  const clearConversation = async () => {
    if (confirm('Are you sure you want to clear this conversation?')) {
      actions.updateMessages(tabId, []);
    }
  };

  if (!tab) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-400 ${className}`}>
        <div className="text-center">
          <p>Tab not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-custom-bg ${className}`}>
      {/* Tab Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-custom-border">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-white">{tab.name}</span>
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-black font-medium">
            {tab.type}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={regenerateResponse}
            disabled={isLoading || tab.messages.length === 0}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-custom-border rounded transition-colors disabled:opacity-50"
          >
            Regenerate
          </button>
          <button
            onClick={clearConversation}
            disabled={isLoading}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-custom-border rounded transition-colors disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab.messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">
              {tab.type === 'general' && '💬'}
              {tab.type === 'rfp' && '📋'}
              {tab.type === 'sports' && '⚽'}
              {tab.type === 'knowledge-graph' && '🕸️'}
              {tab.type === 'custom' && '⚙️'}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {tab.claudeConfig.systemPrompt.split('.')[0]}
            </h3>
            <p className="text-gray-400 mb-4">
              What would you like to explore today?
            </p>
            <div className="text-xs text-gray-500 max-w-md mx-auto">
              <p className="mb-2">Available tools:</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {tab.claudeConfig.tools.map((tool, index) => (
                  <span key={index} className="px-2 py-1 bg-custom-border rounded text-xs">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab.messages.map((message) => (
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
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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

      {/* Input */}
      <div className="border-t border-custom-border p-4">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Message ${tab.name.toLowerCase()}...`}
            className="flex-1 px-4 py-2 bg-custom-bg border border-custom-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 text-white placeholder-gray-400"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}