/**
 * 🔧 Fixed MCP Client Bus - Solves Stdio Transport Issues
 * Root cause fix for frictionless A2A + MCP integration
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

/**
 * Fixed MCP Client Bus with proper process spawning
 * Solves the "file argument must be string" error
 */
export class FixedMCPClientBus {
  private clients: Map<string, Client> = new Map();
  private processes: Map<string, any> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private isInitialized = false;

  constructor(private servers: MCPServerConfig[]) {}

  /**
   * Initialize all MCP server connections with fixed spawning
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🔌 Initializing Fixed MCP Client Bus...');
    
    for (const serverConfig of this.servers) {
      try {
        await this.connectServerFixed(serverConfig);
        console.log(`✅ Connected to MCP server: ${serverConfig.name}`);
      } catch (error) {
        console.error(`❌ Failed to connect to MCP server ${serverConfig.name}:`, error);
        // Continue with other servers even if one fails
      }
    }

    await this.loadTools();
    this.isInitialized = true;
    console.log(`🎉 Fixed MCP Client Bus initialized with ${this.clients.size} servers and ${this.tools.size} tools`);
  }

  /**
   * Connect to MCP server with fixed process spawning
   * ROOT CAUSE FIX: Use shell: true and proper command resolution
   */
  private async connectServerFixed(config: MCPServerConfig): Promise<void> {
    console.log(`🔧 Connecting to MCP server: ${config.name}`);
    console.log(`Command: ${config.command}`);
    console.log(`Args: ${config.args.join(' ')}`);
    
    // FIX 1: Use shell: true for proper npx resolution
    // FIX 2: Create full command string to avoid undefined file argument
    const fullCommand = `${config.command} ${config.args.join(' ')}`;
    
    // FIX 3: Pre-resolve the command to ensure it exists
    try {
      await execAsync(`which ${config.command.split(' ')[0]}`);
      console.log(`✅ Command resolved: ${config.command}`);
    } catch (error) {
      console.error(`❌ Command not found: ${config.command}`);
      throw new Error(`Command not found: ${config.command}`);
    }

    // FIX 4: Use shell: true with proper environment
    const serverProcess = spawn(fullCommand, [], {
      shell: true, // This is the key fix!
      env: { ...process.env, ...config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd() // Ensure we're in the right directory
    });

    // Store process reference for cleanup
    this.processes.set(config.name, serverProcess);

    // FIX 5: Add proper error handling and debugging
    serverProcess.on('error', (error) => {
      console.error(`MCP server ${config.name} process error:`, error);
      if (error.code === 'ENOENT') {
        console.error(`Command not found: ${fullCommand}`);
        console.error('Try installing the package globally or checking PATH');
      }
    });

    serverProcess.on('exit', (code, signal) => {
      console.log(`MCP server ${config.name} process exited with code ${code}, signal: ${signal}`);
      this.clients.delete(config.name);
    });

    // FIX 6: Add stdout/stderr debugging
    let stdoutBuffer = '';
    let stderrBuffer = '';

    serverProcess.stdout.on('data', (data) => {
      stdoutBuffer += data.toString();
      console.log(`📨 ${config.name} stdout:`, data.toString().trim());
    });

    serverProcess.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
      console.error(`❌ ${config.name} stderr:`, data.toString().trim());
    });

    // FIX 7: Wait for server to be ready before connecting client
    await this.waitForServerReady(serverProcess, config.name);

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

    // FIX 8: Use proper stdio transport with buffered streams
    const transport = new StdioClientTransport({
      reader: serverProcess.stdout,
      writer: serverProcess.stdin
    });

    // Connect client to transport with retry logic
    let connectionAttempts = 0;
    const maxAttempts = 5;
    
    while (connectionAttempts < maxAttempts) {
      try {
        await client.connect(transport);
        console.log(`✅ MCP client connected: ${config.name}`);
        break;
      } catch (error) {
        connectionAttempts++;
        console.error(`❌ Connection attempt ${connectionAttempts} failed for ${config.name}:`, error.message);
        
        if (connectionAttempts >= maxAttempts) {
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Store client
    this.clients.set(config.name, client);
    console.log(`🎯 MCP server ${config.name} fully connected and ready`);
  }

  /**
   * Wait for MCP server to be ready
   */
  private async waitForServerReady(serverProcess: any, serverName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error(`MCP server ${serverName} failed to start within timeout`));
      }, 15000);

      let readyDetected = false;
      
      // Check for ready signals in output
      const checkReady = (data: string) => {
        if (readyDetected) return;
        
        const readySignals = [
          'MCP server running',
          'server running',
          'ready',
          'started',
          'listening'
        ];
        
        if (readySignals.some(signal => data.toLowerCase().includes(signal))) {
          readyDetected = true;
          clearTimeout(timeout);
          console.log(`✅ MCP server ${serverName} is ready`);
          resolve();
        }
      };

      serverProcess.stdout.on('data', (data: Buffer) => {
        checkReady(data.toString());
      });

      // Also resolve if we get any structured JSON response (indicates server is working)
      serverProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        try {
          JSON.parse(output);
          if (!readyDetected) {
            readyDetected = true;
            clearTimeout(timeout);
            console.log(`✅ MCP server ${serverName} responding with JSON`);
            resolve();
          }
        } catch (e) {
          // Not JSON, continue waiting
        }
      });

      serverProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });

      serverProcess.on('exit', (code: number) => {
        clearTimeout(timeout);
        if (code !== 0 && !readyDetected) {
          reject(new Error(`MCP server ${serverName} exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Load all available tools from connected servers
   */
  private async loadTools(): Promise<void> {
    this.tools.clear();

    for (const [serverName, client] of this.clients) {
      try {
        console.log(`🔍 Loading tools from ${serverName}...`);
        
        const toolsList = await client.request(
          { method: 'tools/list' },
          { timeout: 10000 }
        );

        console.log(`📋 Tools from ${serverName}:`, toolsList);

        if (toolsList.tools) {
          for (const tool of toolsList.tools) {
            this.tools.set(tool.name, {
              ...tool,
              server: serverName
            });
            console.log(`✅ Loaded tool: ${tool.name} from ${serverName}`);
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
      throw new Error('Fixed MCP Client Bus not initialized');
    }

    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool not found: ${toolName}. Available tools: ${Array.from(this.tools.keys()).join(', ')}`);
    }

    const client = this.clients.get(tool.server);
    if (!client) {
      throw new Error(`Server not available for tool: ${toolName}`);
    }

    console.log(`🔧 Calling tool: ${toolName} with args:`, args);

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

      console.log(`✅ Tool ${toolName} result:`, result);
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
      const process = this.processes.get(serverName);
      status[serverName] = {
        connected: true,
        toolCount: this.getToolsByServer(serverName).length,
        processId: process?.pid,
        processAlive: process && !process.killed
      };
    }

    return status;
  }

  /**
   * Health check for all servers
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [serverName, client] of this.clients) {
      try {
        await client.request(
          { method: 'ping' },
          { timeout: 5000 }
        );
        results[serverName] = true;
      } catch (error) {
        console.error(`Health check failed for ${serverName}:`, error.message);
        results[serverName] = false;
      }
    }

    return results;
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    console.log('🛑 Shutting down Fixed MCP Client Bus...');

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
        if (serverProcess && !serverProcess.killed) {
          serverProcess.kill('SIGTERM');
          console.log(`✅ Killed process: ${serverName}`);
        }
      } catch (error) {
        console.error(`Error killing process ${serverName}:`, error);
      }
    }

    this.clients.clear();
    this.processes.clear();
    this.tools.clear();
    this.isInitialized = false;

    console.log('🎉 Fixed MCP Client Bus shut down complete');
  }
}

// Fixed MCP server configurations
export const FIXED_MCP_SERVERS: MCPServerConfig[] = [
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
    }
  },
  {
    name: 'brightdata',
    command: 'npx',
    args: ['-y', '@brightdata/mcp'],
    env: {
      API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || '',
      PRO_MODE: 'true'
    }
  },
  {
    name: 'perplexity-mcp',
    command: 'npx',
    args: ['-y', 'mcp-perplexity-search'],
    env: {
      PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || ''
    }
  }
];

// Create fixed singleton instance
export const fixedMcpBus = new FixedMCPClientBus(FIXED_MCP_SERVERS);