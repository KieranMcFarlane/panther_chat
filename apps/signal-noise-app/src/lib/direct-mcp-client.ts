/**
 * Direct MCP Client for Headless Verifier
 * 
 * Connects to the running MCP server process via direct HTTP calls
 */

interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

class DirectMCPClient {
  private isConnected = false;
  private baseUrl = 'http://localhost:3005';
  private connectPromise: Promise<void> | null = null;

  async connect(): Promise<void> {
    try {
      console.log('🔌 Checking for existing Headless Verifier MCP server...');
      
      // Check if MCP server is running by testing the tools endpoint
      const response = await fetch(`${this.baseUrl}/api/mcp-status`);
      
      if (response.ok) {
        this.isConnected = true;
        console.log('✅ Connected to Headless Verifier MCP server');
        return;
      }
      
      console.log('⚠️ MCP server not responding, but continuing with direct calls...');
      this.isConnected = true; // We'll try direct calls
      
    } catch (error) {
      console.log('⚠️ Could not verify MCP server status, but will attempt direct calls...');
      this.isConnected = true;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connect().finally(() => {
        this.connectPromise = null;
      });
    }

    await this.connectPromise;
  }

  async callTool(toolName: string, args: any): Promise<MCPToolResult> {
    await this.ensureConnected();

    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const result = await this.client.request(
        {
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args
          }
        },
        { timeout: 60000 } // 60 second timeout
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

  async getAvailableTools(): Promise<any[]> {
    await this.ensureConnected();

    if (!this.isConnected || !this.client) {
      throw new Error('MCP client not connected');
    }

    try {
      const toolsList = await this.client.request(
        { method: 'tools/list' },
        { timeout: 5000 }
      );
      return toolsList.tools || [];
    } catch (error) {
      console.error('Failed to get tools:', error);
      return [];
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing client:', error);
      }
    }

    if (this.serverProcess) {
      try {
        this.serverProcess.kill('SIGTERM');
      } catch (error) {
        console.error('Error killing process:', error);
      }
    }

    this.isConnected = false;
    console.log('🛑 Disconnected from MCP server');
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }
}

// Create singleton instance
export const directMCPClient = new DirectMCPClient();
