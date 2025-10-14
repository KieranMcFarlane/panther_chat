/**
 * MCP Client Bus
 * Manages connections to multiple MCP servers and provides unified interface
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

interface MCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
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

export class MCPClientBus {
  private clients: Map<string, Client> = new Map();
  private processes: Map<string, any> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private isInitialized = false;

  constructor(private servers: MCPServerConfig[]) {}

  /**
   * Initialize all MCP server connections
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🔌 Initializing MCP Client Bus...');
    
    for (const serverConfig of this.servers) {
      try {
        await this.connectServer(serverConfig);
        console.log(`✅ Connected to MCP server: ${serverConfig.name}`);
      } catch (error) {
        console.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
        // Continue with other servers even if one fails
      }
    }

    await this.loadTools();
    this.isInitialized = true;
    console.log(`🎉 MCP Client Bus initialized with ${this.clients.size} servers and ${this.tools.size} tools`);
  }

  /**
   * Connect to a single MCP server
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    // Spawn the MCP server process
    const serverProcess = spawn(config.command, config.args, {
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Store process reference for cleanup
    this.processes.set(config.name, serverProcess);

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
          { timeout: 5000 }
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
   * Get tools from a specific server
   */
  getToolsByServer(serverName: string): MCPTool[] {
    return Array.from(this.tools.values()).filter(tool => tool.server === serverName);
  }

  /**
   * Execute a tool call
   */
  async callTool(toolName: string, args: any): Promise<MCPResult> {
    if (!this.isInitialized) {
      throw new Error('MCP Client Bus not initialized');
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
        { timeout: 30000 }
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
      status[serverName] = {
        connected: true,
        toolCount: this.getToolsByServer(serverName).length,
        processId: this.processes.get(serverName)?.pid
      };
    }

    return status;
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [serverName] of this.clients) {
      try {
        await this.clients.get(serverName)?.request(
          { method: 'ping' },
          { timeout: 5000 }
        );
        results[serverName] = true;
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
    console.log('🛑 Shutting down MCP Client Bus...');

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
    for (const [serverName, serverProcess] of this.processes) {
      try {
        serverProcess.kill('SIGTERM');
        console.log(`✅ Killed process: ${serverName}`);
      } catch (error) {
        console.error(`Error killing process ${serverName}:`, error);
      }
    }

    this.clients.clear();
    this.processes.clear();
    this.tools.clear();
    this.isInitialized = false;

    console.log('🎉 MCP Client Bus shut down complete');
  }
}

// Official MCP server configurations
export const MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'neo4j-mcp',
    command: 'npx',
    args: ['-y', '@alanse/mcp-neo4j-server'],
    env: {
      NEO4J_URI: process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io',
      NEO4J_USERNAME: process.env.NEO4J_USERNAME || 'neo4j',
      NEO4J_PASSWORD: process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0',
      NEO4J_DATABASE: process.env.NEO4J_DATABASE || 'neo4j',
      AURA_INSTANCEID: process.env.AURA_INSTANCEID || 'cce1f84b',
      AURA_INSTANCENAME: process.env.AURA_INSTANCENAME || 'Instance01'
    }
  },
  {
    name: 'brightdata',
    command: 'npx',
    args: ['-y', '@brightdata/mcp'],
    env: {
      API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4',
      PRO_MODE: 'true'
    }
  },
  {
    name: 'perplexity-mcp',
    command: 'npx',
    args: ['-y', 'mcp-perplexity-search'],
    env: {
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || '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'
    }
  }
];

// Create singleton instance
export const mcpBus = new MCPClientBus(MCP_SERVERS);