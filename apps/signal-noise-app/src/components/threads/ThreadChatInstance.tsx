'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useThreads } from '@/contexts/ThreadContext';
import { useUser } from '@/contexts/UserContext';
import { useSharedCopilot } from '@/contexts/SharedCopilotContext';
import { useCopilotChat } from '@copilotkit/react-core';
import { Message, ToolCall } from '@/types/thread-system';
import { ThreadStatus } from '@/types/thread-system';
import betterAuthMCPService from '@/services/BetterAuthMCPService';
import { sharedClaudeAgentManager } from '@/services/SharedClaudeAgentManager';
import { ClaudeAgentRequest } from '@/types/thread-system';

interface ThreadChatInstanceProps {
  threadId: string;
  className?: string;
}

export default function ThreadChatInstance({ threadId, className = '' }: ThreadChatInstanceProps) {
  const { helpers, actions } = useThreads();
  const { userId, ensureUserId } = useUser();
  const { addToSharedHistory } = useSharedCopilot();
  
  // Use shared CopilotKit for all threads
  const {
    visibleMessages,
    appendMessage,
    setMessages,
    isLoading: copilotIsLoading,
    deleteMessage,
    reloadMessages,
    stopGeneration
  } = useCopilotChat({
    threadId: `thread_${threadId}`, // Use thread-specific ID within shared CopilotKit
  });
  
  const thread = helpers.getThreadById(threadId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentThinking, setCurrentThinking] = useState<string[]>([]);
  const [currentToolCall, setCurrentToolCall] = useState<ToolCall | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [executionStatus, setExecutionStatus] = useState<any>(null);
  const [claudeAgentReady, setClaudeAgentReady] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize Better Auth MCP session and Claude Agent SDK instance when thread loads
  useEffect(() => {
    if (thread && userId) {
      initializeThreadServices();
    }
  }, [thread, userId]);

  const initializeThreadServices = async () => {
    try {
      if (!thread || !userId) return;
      
      // Initialize Better Auth MCP session
      if (!betterAuthMCPService.hasActiveSession()) {
        await betterAuthMCPService.initializeSession(userId, threadId);
        console.log('Better Auth MCP session initialized for thread:', threadId);
      }
      
      // Initialize Claude Agent SDK instance for this thread
      const claudeAgentInstance = await sharedClaudeAgentManager.createInstance(threadId, thread);
      setClaudeAgentReady(true);
      console.log('Claude Agent SDK instance ready for thread:', threadId, claudeAgentInstance.id);
      
    } catch (error) {
      console.error('Failed to initialize thread services:', error);
      setClaudeAgentReady(false);
    }
  };

  // Auto-focus input when thread becomes active
  useEffect(() => {
    if (thread && inputRef.current) {
      inputRef.current.focus();
    }
  }, [thread]);

  // Monitor execution status
  useEffect(() => {
    const checkExecutionStatus = () => {
      const status = parallelClaudeAgentService.getExecutionStatus(threadId);
      if (status) {
        setExecutionStatus(status);
        
        // Update thread status based on execution
        if (status.status === 'running') {
          actions.setThreadStatus(threadId, 'processing');
        } else if (status.status === 'completed') {
          actions.setThreadStatus(threadId, 'completed');
          actions.addNotification(threadId, {
            type: 'task_completed',
            title: 'Processing Complete',
            message: 'Thread has completed its parallel execution',
            priority: 'medium'
          });
        } else if (status.status === 'error') {
          actions.setThreadStatus(threadId, 'error');
          actions.addNotification(threadId, {
            type: 'error',
            title: 'Processing Error',
            message: status.error || 'An error occurred during processing',
            priority: 'high'
          });
        }
      }
    };

    const interval = setInterval(checkExecutionStatus, 1000);
    return () => clearInterval(interval);
  }, [threadId, actions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thread?.messages, streamingText]);

  // Process streaming response from Claude Agent SDK
  const processStream = async (response: Response) => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    if (!reader) return;

    let currentAssistantMessage = '';
    let currentMessageId = `msg_${Date.now()}`;
    let accumulatedThinking: string[] = [];
    let entities: string[] = [];
    let insights: string[] = [];

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
                    status: 'pending',
                    threadId
                  };
                  setCurrentToolCall(toolCall);
                  
                  // Add tool message to thread
                  const toolMessage: Message = {
                    id: `tool_${Date.now()}`,
                    type: 'assistant',
                    content: currentAssistantMessage || `Using tool: ${data.tool}`,
                    timestamp: new Date(),
                    threadId,
                    userId,
                    toolCalls: [toolCall]
                  };
                  await actions.addMessage(threadId, toolMessage);
                  break;
                  
                case 'tool_result':
                  if (currentToolCall) {
                    const completedToolCall: ToolCall = {
                      ...currentToolCall,
                      result: data.result,
                      status: data.result?.success ? 'completed' : 'error'
                    };
                    setCurrentToolCall(completedToolCall);
                    
                    // Add to Better Auth MCP shared memory based on tool results
                    if (data.result?.entities) {
                      for (const entity of data.result.entities) {
                        await betterAuthMCPService.addEntityToSharedMemory({
                          name: entity.name,
                          type: entity.type || 'unknown',
                          properties: entity.properties || {},
                          confidence: entity.confidence || 0.7,
                          sources: entity.sources || []
                        }, threadId);
                      }
                    }
                    
                    if (data.result?.insights) {
                      for (const insight of data.result.insights) {
                        await betterAuthMCPService.addInsightToSharedMemory({
                          title: insight.title,
                          content: insight.content,
                          category: insight.category || 'general',
                          confidence: insight.confidence || 0.8,
                          tags: insight.tags || []
                        }, threadId);
                      }
                    }
                  }
                  break;
                  
                case 'done':
                  // Add final assistant message
                  if (currentAssistantMessage || streamingText) {
                    const finalMessage: Message = {
                      id: currentMessageId,
                      type: 'assistant',
                      content: currentAssistantMessage || streamingText,
                      timestamp: new Date(),
                      threadId,
                      userId,
                      toolCalls: currentToolCall ? [currentToolCall] : undefined,
                      metadata: {
                        entities,
                        insights,
                        processingTime: Date.now() - (thread?.lastActivity.getTime() || Date.now())
                      }
                    };
                    await actions.addMessage(threadId, finalMessage);
                  }
                  
                  // Add conversation summary to Better Auth MCP
                  if (thread?.messages.length > 0) {
                    await betterAuthMCPService.addConversationSummaryToSharedMemory({
                      threadId,
                      userId,
                      title: thread.name,
                      summary: currentAssistantMessage.substring(0, 200),
                      keyPoints: accumulatedThinking.slice(0, 3),
                      entities,
                      insights
                    });
                  }
                  
                  setStreamingText('');
                  setCurrentThinking([]);
                  setCurrentToolCall(null);
                  accumulatedThinking = [];
                  entities = [];
                  insights = [];
                  break;
                  
                case 'error':
                  console.error('Stream error:', data.error);
                  const errorMessage: Message = {
                    id: `error_${Date.now()}`,
                    type: 'system',
                    content: `Error: ${data.error}`,
                    timestamp: new Date(),
                    threadId,
                    userId
                  };
                  await actions.addMessage(threadId, errorMessage);
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
        timestamp: new Date(),
        threadId,
        userId
      };
      await actions.addMessage(threadId, errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (messageText: string) => {
    if (!messageText.trim() || isLoading || !thread || !claudeAgentReady) return;

    const currentUserId = ensureUserId();
    
    // Add user message to thread
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
      threadId,
      userId: currentUserId
    };

    await actions.addMessage(threadId, userMessage);
    
    // Add to shared CopilotKit history
    addToSharedHistory({
      id: userMessage.id,
      role: 'user',
      content: messageText,
      threadId,
      timestamp: new Date()
    });
    
    setInput('');
    setIsLoading(true);
    setCurrentThinking([]);
    setStreamingText('');

    try {
      // Create Claude Agent request based on thread type
      const claudeAgentRequest: ClaudeAgentRequest = {
        query: messageText,
        context: thread.context || messageText,
        taskType: thread.type === 'rfp_analysis' ? 'web_research' : 
                  thread.type === 'knowledge_graph' ? 'context_analysis' : 
                  thread.type === 'sports_intelligence' ? 'context_analysis' : 'general',
        threadType: thread.type,
        threadId,
        userId: currentUserId,
        enableMCP: true,
        maxTokens: 4000
      };

      // Start streaming execution using shared Claude Agent manager
      await sharedClaudeAgentManager.startStreamingTask(
        threadId,
        claudeAgentRequest,
        (chunk: string) => {
          setStreamingText(prev => prev + chunk);
        }
      );
      
      // Get the final response from the Claude Agent instance
      const claudeInstance = sharedClaudeAgentManager.getInstance(threadId);
      if (claudeInstance) {
        const assistantMessage: Message = {
          id: `msg_${Date.now()}_assistant`,
          type: 'assistant',
          content: claudeInstance.currentResponse,
          timestamp: new Date(),
          threadId,
          userId: currentUserId,
          metadata: {
            executionSteps: claudeInstance.executionSteps,
            claudeAgentInstanceId: claudeInstance.id
          }
        };
        
        await actions.addMessage(threadId, assistantMessage);
        
        // Add to shared CopilotKit history
        addToSharedHistory({
          id: assistantMessage.id,
          role: 'assistant',
          content: assistantMessage.content,
          threadId,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      console.error('Claude Agent execution failed:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        type: 'system',
        content: `I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        threadId,
        userId: currentUserId,
        metadata: { error: true }
      };
      
      await actions.addMessage(threadId, errorMessage);
    } finally {
      setIsLoading(false);
      setStreamingText('');
      setCurrentThinking([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startParallelExecution = async () => {
    if (!thread) return;
    
    try {
      await parallelClaudeAgentService.startExecution(
        threadId,
        'Start parallel processing with available tools',
        thread.claudeConfig,
        (step: string, progress: number) => {
          actions.updateExecution(threadId, {
            currentStep: step,
            progress
          });
        },
        (result: any) => {
          actions.completeExecution(threadId, 'Parallel execution completed successfully');
        },
        (error: string) => {
          actions.addNotification(threadId, {
            type: 'error',
            title: 'Parallel Execution Failed',
            message: error,
            priority: 'high'
          });
        }
      );
    } catch (error) {
      console.error('Failed to start parallel execution:', error);
    }
  };

  const getStatusIcon = () => {
    if (executionStatus?.status === 'running') {
      return <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>;
    }
    return null;
  };

  if (!thread) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-400 ${className}`}>
        <div className="text-center">
          <p>Thread not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-custom-bg ${className}`}>
      {/* Thread Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-custom-border">
        <div className="flex items-center gap-3">
          {getStatusIcon()}
          <span className="text-lg font-semibold text-white">{thread.name}</span>
          <span className="px-2 py-1 text-xs rounded-full bg-yellow-500 text-black font-medium">
            {thread.tags.join(', ')}
          </span>
          {thread.hasUnreadActivity && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={startParallelExecution}
            disabled={executionStatus?.status === 'running'}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white hover:bg-custom-border rounded transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {executionStatus?.status === 'running' ? (
              <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>⚡</span>
            )}
            {executionStatus?.status === 'running' ? 'Processing...' : 'Run Parallel'}
          </button>
        </div>
      </div>

      {/* Execution Progress */}
      {executionStatus?.status === 'running' && (
        <div className="px-4 py-2 bg-blue-500/10 border-b border-blue-500/20">
          <div className="flex items-center justify-between text-sm text-blue-400 mb-1">
            <span>{executionStatus.currentStep}</span>
            <span>{Math.round(executionStatus.progress)}%</span>
          </div>
          <div className="w-full bg-blue-500/20 rounded-full h-1">
            <div 
              className="bg-blue-400 h-1 rounded-full transition-all duration-300"
              style={{ width: `${executionStatus.progress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {thread.messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">
              {thread.tags.includes('research') && '🔍'}
              {thread.tags.includes('analysis') && '🧠'}
              {thread.tags.includes('rfp') && '💡'}
              {thread.tags.includes('entities') && '🗂️'}
              {!thread.tags.includes('research') && !thread.tags.includes('analysis') && 
               !thread.tags.includes('rfp') && !thread.tags.includes('entities') && '💬'}
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {thread.claudeConfig.systemPrompt.split('.')[0]}
            </h3>
            <p className="text-gray-400 mb-4">{thread.description}</p>
            <div className="text-xs text-gray-500 max-w-md mx-auto">
              <p className="mb-2">Available tools:</p>
              <div className="flex flex-wrap gap-1 justify-center">
                {thread.claudeConfig.tools.map((tool, index) => (
                  <span key={index} className="px-2 py-1 bg-custom-border rounded text-xs">
                    {tool}
                  </span>
                ))}
              </div>
              {thread.claudeConfig.enableParallelProcessing && (
                <p className="mt-2 text-green-400">✨ Parallel processing enabled</p>
              )}
            </div>
          </div>
        )}

        {thread.messages.map((message) => (
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
              
              {/* Message metadata */}
              {message.metadata && (
                <div className="mt-2 text-xs opacity-75 border-t pt-2">
                  {message.metadata.entities && message.metadata.entities.length > 0 && (
                    <div>📌 Entities: {message.metadata.entities.length}</div>
                  )}
                  {message.metadata.insights && message.metadata.insights.length > 0 && (
                    <div>💡 Insights: {message.metadata.insights.length}</div>
                  )}
                  {message.metadata.processingTime && (
                    <div>⏱️ Processing: {message.metadata.processingTime}ms</div>
                  )}
                </div>
              )}
              
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
            placeholder={`Message ${thread.name.toLowerCase()}...`}
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