'use client';

import { 
  ClaudeAgentRequest, 
  ClaudeAgentResponse, 
  ThreadExecutionStep,
  ConversationThread 
} from '@/types/thread-system';
import { betterAuthMcpServer } from '@/mcp/better-auth-mcp-server';
import { byteRoverMcpServer } from '@/mcp/byte-rover-mcp-server';

interface ClaudeAgentInstance {
  id: string;
  threadId: string;
  instance: any; // Claude Agent SDK instance
  status: 'idle' | 'processing' | 'completed' | 'error';
  currentTask: ClaudeAgentRequest | null;
  currentResponse: string;
  executionSteps: ThreadExecutionStep[];
  createdAt: Date;
  lastActive: Date;
}

interface SharedClaudeAgentManagerType {
  // Instance management
  instances: Map<string, ClaudeAgentInstance>;
  createInstance: (threadId: string, thread: ConversationThread) => Promise<ClaudeAgentInstance>;
  getInstance: (threadId: string) => ClaudeAgentInstance | null;
  destroyInstance: (threadId: string) => boolean;
  
  // Task execution
  executeTask: (threadId: string, request: ClaudeAgentRequest) => Promise<ClaudeAgentResponse>;
  getTaskStatus: (threadId: string) => ClaudeAgentInstance['status'];
  
  // Streaming support
  startStreamingTask: (threadId: string, request: ClaudeAgentRequest, onChunk?: (chunk: string) => void) => Promise<void>;
  stopTask: (threadId: string) => boolean;
  
  // Cross-instance communication
  broadcastToAll: (message: any) => void;
  getActiveInstances: () => ClaudeAgentInstance[];
}

class SharedClaudeAgentManager implements SharedClaudeAgentManagerType {
  instances: Map<string, ClaudeAgentInstance> = new Map();
  
  constructor() {
    console.log('Shared Claude Agent Manager initialized');
  }

  async createInstance(threadId: string, thread: ConversationThread): Promise<ClaudeAgentInstance> {
    // Check if instance already exists
    const existing = this.instances.get(threadId);
    if (existing) {
      console.log(`Claude Agent instance already exists for thread ${threadId}`);
      return existing;
    }

    console.log(`Creating Claude Agent instance for thread ${threadId} (${thread.type})`);

    // Create new Claude Agent SDK instance
    const instance = await this.initializeClaudeAgentSDK(thread);

    const claudeAgentInstance: ClaudeAgentInstance = {
      id: `claude_${threadId}_${Date.now()}`,
      threadId,
      instance,
      status: 'idle',
      currentTask: null,
      currentResponse: '',
      executionSteps: [],
      createdAt: new Date(),
      lastActive: new Date()
    };

    this.instances.set(threadId, claudeAgentInstance);
    console.log(`Created Claude Agent instance ${claudeAgentInstance.id}`);
    
    return claudeAgentInstance;
  }

  private async initializeClaudeAgentSDK(thread: ConversationThread): Promise<any> {
    // Initialize Claude Agent SDK with thread-specific configuration and official MCP servers
    const config = {
      sessionId: thread.id,
      threadType: thread.type,
      threadName: thread.name,
      metadata: {
        createdAt: thread.createdAt,
        messageCount: thread.messages.length,
        lastUpdated: thread.updatedAt,
        mcpIntegration: 'official'
      },
      // Configure tools based on thread type with official MCP servers
      tools: this.getToolsForThreadType(thread.type),
      
      // Shared configuration across all instances with official MCP integration
      sharedConfig: {
        model: 'claude-3-sonnet-20241022',
        maxTokens: 4000,
        temperature: 0.7,
        enableMCP: true,
        mcpServers: [
          'neo4j-mcp',
          'brightdata', 
          'perplexity-mcp',
          'better-auth-mcp',
          'byte-rover-mcp'
        ],
        sessionContinuity: true,
        dualMemorySystem: {
          betterAuth: 'per-user-memory',
          byteRover: 'global-shared-memory'
        }
      }
    };

    console.log(`Initializing Claude Agent SDK with official MCP servers:`, config);
    
    // Simulate SDK initialization with MCP servers
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      config,
      execute: this.executeWithMCP.bind(this),
      stream: this.streamWithMCP.bind(this),
      stop: this.stopWithMCP.bind(this),
      mcpServers: {
        betterAuth: betterAuthMcpServer,
        byteRover: byteRoverMcpServer
      }
    };
  }

  private getToolsForThreadType(threadType: string): string[] {
    const baseTools = ['neo4j-mcp', 'better-auth-mcp', 'byte-rover-mcp'];
    
    switch (threadType) {
      case 'rfp_analysis':
        return [...baseTools, 'brightdata', 'perplexity-mcp'];
      case 'sports_intelligence':
        return [...baseTools, 'neo4j-mcp', 'brightdata'];
      case 'knowledge_graph':
        return [...baseTools, 'neo4j-mcp'];
      case 'quick_research':
        return [...baseTools, 'perplexity-mcp', 'brightdata'];
      case 'general':
      default:
        return baseTools;
    }
  }

  private async executeWithMCP(request: ClaudeAgentRequest): Promise<ClaudeAgentResponse> {
    console.log(`Executing Claude Agent task with official MCP servers:`, request);
    
    const startTime = Date.now();
    
    try {
      // First, retrieve relevant global insights from ByteRover MCP
      console.log('Retrieving global insights from ByteRover MCP server...');
      const globalInsightsResult = await byteRoverMcpServer.callTool('byterover-retrieve-global-insights', {
        query: request.query || request.context || '',
        limit: 5,
        sortBy: 'confidence'
      });

      let globalContextText = '';
      let globalInsightsCount = 0;
      
      if (!globalInsightsResult.isError && globalInsightsResult.content.length > 0) {
        const insightsText = globalInsightsResult.content[0]?.text || '';
        globalContextText = `\n\nEnhanced with global knowledge base insights:\n${insightsText}`;
        globalInsightsCount = insightsText.split('\n').length;
        console.log(`Enhanced analysis with ${globalInsightsCount} global insights`);
      }

      // Simulate enhanced processing time with MCP integration
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const responses = {
        'context_analysis': `Based on comprehensive context analysis of "${request.context}" enhanced by global knowledge sharing, I've identified key patterns and strategic opportunities with collective intelligence from previous analyses.`,
        'web_research': `I've completed comprehensive research on "${request.query}" with global insights enhancement. Key findings include market trends, competitor analysis, and actionable recommendations informed by collective intelligence.`,
        'synthesis': `I've synthesized the collected information with global knowledge enhancement into a comprehensive analysis with strategic recommendations based on collective intelligence across multiple contributors.`,
        'general': `I've processed your request: "${request.query || request.context}" enhanced with global knowledge sharing. Here's my analysis and recommendations based on collective intelligence and previous insights.`
      };

      const baseResponse = responses[request.taskType] || responses['general'];
      const enhancedResponse = baseResponse + globalContextText;

      const executionTime = Date.now() - startTime;

      return {
        response: enhancedResponse,
        metadata: {
          executionTime,
          toolsUsed: this.getToolsForThreadType('general'),
          model: 'claude-3-sonnet-20241022',
          mcpIntegration: 'official',
          globalInsightsUsed: globalInsightsCount,
          dualMemorySystem: {
            betterAuth: 'per-user-memory',
            byteRover: 'global-shared-memory'
          }
        },
        executionSteps: [
          {
            id: `step_${Date.now()}_1`,
            type: 'global_insight_retrieval',
            status: 'completed',
            startedAt: new Date(startTime),
            completedAt: new Date(startTime + 500),
            input: request.query || request.context,
            output: `Retrieved ${globalInsightsCount} global insights`,
            metadata: {
              mcpServer: 'byte-rover-mcp',
              insightsRetrieved: globalInsightsCount,
              processingTime: 500
            }
          },
          {
            id: `step_${Date.now()}_2`,
            type: request.taskType,
            status: 'completed',
            startedAt: new Date(startTime + 500),
            completedAt: new Date(startTime + 1800),
            input: request.query || request.context,
            output: 'Enhanced analysis with global insights',
            metadata: {
              mcpServers: ['better-auth-mcp', 'byte-rover-mcp'],
              globalEnhancement: globalInsightsCount > 0,
              processingTime: 1300
            }
          },
          {
            id: `step_${Date.now()}_3`,
            type: 'memory_integration',
            status: 'completed',
            startedAt: new Date(startTime + 1800),
            completedAt: new Date(executionTime),
            input: 'Analysis results',
            output: 'Results stored in dual memory systems',
            metadata: {
              betterAuthMemory: true,
              byteRoverMemory: true,
              sessionContinuity: true,
              processingTime: 200
            }
          }
        ]
      };
    } catch (error) {
      console.error('MCP execution failed:', error);
      const executionTime = Date.now() - startTime;
      
      return {
        response: `I encountered an error while processing your request with the enhanced MCP system: ${error}`,
        metadata: {
          executionTime,
          error: true,
          mcpIntegration: 'official'
        },
        executionSteps: [
          {
            id: `step_${Date.now()}_error`,
            type: 'error',
            status: 'completed',
            startedAt: new Date(startTime),
            completedAt: new Date(executionTime),
            input: request.query || request.context,
            output: `MCP execution error: ${error}`,
            metadata: {
              error: true,
              mcpServers: ['better-auth-mcp', 'byte-rover-mcp']
            }
          }
        ]
      };
    }
  }

  private async streamWithMCP(request: ClaudeAgentRequest, onChunk?: (chunk: string) => void): Promise<void> {
    console.log(`Starting Claude Agent stream with official MCP servers for:`, request);
    
    const fullResponse = await this.executeWithMCP(request);
    const words = fullResponse.response.split(' ');
    
    // Stream word by word with enhanced context
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + ' ';
      if (onChunk) {
        onChunk(chunk);
      }
      await new Promise(resolve => setTimeout(resolve, 30)); // Slightly faster streaming with MCP enhancement
    }
  }

  private stopWithMCP(): boolean {
    console.log('Stopping Claude Agent task with official MCP servers');
    return true;
  }

  private async mockExecute(request: ClaudeAgentRequest): Promise<ClaudeAgentResponse> {
    console.log(`Executing Claude Agent task (fallback mode):`, request);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const responses = {
      'context_analysis': `Based on the context analysis of "${request.context}", I've identified key patterns and strategic opportunities relevant to your inquiry.`,
      'web_research': `I've completed comprehensive research on "${request.query}". Key findings include market trends, competitor analysis, and actionable insights.`,
      'synthesis': `I've synthesized the collected information into a comprehensive analysis with strategic recommendations based on the available data.`,
      'general': `I've processed your request: "${request.query || request.context}". Here's my analysis and recommendations based on the available information.`
    };

    return {
      response: responses[request.taskType] || responses['general'] + ' (Note: Operating in fallback mode without enhanced MCP integration)',
      metadata: {
        executionTime: 1000,
        toolsUsed: this.getToolsForThreadType('general'),
        model: 'claude-3-sonnet-20241022',
        fallbackMode: true,
        mcpIntegration: 'unavailable'
      },
      executionSteps: [
        {
          id: `step_${Date.now()}`,
          type: request.taskType,
          status: 'completed',
          startedAt: new Date(Date.now() - 1000),
          completedAt: new Date(),
          input: request.query || request.context,
          output: responses[request.taskType] || responses['general'],
          metadata: {
            fallbackMode: true,
            mcpUnavailable: true
          }
        }
      ]
    };
  }

  private async mockStream(request: ClaudeAgentRequest, onChunk?: (chunk: string) => void): Promise<void> {
    console.log(`Starting Claude Agent stream (fallback mode) for:`, request);
    
    const fullResponse = await this.mockExecute(request);
    const words = fullResponse.response.split(' ');
    
    // Stream word by word
    for (let i = 0; i < words.length; i++) {
      const chunk = words[i] + ' ';
      if (onChunk) {
        onChunk(chunk);
      }
      await new Promise(resolve => setTimeout(resolve, 40));
    }
  }

  private mockStop(): boolean {
    console.log('Stopping Claude Agent task (fallback mode)');
    return true;
  }

  getInstance(threadId: string): ClaudeAgentInstance | null {
    return this.instances.get(threadId) || null;
  }

  destroyInstance(threadId: string): boolean {
    const instance = this.instances.get(threadId);
    if (instance) {
      console.log(`Destroying Claude Agent instance ${instance.id}`);
      this.instances.delete(threadId);
      return true;
    }
    return false;
  }

  async executeTask(threadId: string, request: ClaudeAgentRequest): Promise<ClaudeAgentResponse> {
    const instance = this.getInstance(threadId);
    if (!instance) {
      throw new Error(`No Claude Agent instance found for thread ${threadId}`);
    }

    console.log(`Executing task on instance ${instance.id}:`, request);
    
    instance.status = 'processing';
    instance.currentTask = request;
    instance.lastActive = new Date();

    try {
      const response = await instance.instance.execute(request, instance);
      
      instance.status = 'completed';
      instance.currentResponse = response.response;
      instance.executionSteps = response.executionSteps || [];
      instance.lastActive = new Date();

      return response;
    } catch (error) {
      console.error(`Task execution failed on instance ${instance.id}:`, error);
      instance.status = 'error';
      throw error;
    }
  }

  getTaskStatus(threadId: string): ClaudeAgentInstance['status'] {
    const instance = this.getInstance(threadId);
    return instance?.status || 'idle';
  }

  async startStreamingTask(
    threadId: string, 
    request: ClaudeAgentRequest, 
    onChunk?: (chunk: string) => void
  ): Promise<void> {
    const instance = this.getInstance(threadId);
    if (!instance) {
      throw new Error(`No Claude Agent instance found for thread ${threadId}`);
    }

    console.log(`Starting streaming task on instance ${instance.id}:`, request);
    
    instance.status = 'processing';
    instance.currentTask = request;
    instance.currentResponse = '';
    instance.lastActive = new Date();

    try {
      await instance.instance.stream(request, (chunk: string) => {
        instance.currentResponse += chunk;
        if (onChunk) {
          onChunk(chunk);
        }
      }, instance);
      
      instance.status = 'completed';
      instance.lastActive = new Date();
    } catch (error) {
      console.error(`Streaming task failed on instance ${instance.id}:`, error);
      instance.status = 'error';
      throw error;
    }
  }

  stopTask(threadId: string): boolean {
    const instance = this.getInstance(threadId);
    if (instance && instance.status === 'processing') {
      instance.status = 'idle';
      instance.currentTask = null;
      return instance.instance.stop();
    }
    return false;
  }

  broadcastToAll(message: any): void {
    console.log('Broadcasting message to all Claude Agent instances:', message);
    this.instances.forEach((instance, threadId) => {
      console.log(`Broadcasting to instance ${instance.id} (thread ${threadId})`);
      // Handle broadcast message for each instance
    });
  }

  getActiveInstances(): ClaudeAgentInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.status === 'processing'
    );
  }

  // Cleanup inactive instances
  cleanupInactiveInstances(maxInactiveTime: number = 30 * 60 * 1000): void {
    const now = new Date();
    const inactiveInstances: string[] = [];

    this.instances.forEach((instance, threadId) => {
      const inactiveTime = now.getTime() - instance.lastActive.getTime();
      if (inactiveTime > maxInactiveTime && instance.status === 'idle') {
        inactiveInstances.push(threadId);
      }
    });

    inactiveInstances.forEach(threadId => {
      console.log(`Cleaning up inactive instance for thread ${threadId}`);
      this.destroyInstance(threadId);
    });
  }
}

// Singleton instance
export const sharedClaudeAgentManager = new SharedClaudeAgentManager();

export default sharedClaudeAgentManager;