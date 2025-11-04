/**
 * Claude Agent SDK Bridge for Real MCP Servers
 * 
 * Connects Claude Agent SDK to real MCP servers like BrightData
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'child_process';

interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: any;
  }>;
  isError?: boolean;
}

export class MCPClaudeSDKBridge {
  private servers: Map<string, any> = new Map();
  private messageId = 1;

  async startServer(serverName: string, config: any): Promise<void> {
    console.log(`🚀 Starting MCP server for Claude Agent SDK: ${serverName}`);
    
    const server = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...config.env
      }
    });

    this.servers.set(serverName, server);
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`✅ MCP server ${serverName} started for Claude Agent SDK`);
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    return new Promise((resolve, reject) => {
      let outputBuffer = '';
      const messageId = this.messageId++;

      const handleOutput = (data: Buffer) => {
        outputBuffer += data.toString();
        
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              
              if (message.id === messageId) {
                // Got response for our tool call
                server.stdout.off('data', handleOutput);
                
                if (message.error) {
                  reject(new Error(`MCP tool error: ${message.error.message}`));
                } else {
                  resolve(message.result);
                }
                return;
              }
            } catch (error) {
              console.warn(`Failed to parse MCP message: ${line}`);
            }
          }
        }
      };

      server.stdout.on('data', handleOutput);

      // Send tool call request
      const request = {
        jsonrpc: '2.0',
        id: messageId,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      };

      server.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        server.stdout.off('data', handleOutput);
        reject(new Error('MCP tool call timeout'));
      }, 30000);
    });
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping MCP servers...');
    
    for (const [serverName, server] of this.servers) {
      try {
        server.kill('SIGTERM');
      } catch (error) {
        console.error(`Error stopping server ${serverName}:`, error);
      }
    }
    
    this.servers.clear();
  }
}

// Global bridge instance
let bridge: MCPClaudeSDKBridge | null = null;

export async function getMCPClaudeSDKBridge(): Promise<MCPClaudeSDKBridge> {
  if (bridge) {
    return bridge;
  }

  bridge = new MCPClaudeSDKBridge();

  // Start BrightData MCP server
  await bridge.startServer('brightData', {
    command: 'npx',
    args: ['-y', '@brightdata/mcp'],
    env: {
      API_TOKEN: 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
      PRO_MODE: 'true'
    }
  });

  return bridge;
}

// Create Claude Agent SDK tools that use real MCP servers
export async function createRealClaudeSDKTools(): Promise<any[]> {
  const bridge = await getMCPClaudeSDKBridge();
  
  const tools = [];

  // BrightData search_engine tool
  const brightDataSearchTool = tool('mcp__brightData__search_engine',
    'Search Google, Bing or Yandex using BrightData MCP server. Returns real search results in markdown format with URLs and descriptions.',
    {
      query: {
        type: 'string',
        description: 'Search query to execute',
        required: true
      },
      engine: {
        type: 'string',
        description: 'Search engine to use (google, bing, yandex)',
        enum: ['google', 'bing', 'yandex'],
        default: 'google'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor for next page',
        required: false
      }
    },
    async ({ query, engine = 'google', cursor }) => {
      console.log(`🔍 BRIGHTDATA REAL MCP: Searching for "${query}" on ${engine}`);
      
      try {
        const result: MCPToolResult = await bridge.callTool('brightData', 'search_engine', {
          query,
          engine,
          cursor
        });
        
        console.log(`✅ BRIGHTDATA REAL MCP RESULT: ${result.content?.length || 0} content blocks`);
        
        // Extract the text content from the MCP result
        if (result.content && result.content.length > 0) {
          const textContent = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
          
          return {
            success: true,
            content: textContent,
            rawResult: result,
            isRealData: true,
            source: 'brightdata_mcp_server'
          };
        } else {
          return {
            success: false,
            error: 'No content returned from MCP server',
            rawResult: result
          };
        }
      } catch (error) {
        console.error(`❌ BRIGHTDATA REAL MCP ERROR: ${error.message}`);
        return {
          success: false,
          error: error.message,
          source: 'brightdata_mcp_server'
        };
      }
    }
  );

  // BrightData scrape_as_markdown tool
  const brightDataScrapeTool = tool('mcp__brightData__scrape_as_markdown',
    'Scrape a single webpage URL and return content in markdown format using BrightData MCP server.',
    {
      url: {
        type: 'string',
        format: 'uri',
        description: 'URL to scrape',
        required: true
      }
    },
    async ({ url }) => {
      console.log(`🔍 BRIGHTDATA REAL MCP: Scraping URL ${url}`);
      
      try {
        const result: MCPToolResult = await bridge.callTool('brightData', 'scrape_as_markdown', { url });
        
        console.log(`✅ BRIGHTDATA REAL MCP SCRAPE: ${result.content?.length || 0} content blocks`);
        
        if (result.content && result.content.length > 0) {
          const textContent = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n');
          
          return {
            success: true,
            content: textContent,
            url,
            rawResult: result,
            isRealData: true,
            source: 'brightdata_mcp_server'
          };
        } else {
          return {
            success: false,
            error: 'No content returned from MCP server',
            url,
            rawResult: result
          };
        }
      } catch (error) {
        console.error(`❌ BRIGHTDATA REAL MCP SCRAPE ERROR: ${error.message}`);
        return {
          success: false,
          error: error.message,
          url,
          source: 'brightdata_mcp_server'
        };
      }
    }
  );

  tools.push(brightDataSearchTool);
  tools.push(brightDataScrapeTool);
  
  console.log(`✅ Created ${tools.length} real Claude Agent SDK tools from MCP servers`);
  
  return tools;
}

// Cleanup on process exit
process.on('exit', async () => {
  if (bridge) {
    await bridge.stop();
  }
});

process.on('SIGINT', async () => {
  if (bridge) {
    await bridge.stop();
  }
  process.exit(0);
});