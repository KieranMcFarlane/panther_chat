import { query } from '@anthropic-ai/claude-agent-sdk';

interface CopilotKitMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

interface CopilotKitAction {
  name: string;
  description: string;
  parameters: any;
}

export class CopilotKitClaudeAgent {
  private sessionCache = new Map<string, string>();
  private isProcessing = false;

  async processMessage(
    messages: CopilotKitMessage[],
    actions: CopilotKitAction[] = [],
    context: any = {}
  ): Promise<AsyncGenerator<any, void, unknown>> {
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message');
    }

    this.isProcessing = true;

    try {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('No user message found');
      }

      // Get existing session ID or create new one
      const sessionId = this.sessionCache.get(context.userId || 'default');
      const mcpConfig = await this.getMCPConfig();

      async function* streamGenerator() {
        try {
          yield { type: 'status', status: 'thinking', message: '🤔 Processing your request...' };
          
          for await (const response of query({
            prompt: lastMessage.content,
            options: {
              mcpServers: mcpConfig,
              maxTurns: 5,
              systemPrompt: {
                type: "preset",
                preset: "claude_code",
                append: this.getSystemPrompt(actions, context)
              },
              ...(sessionId && { resume: sessionId }),
              allowedTools: this.getAllowedTools(actions),
              settingSources: ['project'] // Load CLAUDE.md if available
            }
          })) {
            // Store session ID for continuity
            if (response.type === 'system' && response.subtype === 'init' && response.session_id) {
              if (context.userId) {
                this.sessionCache.set(context.userId, response.session_id);
              }
              yield { type: 'status', status: 'connected', message: '✅ Connected to sports intelligence database' };
            }
            
            // Handle assistant responses
            if (response.type === 'assistant') {
              const textContent = response.message.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('');
              
              if (textContent) {
                yield { type: 'message', role: 'assistant', content: textContent };
              }
            }
            
            // Handle tool usage
            if (response.type === 'tool_use') {
              yield { type: 'tool_use', tool: response.name, args: response.input };
            }
            
            if (response.type === 'tool_result') {
              yield { type: 'tool_result', tool: response.name, result: response.content };
            }
            
            // Handle completion
            if (response.type === 'result' && response.subtype === 'success') {
              yield { type: 'status', status: 'completed', message: '✅ Task completed' };
            }
            
            if (response.type === 'result' && response.subtype === 'error') {
              yield { type: 'error', error: response.error || 'Unknown error occurred' };
            }
          }
        } catch (error) {
          yield { type: 'error', error: error.message };
        } finally {
          this.isProcessing = false;
        }
      }

      return streamGenerator.call(this);
    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  private getSystemPrompt(actions: CopilotKitAction[], context: any): string {
    let basePrompt = "You are a Sports Intelligence AI assistant with access to Neo4j database containing 3,325+ sports entities. Help analyze sports clubs, identify business opportunities, and find decision makers.";
    
    // Add context-specific instructions
    if (context.projectType) {
      basePrompt += `\n\nProject Context: Working with ${context.projectType} projects.`;
    }
    
    if (context.userRole) {
      basePrompt += `\n\nUser Role: ${context.userRole}.`;
    }
    
    // Add available actions context
    if (actions.length > 0) {
      basePrompt += `\n\nAvailable Actions:\n${actions.map(action => 
        `- ${action.name}: ${action.description}`
      ).join('\n')}`;
    }
    
    return basePrompt;
  }

  private getAllowedTools(actions: CopilotKitAction[]): string[] {
    // Map CopilotKit actions to Claude SDK tools
    const toolMapping: Record<string, string[]> = {
      'search': ['Read', 'Grep', 'Glob'],
      'analyze': ['Read', 'Grep'],
      'code': ['Read', 'Edit', 'MultiEdit', 'Write', 'Grep', 'Glob', 'Bash'],
      'database': ['mcp__neo4j-mcp__execute_query'],
      'web': ['mcp__brightdata-mcp__search_engine', 'mcp__brightdata-mcp__scrape_as_markdown'],
      'memory': ['mcp__byterover-mcp__byterover-retrieve-knowledge', 'mcp__byterover-mcp__byterover-store-knowledge']
    };

    const allowedTools = new Set<string>();
    
    actions.forEach(action => {
      const category = this.getActionCategory(action.name);
      if (toolMapping[category]) {
        toolMapping[category].forEach(tool => allowedTools.add(tool));
      }
    });

    // Always include basic tools
    ['Read', 'Grep', 'Glob'].forEach(tool => allowedTools.add(tool));

    return Array.from(allowedTools);
  }

  private getActionCategory(actionName: string): string {
    if (actionName.includes('search') || actionName.includes('find')) return 'search';
    if (actionName.includes('analyze') || actionName.includes('review')) return 'analyze';
    if (actionName.includes('code') || actionName.includes('write') || actionName.includes('edit')) return 'code';
    if (actionName.includes('database') || actionName.includes('neo4j')) return 'database';
    if (actionName.includes('web') || actionName.includes('scrape')) return 'web';
    if (actionName.includes('memory') || actionName.includes('knowledge')) return 'memory';
    return 'search';
  }

  private async getMCPConfig() {
    try {
      // Fetch MCP config from API endpoint
      const response = await fetch('/api/mcp-config');
      if (!response.ok) {
        throw new Error('Failed to fetch MCP config');
      }
      const data = await response.json();
      return data.mcpServers || {};
    } catch (error) {
      console.warn('Failed to load MCP config:', error);
      return {};
    }
  }

  clearSession(userId?: string): void {
    if (userId) {
      this.sessionCache.delete(userId);
    } else {
      this.sessionCache.clear();
    }
  }

  getSessionId(userId?: string): string | undefined {
    return userId ? this.sessionCache.get(userId) : undefined;
  }
}

// Export singleton instance
export const copilotKitAgent = new CopilotKitClaudeAgent();