/**
 * MCP Server Registration Service for Claude Agent SDK
 * 
 * This service registers MCP servers with the Claude Agent SDK
 * using the configuration from mcp-config.json
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

interface MCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  type?: 'stdio';
}

interface MCPConfig {
  mcpServers: Record<string, MCPServer>;
}

export class MCPRegistrationService {
  private config: MCPConfig;
  private registeredServers: Map<string, any> = new Map();

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const configPath = path.join(process.cwd(), 'mcp-config.json');
      const configData = fs.readFileSync(configPath, 'utf8');
      this.config = JSON.parse(configData);
      console.log('✅ MCP configuration loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load MCP configuration:', error);
      this.config = { mcpServers: {} };
    }
  }

  /**
   * Register all MCP servers with Claude Agent SDK
   */
  async registerAllMCPServers() {
    console.log('🔧 Registering MCP servers...');
    
    const registrations = await Promise.allSettled([
      this.registerNeo4jServer(),
      this.registerBrightDataServer(),
      this.registerPerplexityServer()
    ]);

    registrations.forEach((result, index) => {
      const serverNames = ['neo4j-mcp', 'brightdata', 'perplexity-mcp'];
      if (result.status === 'fulfilled') {
        console.log(`✅ ${serverNames[index]} registered successfully`);
      } else {
        console.error(`❌ ${serverNames[index]} registration failed:`, result.reason);
      }
    });

    return this.registeredServers;
  }

  /**
   * Register Neo4j MCP Server
   */
  private async registerNeo4jServer() {
    const serverConfig = this.config.mcpServers['neo4j-mcp'];
    if (!serverConfig) throw new Error('Neo4j MCP server configuration not found');

    // Create mock registration for now - in real implementation this would 
    // interface with the actual MCP server process
    const neo4jRegistration = {
      name: 'neo4j-mcp',
      tools: [
        {
          name: 'mcp__neo4j-mcp__execute_query',
          description: 'Execute Cypher queries against Neo4j database',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Cypher query to execute' },
              params: { type: 'object', description: 'Query parameters' }
            },
            required: ['query']
          }
        },
        {
          name: 'mcp__neo4j-mcp__search_sports_entities',
          description: 'Search for sports entities in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              entityType: { type: 'string', description: 'Type of entity to search for' },
              limit: { type: 'number', description: 'Maximum number of results' }
            }
          }
        }
      ],
      config: serverConfig
    };

    this.registeredServers.set('neo4j-mcp', neo4jRegistration);
    return neo4jRegistration;
  }

  /**
   * Register BrightData MCP Server
   */
  private async registerBrightDataServer() {
    const serverConfig = this.config.mcpServers['brightData'];
    if (!serverConfig) throw new Error('BrightData MCP server configuration not found');

    const brightDataRegistration = {
      name: 'brightdata',
      tools: [
        {
          name: 'mcp__brightdata-mcp__search_engine',
          description: 'Perform web searches using BrightData search engine',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              engine: { type: 'string', enum: ['google', 'bing', 'yandex'], default: 'google' },
              limit: { type: 'number', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'mcp__brightdata-mcp__scrape_as_markdown',
          description: 'Scrape web content and convert to markdown',
          inputSchema: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'URL to scrape' }
            },
            required: ['url']
          }
        }
      ],
      config: serverConfig
    };

    this.registeredServers.set('brightdata', brightDataRegistration);
    return brightDataRegistration;
  }

  /**
   * Register Perplexity MCP Server
   */
  private async registerPerplexityServer() {
    const serverConfig = this.config.mcpServers['perplexity-mcp'];
    if (!serverConfig) throw new Error('Perplexity MCP server configuration not found');

    const perplexityRegistration = {
      name: 'perplexity-mcp',
      tools: [
        {
          name: 'mcp__perplexity-mcp__search_engine',
          description: 'Perform AI-powered searches with Perplexity',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              focus: { type: 'string', description: 'Search focus area' },
              limit: { type: 'number', default: 5 }
            },
            required: ['query']
          }
        },
        {
          name: 'mcp__perplexity-mcp__chat_completion',
          description: 'Get AI-powered answers and analysis',
          inputSchema: {
            type: 'object',
            properties: {
              messages: { 
                type: 'array',
                items: { type: 'object' },
                description: 'Conversation messages' 
              },
              model: { type: 'string', default: 'sonar' }
            }
          }
        }
      ],
      config: serverConfig
    };

    this.registeredServers.set('perplexity-mcp', perplexityRegistration);
    return perplexityRegistration;
  }

  /**
   * Get all available tool names for Claude Agent SDK
   */
  getAvailableToolNames(): string[] {
    const toolNames: string[] = [];
    
    for (const server of this.registeredServers.values()) {
      if (server.tools) {
        toolNames.push(...server.tools.map((tool: any) => tool.name));
      }
    }
    
    return toolNames;
  }

  /**
   * Get server configuration by name
   */
  getServerConfig(serverName: string) {
    return this.config.mcpServers[serverName];
  }

  /**
   * Get registered servers
   */
  getRegisteredServers() {
    return Object.fromEntries(this.registeredServers);
  }
}

// Singleton instance
export const mcpRegistrationService = new MCPRegistrationService();