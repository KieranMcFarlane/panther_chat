// Simple client-side implementation that doesn't use the Claude Agent SDK directly
// Instead, it communicates with your existing backend infrastructure

interface SimpleMessage {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

interface SimpleResponse {
  type: 'message' | 'status' | 'error' | 'tool_use' | 'tool_result';
  content?: string;
  role?: string;
  status?: string;
  message?: string;
  error?: string;
  tool?: string;
  args?: any;
  result?: any;
}

export class SimpleCopilotKitAgent {
  private sessionCache = new Map<string, string>();
  private isProcessing = false;

  async processMessage(
    messages: SimpleMessage[],
    context: any = {}
  ): Promise<AsyncGenerator<SimpleResponse, void, unknown>> {
    if (this.isProcessing) {
      throw new Error('Agent is already processing a message');
    }

    this.isProcessing = true;

    try {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== 'user') {
        throw new Error('No user message found');
      }

      const sessionId = this.sessionCache.get(context.userId || 'default');

      async function* streamGenerator(this: SimpleCopilotKitAgent) {
        try {
          yield { type: 'status', status: 'thinking', message: '🤔 Processing your request...' };
          
          // Use your existing backend API instead of Claude Agent SDK
          const response = await fetch('/api/claude-chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: lastMessage.content,
              sessionId: sessionId,
              context: {
                ...context,
                systemPrompt: "You are a Sports Intelligence AI assistant with access to Neo4j database containing 3,325+ sports entities. Help analyze sports clubs, identify business opportunities, and find decision makers."
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Backend request failed: ${response.statusText}`);
          }

          // Store new session ID if provided
          const newSessionId = response.headers.get('x-session-id');
          if (newSessionId && context.userId) {
            this.sessionCache.set(context.userId, newSessionId);
          }

          // Process streaming response if available
          if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.trim()) {
                    try {
                      const data = JSON.parse(line);
                      
                      if (data.type === 'message') {
                        yield { type: 'message', role: data.role, content: data.content };
                      } else if (data.type === 'status') {
                        yield { type: 'status', status: data.status, message: data.message };
                      } else if (data.type === 'tool_use') {
                        yield { type: 'tool_use', tool: data.tool, args: data.args };
                      } else if (data.type === 'tool_result') {
                        yield { type: 'tool_result', tool: data.tool, result: data.result };
                      } else if (data.type === 'error') {
                        yield { type: 'error', error: data.error };
                      }
                    } catch (parseError) {
                      // If line is not valid JSON, treat it as a plain text message
                      yield { type: 'message', role: 'assistant', content: line };
                    }
                  }
                }
              }
            } finally {
              reader.releaseLock();
            }
          } else {
            // Fallback for non-streaming responses
            const data = await response.json();
            if (data.response) {
              yield { type: 'message', role: 'assistant', content: data.response };
            }
            if (data.error) {
              yield { type: 'error', error: data.error };
            }
          }

          yield { type: 'status', status: 'completed', message: '✅ Task completed' };

        } catch (error) {
          yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error occurred' };
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
export const simpleCopilotKitAgent = new SimpleCopilotKitAgent();