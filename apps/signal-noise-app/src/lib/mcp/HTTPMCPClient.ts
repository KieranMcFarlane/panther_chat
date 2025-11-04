/**
 * 🌐 Direct stdio MCP Transport
 * Uses stdio transport for reliable MCP server communication
 * This enables frictionless A2A + MCP integration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  url?: string; // HTTP endpoint for MCP server
  port?: number; // Port to run HTTP server on
}

interface MCPTool {
  name: string;
  description: string;
  server: string;
}

interface MCPResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Direct MCP Client Manager
 * Uses stdio transport for reliable A2A integration
 */
export class HTTPMCPClientManager {
  private clients: Map<string, Client> = new Map();
  private servers: Map<string, any> = new Map(); // HTTP server references
  private tools: Map<string, MCPTool> = new Map();
  private isInitialized = false;

  constructor(private serversConfig: MCPServerConfig[]) {}

  /**
   * Initialize HTTP-based MCP connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🌐 Initializing Direct MCP Client Manager...');
    
    for (const serverConfig of this.serversConfig) {
      try {
        await this.connectMCPServer(serverConfig);
        console.log(`✅ Connected to MCP server: ${serverConfig.name}`);
      } catch (error) {
        console.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
        // Continue with other servers even if one fails
      }
    }

    await this.loadTools();
    this.isInitialized = true;
    console.log(`🎉 MCP Client Manager initialized with ${this.clients.size} servers and ${this.tools.size} tools`);
  }

  /**
   * Connect to MCP server via stdio transport
   */
  private async connectMCPServer(config: MCPServerConfig): Promise<void> {
    // Spawn the MCP server process
    const serverProcess = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Store process reference for cleanup
    this.servers.set(config.name, { process: serverProcess });

    // Create client and transport
    const client = new Client(
      {
        name: `signal-noise-client-${config.name}`,
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    const transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin
    });

    // Connect client to transport
    await client.connect(transport);
    
    // Store client
    this.clients.set(config.name, client);

    // Handle process errors
    serverProcess.on('error', (error) => {
      console.error(`MCP server ${config.name} process error:`, error);
    });

    serverProcess.on('exit', (code) => {
      console.log(`MCP server ${config.name} process exited with code ${code}`);
      this.clients.delete(config.name);
    });

    console.log(`🔗 MCP client connected for ${config.name}`);
  }

  
  /**
   * Load all available tools from connected servers
   */
  private async loadTools(): Promise<void> {
    this.tools.clear();

    for (const [serverName, client] of this.clients) {
      try {
        const toolsList = await client.request(
          { method: 'tools/list' },
          { timeout: 10000 }
        );

        if (toolsList.tools) {
          for (const tool of toolsList.tools) {
            this.tools.set(tool.name, {
              ...tool,
              server: serverName
            });
          }
        }
      } catch (error) {
        console.error(`Failed to load tools from ${serverName}:`, error);
      }
    }
  }

  /**
   * Get list of all available tools
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute a tool call via HTTP
   */
  async callTool(toolName: string, args: any): Promise<MCPResult> {
    if (!this.isInitialized) {
      throw new Error('HTTP MCP Client Manager not initialized');
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    const client = this.clients.get(tool.server);
    if (!client) {
      throw new Error(`Server not available for tool: ${toolName}`);
    }

    try {
      const result = await client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        { timeout: 60000 }
      );

      return result;
    } catch (error) {
      console.error(`Error calling tool ${toolName}:`, error);
      return {
        content: [{
          type: 'text',
          text: `Error calling ${toolName}: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Get server status
   */
  getServerStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [serverName, client] of this.clients) {
      const serverInfo = this.servers.get(serverName);
      status[serverName] = {
        connected: true,
        toolCount: this.getToolsByServer(serverName).length,
        url: serverInfo?.url || 'stdio',
        port: serverInfo?.port,
        type: serverInfo?.url ? 'http' : 'stdio'
      };
    }

    return status;
  }

  /**
   * Get tools from a specific server
   */
  getToolsByServer(serverName: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.server === serverName);
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [serverName] of this.clients) {
      try {
        const serverInfo = this.servers.get(serverName);
        if (serverInfo?.url) {
          // HTTP health check
          const response = await fetch(`${serverInfo.url}/health`);
          results[serverName] = response.ok;
        } else {
          // Direct client ping
          await this.clients.get(serverName)?.request(
            { method: 'ping' },
            { timeout: 5000 }
          );
          results[serverName] = true;
        }
      } catch (error) {
        results[serverName] = false;
      }
    }

    return results;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log('🛑 Shutting down MCP Client Manager...');

    // Close all clients
    for (const [serverName, client] of this.clients) {
      try {
        await client.close();
        console.log(`✅ Closed client: ${serverName}`);
      } catch (error) {
        console.error(`Error closing client ${serverName}:`, error);
      }
    }

    // Kill all processes
    for (const [serverName, serverInfo] of this.servers) {
      try {
        if (serverInfo.process) {
          serverInfo.process.kill('SIGTERM');
          console.log(`✅ Killed process: ${serverName}`);
        }
      } catch (error) {
        console.error(`Error killing process ${serverName}:`, error);
      }
    }

    this.clients.clear();
    this.servers.clear();
    this.tools.clear();
    this.isInitialized = false;

    console.log('🎉 MCP Client Manager shut down complete');
  }
}

// MCP server configurations
export const HTTP_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'neo4j-mcp',
    command: 'npx',
    args: ['-y', '@alanse/mcp-neo4j-server'],
    env: {
      NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
      NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || '',
      NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'neo4j',
      AURA_INSTANCEID: process.env.AURA_INSTANCEID || 'cce1f84b',
      AURA_INSTANCENAME: process.env.AURA_INSTANCENAME || 'Instance01'
    },
    port: 3010 // Specific port for Neo4j MCP
  },
  {
    name: 'brightdata',
    command: 'npx',
    args: ['-y', '@brightdata/mcp'],
    env: {
      API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || '',
      PRO_MODE: 'true'
    },
    port: 3011 // Specific port for BrightData MCP
  },
  {
    name: 'perplexity-mcp',
    command: 'npx',
    args: ['-y', 'mcp-perplexity-search'],
    env: {
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || ''
    },
    port: 3012 // Specific port for Perplexity MCP
  }
];

// Create singleton instance
export const httpMcpManager = new HTTPMCPClientManager(HTTP_MCP_SERVERS);