/**
 * MCP Tool Executor Service
 * 
 * Handles execution of MCP tools registered with the Claude Agent SDK
 */

import { mcpRegistrationService } from './mcp-registration';

export class MCPToolExecutor {
  private static instance: MCPToolExecutor;

  static getInstance(): MCPToolExecutor {
    if (!MCPToolExecutor.instance) {
      MCPToolExecutor.instance = new MCPToolExecutor();
    }
    return MCPToolExecutor.instance;
  }

  /**
   * Execute an MCP tool call
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    console.log(`🔧 Executing MCP tool: ${toolName}`, { args });

    try {
      switch (toolName) {
        case 'mcp__neo4j-mcp__execute_query':
          return await this.executeNeo4jQuery(args);
        
        case 'mcp__neo4j-mcp__search_sports_entities':
          return await this.searchSportsEntities(args);
        
        case 'mcp__brightdata-mcp__search_engine':
          return await this.executeBrightDataSearch(args);
        
        case 'mcp__brightdata-mcp__scrape_as_markdown':
          return await this.scrapeAsMarkdown(args);
        
        case 'mcp__perplexity-mcp__search_engine':
          return await this.executePerplexitySearch(args);
        
        case 'mcp__perplexity-mcp__chat_completion':
          return await this.executePerplexityChat(args);
        
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      console.error(`❌ Tool execution failed: ${toolName}`, error);
      return {
        error: error.message,
        toolName,
        args
      };
    }
  }

  /**
   * Execute Neo4j Cypher query
   */
  private async executeNeo4jQuery(args: { query: string; params?: any }) {
    const { query: cypherQuery, params } = args;
    
    // Import Neo4j driver dynamically
    const neo4j = require('neo4j-driver');
    
    const driver = neo4j.driver(
      'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
    );
    
    const session = driver.session();
    
    try {
      const result = await session.run(cypherQuery, params || {});
      const records = result.records.map(record => record.toObject());
      
      return {
        success: true,
        data: records,
        count: records.length,
        query: cypherQuery
      };
    } finally {
      await session.close();
      await driver.close();
    }
  }

  /**
   * Search for sports entities
   */
  private async searchSportsEntities(args: { entityType?: string; limit?: number }) {
    const { entityType = 'Club', limit = 50 } = args;
    
    const query = `
      MATCH (e:SportsEntity)
      WHERE e.type = $entityType OR e.entityType = $entityType
      RETURN e.name as name, e.type as type, e.sport as sport, e.country as country
      LIMIT $limit
    `;
    
    return await this.executeNeo4jQuery({ query, params: { entityType, limit } });
  }

  /**
   * Execute BrightData search
   */
  private async executeBrightDataSearch(args: { query: string; engine?: string; limit?: number }) {
    const { query, engine = 'google', limit = 10 } = args;
    
    // Use BrightData API directly
    const apiUrl = 'https://api.brightdata.com/serp';
    const apiToken = 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
    
    const searchParams = new URLSearchParams({
      q: query,
      engine: engine,
      num: limit.toString()
    });
    
    try {
      const response = await fetch(`${apiUrl}?${searchParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`BrightData API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        query,
        engine,
        results: data.organic_results || [],
        totalResults: data.search_information?.total_results || 0,
        searchTime: data.search_information?.time_taken_displayed || 0
      };
    } catch (error) {
      // Fallback to mock data for development
      console.warn('BrightData API unavailable, using fallback:', error.message);
      
      return {
        success: true,
        query,
        engine,
        results: [
          {
            title: `Mock result for: ${query}`,
            link: 'https://example.com',
            snippet: 'This is a fallback result when BrightData API is unavailable'
          }
        ],
        totalResults: 1,
        searchTime: 0.5,
        fallback: true
      };
    }
  }

  /**
   * Scrape URL as markdown
   */
  private async scrapeAsMarkdown(args: { url: string }) {
    const { url } = args;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Simple HTML to markdown conversion (basic)
      let markdown = html
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
        .replace(/<[^>]+>/g, '')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      return {
        success: true,
        url,
        content: markdown.substring(0, 10000), // Limit to 10k chars
        contentLength: markdown.length
      };
    } catch (error) {
      return {
        success: false,
        url,
        error: error.message,
        content: `Failed to scrape ${url}: ${error.message}`
      };
    }
  }

  /**
   * Execute Perplexity search
   */
  private async executePerplexitySearch(args: { query: string; focus?: string; limit?: number }) {
    const { query, focus, limit = 5 } = args;
    
    const apiUrl = 'https://api.perplexity.ai/search';
    const apiKey = process.env.PERPLEXITY_API_KEY || '';
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'sonar',
          query,
          focus: focus || 'research',
          max_results: limit,
          search_mode: 'high',
          timeout: 30
        })
      });
      
      if (!response.ok) {
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        query,
        focus,
        results: data.results || [],
        answer: data.answer || '',
        sources: data.sources || [],
        model: data.model || 'sonar'
      };
    } catch (error) {
      // Fallback response
      console.warn('Perplexity API unavailable, using fallback:', error.message);
      
      return {
        success: true,
        query,
        focus,
        results: [{
          title: `Fallback analysis for: ${query}`,
          snippet: 'AI-powered search analysis unavailable - using fallback response',
          score: 0.7
        }],
        answer: `Based on the query "${query}", here is a preliminary analysis while the AI service is being restored.`,
        fallback: true
      };
    }
  }

  /**
   * Execute Perplexity chat completion
   */
  private async executePerplexityChat(args: { messages: any[]; model?: string }) {
    const { messages, model = 'sonar' } = args;
    
    const apiUrl = 'https://api.perplexity.ai/chat/completions';
    const apiKey = process.env.PERPLEXITY_API_KEY || '';
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 1024,
          temperature: 0.7
        })
      });
      
      if (!response.ok) {
        throw new Error(`Perplexity Chat API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        success: true,
        model,
        message: data.choices?.[0]?.message?.content || '',
        usage: data.usage || {},
        finishReason: data.choices?.[0]?.finish_reason || 'unknown'
      };
    } catch (error) {
      return {
        success: false,
        model,
        error: error.message,
        message: `AI analysis unavailable: ${error.message}`
      };
    }
  }
}

export const mcpToolExecutor = MCPToolExecutor.getInstance();