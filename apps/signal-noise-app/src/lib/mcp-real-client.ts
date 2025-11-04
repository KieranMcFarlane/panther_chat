/**
 * Real MCP Client Implementation
 * 
 * Connects to actual MCP servers and provides tools to Claude Agent SDK
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

export class RealMCPClient extends EventEmitter {
  private servers: Map<string, any> = new Map();
  private tools: Map<string, MCPTool> = new Map();
  private messageId = 1;

  async startServer(serverName: string, config: any): Promise<void> {
    console.log(`🚀 Starting MCP server: ${serverName}`);
    
    const server = spawn(config.command, config.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        ...config.env
      }
    });

    let outputBuffer = '';
    let errorOutput = '';

    server.stdout.on('data', (data) => {
      outputBuffer += data.toString();
      
      // Process complete JSON lines
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message: MCPMessage = JSON.parse(line);
            this.emit('message', message);
            this.emit(`message:${message.id}`, message);
          } catch (error) {
            console.warn(`Failed to parse MCP message: ${line}`, error);
          }
        }
      }
    });

    server.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.log(`MCP Server ${serverName} stderr:`, data.toString());
    });

    server.on('error', (error) => {
      console.error(`MCP Server ${serverName} error:`, error);
      this.emit('error', error);
    });

    server.on('exit', (code) => {
      console.log(`MCP Server ${serverName} exited with code: ${code}`);
    });

    this.servers.set(serverName, {
      process: server,
      config,
      outputBuffer,
      errorOutput
    });

    // Wait a moment for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // List available tools
    await this.listTools(serverName);
  }

  async sendMessage(serverName: string, message: MCPMessage): Promise<MCPMessage> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    // Add ID if not present
    if (!message.id) {
      message.id = this.messageId++;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`MCP message timeout for ${message.method}`));
      }, 30000);

      const messageId = message.id;
      
      this.once(`message:${messageId}`, (response: MCPMessage) => {
        clearTimeout(timeout);
        resolve(response);
      });

      // Send the message
      server.process.stdin.write(JSON.stringify(message) + '\n');
    });
  }

  async listTools(serverName: string): Promise<MCPTool[]> {
    try {
      const response = await this.sendMessage(serverName, {
        method: 'tools/list',
        params: {}
      });

      if (response.error) {
        throw new Error(`MCP error: ${response.error.message}`);
      }

      const tools: MCPTool[] = response.result?.tools || [];
      
      // Store tools with server prefix
      for (const tool of tools) {
        const fullToolName = `mcp__${serverName}__${tool.name}`;
        this.tools.set(fullToolName, tool);
      }

      console.log(`✅ Loaded ${tools.length} tools from ${serverName}:`);
      tools.forEach(tool => {
        console.log(`  - mcp__${serverName}__${tool.name}`);
      });

      return tools;
    } catch (error) {
      console.error(`Failed to list tools for ${serverName}:`, error);
      return [];
    }
  }

  async callTool(serverName: string, toolName: string, args: any): Promise<any> {
    const fullToolName = `mcp__${serverName}__${toolName}`;
    
    try {
      const response = await this.sendMessage(serverName, {
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      });

      if (response.error) {
        throw new Error(`MCP tool error: ${response.error.message}`);
      }

      console.log(`✅ MCP tool ${fullToolName} executed successfully`);
      return response.result;
    } catch (error) {
      console.error(`Failed to call tool ${fullToolName}:`, error);
      throw error;
    }
  }

  getAvailableTools(): { [key: string]: MCPTool } {
    const tools: { [key: string]: MCPTool } = {};
    
    this.tools.forEach((tool, name) => {
      tools[name] = tool;
    });
    
    return tools;
  }

  async stopAllServers(): Promise<void> {
    console.log('🛑 Stopping all MCP servers...');
    
    for (const [serverName, server] of this.servers) {
      try {
        server.process.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        server.process.kill('SIGKILL'); // Force kill if still running
      } catch (error) {
        console.error(`Error stopping server ${serverName}:`, error);
      }
    }
    
    this.servers.clear();
    this.tools.clear();
  }
}

// Create and manage MCP client instance
let mcpClient: RealMCPClient | null = null;

export async function getMCPClient(): Promise<RealMCPClient> {
  if (mcpClient) {
    return mcpClient;
  }

  mcpClient = new RealMCPClient();

  // Load MCP configuration
  const fs = require('fs');
  const path = require('path');
  
  const configPath = path.join(process.cwd(), 'mcp-config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log('🔧 Starting all MCP servers...');

  // Start each server
  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    try {
      await mcpClient.startServer(serverName, serverConfig);
    } catch (error) {
      console.error(`Failed to start server ${serverName}:`, error);
    }
  }

  // Wait for all servers to be ready
  await new Promise(resolve => setTimeout(resolve, 3000));

  return mcpClient;
}

export async function createRealMCPTools(): Promise<any[]> {
  const client = await getMCPClient();
  const tools = client.getAvailableTools();
  
  // Convert MCP tools to Claude Agent SDK format
  const claudeTools = [];
  
  for (const [toolName, tool] of Object.entries(tools)) {
    const claudeTool = {
      name: toolName,
      description: tool.description,
      input_schema: tool.inputSchema,
      execute: async (args: any) => {
        console.log(`🔧 Executing MCP tool: ${toolName}`);
        
        // Extract server name from tool name
        const parts = toolName.split('__');
        if (parts.length < 3) {
          throw new Error(`Invalid tool name format: ${toolName}`);
        }
        
        const serverName = parts[1];
        const actualToolName = parts.slice(2).join('__');
        
        return await client.callTool(serverName, actualToolName, args);
      }
    };
    
    claudeTools.push(claudeTool);
  }
  
  console.log(`✅ Created ${claudeTools.length} Claude Agent SDK tools from real MCP servers`);
  return claudeTools;
}

// Cleanup on process exit
process.on('exit', async () => {
  if (mcpClient) {
    await mcpClient.stopAllServers();
  }
});

process.on('SIGINT', async () => {
  if (mcpClient) {
    await mcpClient.stopAllServers();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (mcpClient) {
    await mcpClient.stopAllServers();
  }
  process.exit(0);
});