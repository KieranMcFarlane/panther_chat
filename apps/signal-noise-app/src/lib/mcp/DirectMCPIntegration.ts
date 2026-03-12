/**
 * 🚀 Direct API-based MCP Integration for A2A
 * Bypasses stdio transport issues completely
 * Provides frictionless MCP + A2A integration
 */

interface MCPToolCall {
  server: string;
  tool: string;
  args: any;
  env?: Record<string, string>;
}

interface MCPResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

/**
 * Direct MCP Integration - Calls MCP tools directly via npx
 * This eliminates stdio transport complexity for A2A integration
 */
export class DirectMCPIntegration {
  
  /**
   * Execute graph MCP tool directly
   */
  async executeGraphQuery(query: string): Promise<MCPResult> {
    console.log(`🔍 Executing graph query: ${query}`);
    
    try {
      const env = {
        FALKORDB_URI: process.env.FALKORDB_URI || '',
        FALKORDB_USER: process.env.FALKORDB_USER || '',
        FALKORDB_PASSWORD: process.env.FALKORDB_PASSWORD || '',
        FALKORDB_DATABASE: process.env.FALKORDB_DATABASE || '',
      };

      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "execute_query",
          arguments: { query }
        }
      };

      const result = await this.executeMCPCommand('python3', ['backend/falkordb_mcp_server_fastmcp.py'], request, env);
      
      return {
        content: [{
          type: 'text',
          text: result.content?.[0]?.text || JSON.stringify(result)
        }],
        isError: false
      };

    } catch (error) {
      console.error(`Graph MCP error:`, error);
      return {
        content: [{
          type: 'text',
          text: `Graph query failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Execute BrightData search tool directly
   */
  async executeBrightDataSearch(query: string, engine: string = 'google'): Promise<MCPResult> {
    console.log(`🔍 Executing BrightData search: ${query} (${engine})`);
    
    try {
      const env = {
        API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || '',
        PRO_MODE: 'true'
      };

      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "search_engine",
          arguments: { query, engine }
        }
      };

      const result = await this.executeMCPCommand('npx', ['-y', '@brightdata/mcp'], request, env);
      
      return {
        content: [{
          type: 'text',
          text: result.content?.[0]?.text || JSON.stringify(result)
        }],
        isError: false
      };

    } catch (error) {
      console.error(`BrightData MCP error:`, error);
      return {
        content: [{
          type: 'text',
          text: `BrightData search failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Execute Perplexity chat tool directly
   */
  async executePerplexityChat(messages: any[], model: string = 'sonar-pro', options: any = {}): Promise<MCPResult> {
    console.log(`🤖 Executing Perplexity chat with ${model}`);
    
    try {
      const env = {
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || ''
      };

      const request = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "chat_completion",
          arguments: {
            messages,
            model,
            max_tokens: options.max_tokens || 1024,
            temperature: options.temperature || 0.7,
            format: options.format || 'markdown',
            include_sources: options.include_sources || true
          }
        }
      };

      const result = await this.executeMCPCommand('npx', ['-y', 'mcp-perplexity-search'], request, env);
      
      return {
        content: [{
          type: 'text',
          text: result.content?.[0]?.text || JSON.stringify(result)
        }],
        isError: false
      };

    } catch (error) {
      console.error(`Perplexity MCP error:`, error);
      return {
        content: [{
          type: 'text',
          text: `Perplexity chat failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  /**
   * Execute MCP command directly via npx spawn
   * This bypasses all stdio transport complexity
   */
  private async executeMCPCommand(command: string, args: string[], request: any, env: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      
      console.log(`🚀 Executing MCP: ${command} ${args.join(' ')}`);
      console.log(`📤 Request:`, JSON.stringify(request, null, 2));
      
      const child = spawn(command, args, {
        env: { ...process.env, ...env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
        timeout: 60000
      });

      let stdout = '';
      let stderr = '';
      let timeoutId: NodeJS.Timeout;

      // Set timeout
      timeoutId = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('MCP command timed out after 60 seconds'));
      }, 60000);

      // Collect stdout
      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
        console.log(`📨 MCP stdout:`, data.toString().trim());
      });

      // Collect stderr
      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        console.log(`⚠️ MCP stderr:`, data.toString().trim());
      });

      // Handle process completion
      child.on('close', (code: number) => {
        clearTimeout(timeoutId);
        
        if (code !== 0) {
          console.error(`❌ MCP process exited with code ${code}`);
          console.error(`stderr:`, stderr);
          reject(new Error(`MCP process failed with exit code ${code}: ${stderr}`));
          return;
        }

        try {
          // Parse the response
          const lines = stdout.trim().split('\n');
          let lastValidJSON = null;
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.result || parsed.error) {
                  lastValidJSON = parsed;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }

          if (lastValidJSON) {
            console.log(`✅ MCP response received:`, lastValidJSON);
            resolve(lastValidJSON);
          } else {
            console.error(`❌ No valid JSON response found in stdout`);
            console.error(`Raw stdout:`, stdout);
            reject(new Error('No valid JSON response from MCP server'));
          }

        } catch (parseError) {
          console.error(`❌ Failed to parse MCP response:`, parseError);
          console.error(`Raw stdout:`, stdout);
          reject(new Error(`Failed to parse MCP response: ${parseError.message}`));
        }
      });

      // Handle process error
      child.on('error', (error: Error) => {
        clearTimeout(timeoutId);
        console.error(`❌ MCP process error:`, error);
        reject(error);
      });

      // Send the request
      child.stdin.write(JSON.stringify(request) + '\n');
      child.stdin.end();
    });
  }

  /**
   * Get available tools from each MCP server
   */
  async getAvailableTools(): Promise<any[]> {
    const tools = [];

    // Graph tools
    try {
      const graphRequest = {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {}
      };

      const graphResult = await this.executeMCPCommand('python3', ['backend/falkordb_mcp_server_fastmcp.py'], graphRequest, {
        FALKORDB_URI: process.env.FALKORDB_URI || '',
        FALKORDB_USER: process.env.FALKORDB_USER || '',
        FALKORDB_PASSWORD: process.env.FALKORDB_PASSWORD || '',
        FALKORDB_DATABASE: process.env.FALKORDB_DATABASE || '',
      });

      if (graphResult.result?.tools) {
        tools.push(...graphResult.result.tools.map(tool => ({
          ...tool,
          server: 'graph-mcp'
        })));
      }
    } catch (error) {
      console.error('Failed to get graph tools:', error);
    }

    // BrightData tools
    try {
      const brightdataRequest = {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {}
      };

      const brightdataResult = await this.executeMCPCommand('npx', ['-y', '@brightdata/mcp'], brightdataRequest, {
        API_TOKEN: process.env.BRIGHTDATA_API_TOKEN || ''
      });

      if (brightdataResult.result?.tools) {
        tools.push(...brightdataResult.result.tools.map(tool => ({
          ...tool,
          server: 'brightdata-mcp'
        })));
      }
    } catch (error) {
      console.error('Failed to get BrightData tools:', error);
    }

    // Perplexity tools
    try {
      const perplexityRequest = {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/list",
        params: {}
      };

      const perplexityResult = await this.executeMCPCommand('npx', ['-y', 'mcp-perplexity-search'], perplexityRequest, {
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || ''
      });

      if (perplexityResult.result?.tools) {
        tools.push(...perplexityResult.result.tools.map(tool => ({
          ...tool,
          server: 'perplexity-mcp'
        })));
      }
    } catch (error) {
      console.error('Failed to get Perplexity tools:', error);
    }

    return tools;
  }

  /**
   * Health check for all MCP integrations
   */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    // Test graph
    try {
      const graphTest = await this.executeGraphQuery('MATCH (n) RETURN count(n) as count LIMIT 1');
      results['graph-mcp'] = !graphTest.isError;
    } catch (error) {
      results['graph-mcp'] = false;
    }

    // Test BrightData
    try {
      const brightdataTest = await this.executeBrightDataSearch('test query', 'google');
      results['brightdata-mcp'] = !brightdataTest.isError;
    } catch (error) {
      results['brightdata-mcp'] = false;
    }

    // Test Perplexity
    try {
      const perplexityTest = await this.executePerplexityChat([
        { role: 'user', content: 'Hello' }
      ], 'sonar-pro', { max_tokens: 50 });
      results['perplexity-mcp'] = !perplexityTest.isError;
    } catch (error) {
      results['perplexity-mcp'] = false;
    }

    return results;
  }
}

// Create singleton instance
export const directMCP = new DirectMCPIntegration();
