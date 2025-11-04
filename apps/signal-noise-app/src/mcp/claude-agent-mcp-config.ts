/**
 * Official MCP Server Configuration for Claude Agent SDK Integration
 * 
 * This configuration provides the proper setup for integrating Better Auth and ByteRover
 * MCP servers with the Claude Agent SDK for enhanced dual memory system functionality.
 */

import { betterAuthMcpServer } from './better-auth-mcp-server';
import { byteRoverMcpServer } from './byte-rover-mcp-server';

export interface MCPServerConfig {
  name: string;
  server: any;
  description: string;
  version: string;
  capabilities: string[];
  tools: string[];
  enabled: boolean;
}

export interface ClaudeAgentMCPConfig {
  // Global MCP configuration
  enableMCP: boolean;
  defaultTimeout: number;
  retryAttempts: number;
  
  // Server configurations
  servers: MCPServerConfig[];
  
  // Session management
  sessionContinuity: boolean;
  maxSessionDuration: number;
  
  // Memory system configuration
  dualMemorySystem: {
    betterAuth: {
      enabled: boolean;
      scope: 'per-user';
      features: string[];
    };
    byteRover: {
      enabled: boolean;
      scope: 'global-shared';
      features: string[];
    };
  };
  
  // Tool integration
  toolMapping: Record<string, string[]>;
  
  // Performance optimization
  caching: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

export const officialMCPConfig: ClaudeAgentMCPConfig = {
  enableMCP: true,
  defaultTimeout: 30000,
  retryAttempts: 3,
  
  servers: [
    {
      name: 'better-auth-mcp',
      server: betterAuthMcpServer,
      description: 'Better Auth integration for per-user conversation memory and preferences',
      version: '1.0.0',
      capabilities: ['memory-storage', 'conversation-history', 'user-preferences', 'entity-tracking'],
      tools: [
        'better-auth-store-memory',
        'better-auth-retrieve-memory', 
        'better-auth-search-memory',
        'better-auth-update-preferences'
      ],
      enabled: true
    },
    {
      name: 'byte-rover-mcp',
      server: byteRoverMcpServer,
      description: 'ByteRover global knowledge sharing system for cross-user intelligence',
      version: '1.0.0',
      capabilities: ['global-memory', 'knowledge-sharing', 'insight-feedback', 'collective-intelligence'],
      tools: [
        'byterover-store-global-insight',
        'byterover-retrieve-global-insights',
        'byterover-apply-insight-feedback', 
        'byterover-get-global-stats',
        'byterover-search-by-context'
      ],
      enabled: true
    }
  ],
  
  sessionContinuity: true,
  maxSessionDuration: 24 * 60 * 60 * 1000, // 24 hours
  
  dualMemorySystem: {
    betterAuth: {
      enabled: true,
      scope: 'per-user',
      features: [
        'conversation-history',
        'insight-storage',
        'entity-tracking', 
        'user-preferences',
        'thread-management'
      ]
    },
    byteRover: {
      enabled: true,
      scope: 'global-shared',
      features: [
        'global-insights',
        'cross-user-learning',
        'collective-intelligence',
        'insight-feedback',
        'knowledge-evolution'
      ]
    }
  },
  
  toolMapping: {
    // Memory operations
    'store-memory': ['better-auth-mcp::better-auth-store-memory'],
    'retrieve-memory': ['better-auth-mcp::better-auth-retrieve-memory'],
    'search-memory': ['better-auth-mcp::better-auth-search-memory'],
    
    // Global knowledge operations
    'store-global-insight': ['byte-rover-mcp::byterover-store-global-insight'],
    'retrieve-global-insights': ['byte-rover-mcp::byterover-retrieve-global-insights'],
    'apply-insight-feedback': ['byte-rover-mcp::byterover-apply-insight-feedback'],
    
    // Analytics operations
    'get-user-stats': ['better-auth-mcp::better-auth-retrieve-memory'],
    'get-global-stats': ['byte-rover-mcp::byterover-get-global-stats'],
    
    // Context-aware operations
    'search-by-context': ['byte-rover-mcp::byterover-search-by-context'],
    'update-preferences': ['better-auth-mcp::better-auth-update-preferences']
  },
  
  caching: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100 // Maximum cached items
  }
};

/**
 * Initialize Claude Agent SDK with official MCP servers
 */
export async function initializeClaudeAgentWithMCP(
  sessionId: string,
  threadConfig: any = {}
): Promise<{
  mcpConfig: ClaudeAgentMCPConfig;
  sessionManager: any;
  toolRegistry: any;
}> {
  console.log(`Initializing Claude Agent SDK with official MCP servers for session ${sessionId}`);
  
  try {
    // Validate MCP servers are available
    const initializedServers = [];
    
    for (const serverConfig of officialMCPConfig.servers) {
      if (serverConfig.enabled) {
        try {
          // Test server availability
          console.log(`Testing MCP server availability: ${serverConfig.name}`);
          
          // Basic health check - try to call a stats or info method
          if (serverConfig.name === 'better-auth-mcp') {
            await serverConfig.server.callTool('better-auth-retrieve-memory', {
              userId: 'health-check',
              type: 'stats'
            });
          } else if (serverConfig.name === 'byte-rover-mcp') {
            await serverConfig.server.callTool('byterover-get-global-stats', {});
          }
          
          initializedServers.push(serverConfig);
          console.log(`✓ MCP server initialized: ${serverConfig.name}`);
        } catch (error) {
          console.error(`✗ Failed to initialize MCP server ${serverConfig.name}:`, error);
          if (serverConfig.name === 'better-auth-mcp' || serverConfig.name === 'byte-rover-mcp') {
            // Essential servers - rethrow error
            throw error;
          }
        }
      }
    }
    
    if (initializedServers.length < 2) {
      throw new Error('Both Better Auth and ByteRover MCP servers are required for dual memory system');
    }
    
    // Create session manager for continuity
    const sessionManager = {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      mcpServers: initializedServers.map(s => s.name),
      
      async storeSessionData(key: string, data: any): Promise<void> {
        const betterAuthServer = initializedServers.find(s => s.name === 'better-auth-mcp');
        if (betterAuthServer) {
          await betterAuthServer.server.callTool('better-auth-store-memory', {
            userId: sessionId,
            threadId: threadConfig.threadId || 'default',
            message: {
              id: `session_${key}`,
              role: 'system',
              content: JSON.stringify(data),
              timestamp: new Date().toISOString(),
              metadata: { type: 'session-data', key }
            }
          });
        }
      },
      
      async retrieveSessionData(key: string): Promise<any> {
        const betterAuthServer = initializedServers.find(s => s.name === 'better-auth-mcp');
        if (betterAuthServer) {
          const result = await betterAuthServer.server.callTool('better-auth-search-memory', {
            userId: sessionId,
            query: `session-data:${key}`,
            limit: 1
          });
          
          if (!result.isError && result.content.length > 0) {
            // Parse session data from response
            const match = result.content[0]?.text?.match(/\\[system\\] (.+)/);
            if (match) {
              try {
                return JSON.parse(match[1]);
              } catch (e) {
                console.warn('Failed to parse session data:', e);
              }
            }
          }
        }
        return null;
      }
    };
    
    // Create tool registry for easy access
    const toolRegistry = {
      // Memory tools
      async storeUserMemory(userId: string, threadId: string, message: any, insights: any[] = [], entities: any[] = []) {
        const betterAuthServer = initializedServers.find(s => s.name === 'better-auth-mcp');
        if (betterAuthServer) {
          return await betterAuthServer.server.callTool('better-auth-store-memory', {
            userId,
            threadId,
            message,
            insights,
            entities
          });
        }
      },
      
      async retrieveUserMemory(userId: string, threadId?: string, type: string = 'all') {
        const betterAuthServer = initializedServers.find(s => s.name === 'better-auth-mcp');
        if (betterAuthServer) {
          return await betterAuthServer.server.callTool('better-auth-retrieve-memory', {
            userId,
            threadId,
            type
          });
        }
      },
      
      // Global knowledge tools
      async storeGlobalInsight(content: string, category: string, confidence: number, sourceUserId: string, context: any = {}, tags: string[] = []) {
        const byteRoverServer = initializedServers.find(s => s.name === 'byte-rover-mcp');
        if (byteRoverServer) {
          return await byteRoverServer.server.callTool('byterover-store-global-insight', {
            content,
            category,
            confidence,
            sourceUserId,
            context,
            tags
          });
        }
      },
      
      async retrieveGlobalInsights(query: string, context: any = {}, limit: number = 5) {
        const byteRoverServer = initializedServers.find(s => s.name === 'byte-rover-mcp');
        if (byteRoverServer) {
          return await byteRoverServer.server.callTool('byterover-retrieve-global-insights', {
            query,
            context,
            limit
          });
        }
      },
      
      async applyInsightFeedback(insightId: string, userId: string, success: boolean, feedback?: string) {
        const byteRoverServer = initializedServers.find(s => s.name === 'byte-rover-mcp');
        if (byteRoverServer) {
          return await byteRoverServer.server.callTool('byterover-apply-insight-feedback', {
            insightId,
            userId,
            success,
            feedback
          });
        }
      },
      
      // Analytics tools
      async getUserStats(userId: string) {
        const betterAuthServer = initializedServers.find(s => s.name === 'better-auth-mcp');
        if (betterAuthServer) {
          return await betterAuthServer.server.callTool('better-auth-retrieve-memory', {
            userId,
            type: 'stats'
          });
        }
      },
      
      async getGlobalStats() {
        const byteRoverServer = initializedServers.find(s => s.name === 'byte-rover-mcp');
        if (byteRoverServer) {
          return await byteRoverServer.server.callTool('byterover-get-global-stats', {});
        }
      }
    };
    
    console.log(`✓ Claude Agent SDK initialized with ${initializedServers.length} official MCP servers`);
    
    return {
      mcpConfig: officialMCPConfig,
      sessionManager,
      toolRegistry
    };
    
  } catch (error) {
    console.error('Failed to initialize Claude Agent SDK with official MCP servers:', error);
    throw error;
  }
}

/**
 * Get thread-specific MCP configuration
 */
export function getThreadMCPConfig(threadType: string): ClaudeAgentMCPConfig {
  const config = { ...officialMCPConfig };
  
  // Customize tools based on thread type
  switch (threadType) {
    case 'rfp_analysis':
      // Enable enhanced global insights for RFP analysis
      config.servers.find(s => s.name === 'byte-rover-mcp')!.tools.push(
        'byterover-search-by-context'
      );
      break;
      
    case 'sports_intelligence':
      // Focus on entity tracking and relationship insights
      config.servers.find(s => s.name === 'better-auth-mcp')!.tools.push(
        'better-auth-search-memory'
      );
      break;
      
    case 'knowledge_graph':
      // Emphasize context-aware search
      config.servers.find(s => s.name === 'byte-rover-mcp')!.tools.push(
        'byterover-search-by-context'
      );
      break;
      
    default:
      // Use default configuration
      break;
  }
  
  return config;
}

/**
 * MCP Tool wrappers for easy integration
 */
export const MCPTools = {
  // Better Auth tools
  betterAuth: {
    storeMemory: async (userId: string, threadId: string, message: any, insights?: any[], entities?: any[]) => {
      return await betterAuthMcpServer.callTool('better-auth-store-memory', {
        userId,
        threadId,
        message,
        insights: insights || [],
        entities: entities || []
      });
    },
    
    retrieveMemory: async (userId: string, threadId?: string, type?: string) => {
      return await betterAuthMcpServer.callTool('better-auth-retrieve-memory', {
        userId,
        threadId,
        type: type || 'all'
      });
    },
    
    searchMemory: async (userId: string, query: string, options?: any) => {
      return await betterAuthMcpServer.callTool('better-auth-search-memory', {
        userId,
        query,
        ...options
      });
    },
    
    updatePreferences: async (userId: string, preferences: any) => {
      return await betterAuthMcpServer.callTool('better-auth-update-preferences', {
        userId,
        ...preferences
      });
    }
  },
  
  // ByteRover tools
  byteRover: {
    storeGlobalInsight: async (content: string, category: string, confidence: number, sourceUserId: string, options?: any) => {
      return await byteRoverMcpServer.callTool('byterover-store-global-insight', {
        content,
        category,
        confidence,
        sourceUserId,
        ...options
      });
    },
    
    retrieveGlobalInsights: async (query: string, options?: any) => {
      return await byteRoverMcpServer.callTool('byterover-retrieve-global-insights', {
        query,
        ...options
      });
    },
    
    applyInsightFeedback: async (insightId: string, userId: string, success: boolean, feedback?: string) => {
      return await byteRoverMcpServer.callTool('byterover-apply-insight-feedback', {
        insightId,
        userId,
        success,
        feedback
      });
    },
    
    getGlobalStats: async () => {
      return await byteRoverMcpServer.callTool('byterover-get-global-stats', {});
    },
    
    searchByContext: async (context: any, options?: any) => {
      return await byteRoverMcpServer.callTool('byterover-search-by-context', {
        context,
        ...options
      });
    }
  }
};

export default officialMCPConfig;