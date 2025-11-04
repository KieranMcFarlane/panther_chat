import { query } from '@anthropic-ai/claude-agent-sdk';

export class ClaudeAgentManager {
  private static sessionCache = new Map<string, string>();

  static async processMessage(
    userId: string, 
    message: string,
    options: any = {}
  ): Promise<AsyncGenerator<any, void, unknown>> {
    const existingSessionId = this.sessionCache.get(userId);
    const mcpConfig = await this.getMCPConfig();

    async function* streamGenerator() {
      try {
        yield { type: 'thinking', content: '🤔 Processing your request...' };
        
        for await (const response of query({
          prompt: message,
          options: {
            mcpServers: mcpConfig,
            maxTurns: 5,
            systemPrompt: {
              type: "preset",
              preset: "claude_code",
              append: "You are a Sports Intelligence AI assistant with access to Neo4j database containing 3,325+ sports entities. Help analyze sports clubs, identify business opportunities, and find decision makers."
            },
            ...(existingSessionId && { resume: existingSessionId }),
            ...options
          }
        })) {
          // Store session ID for continuity
          if (response.type === 'system' && response.subtype === 'init' && response.session_id) {
            this.sessionCache.set(userId, response.session_id);
            yield { type: 'thinking', content: '✅ Connected to sports intelligence database' };
          }
          
          // Handle assistant responses
          if (response.type === 'assistant') {
            const textContent = response.message.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('');
            
            if (textContent) {
              yield { type: 'text', text: textContent };
            }
          }
          
          // Handle tool usage
          if (response.type === 'tool_use') {
            yield { type: 'thinking', content: `🔧 Using: ${response.name}` };
            yield { type: 'tool_use', tool: response.name, args: response.input };
          }
          
          if (response.type === 'tool_result') {
            yield { type: 'thinking', content: '📊 Analyzing results...' };
            yield { type: 'tool_result', tool: response.name, result: response.content };
          }
          
          // Handle completion
          if (response.type === 'result' && response.subtype === 'success') {
            yield { type: 'done' };
          }
          
          if (response.type === 'result' && response.subtype === 'error') {
            yield { type: 'error', error: response.error || 'Unknown error occurred' };
          }
        }
      } catch (error) {
        yield { type: 'error', error: error.message };
      }
    }

    return streamGenerator.call({ sessionCache: this.sessionCache });
  }

  private static async getMCPConfig() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
      const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));
      return mcpConfig.mcpServers;
    } catch (error) {
      console.warn('Failed to load MCP config, using empty config:', error);
      return {};
    }
  }

  static async clearSession(userId: string): Promise<void> {
    this.sessionCache.delete(userId);
  }

  static getSessionId(userId: string): string | undefined {
    return this.sessionCache.get(userId);
  }
}