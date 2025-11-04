import { query } from '@anthropic-ai/claude-agent-sdk';
import fs from 'fs/promises';
import path from 'path';

// Simple clean implementation following the docs exactly
export async function* processClaudeMessage(
  userId: string,
  message: string,
  sessionId?: string,
  options: any = {}
) {
  try {
    // Load MCP config
    const mcpConfig = await getMCPConfig();
    
    // Use the SDK query function directly
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
        ...(sessionId && { resume: sessionId }),
        ...options
      }
    })) {
      // Return the response directly - let the calling code handle formatting
      yield response;
    }
  } catch (error) {
    yield { type: 'error', error: error.message };
  }
}

// Helper function to load MCP config
async function getMCPConfig() {
  try {
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
    const mcpConfig = JSON.parse(await fs.readFile(mcpConfigPath, 'utf-8'));
    return mcpConfig.mcpServers;
  } catch (error) {
    console.warn('Failed to load MCP config:', error);
    return {};
  }
}

// Even simpler - just export the query function with preset options
export function createSportsIntelligenceQuery(customOptions: any = {}) {
  return async function* (message: string, sessionId?: string) {
    const mcpConfig = await getMCPConfig();
    
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
        ...(sessionId && { resume: sessionId }),
        ...customOptions
      }
    })) {
      yield response;
    }
  };
}