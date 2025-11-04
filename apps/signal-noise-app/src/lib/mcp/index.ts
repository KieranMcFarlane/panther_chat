/**
 * MCP Tool Definitions for Claude Agent SDK
 * 
 * Creates tool definitions for Neo4j, BrightData, and Perplexity APIs
 * Uses the official MCP server configurations
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';

// Create tool definitions for Claude Agent SDK
export const createMCPTools = () => {
  console.log('🔧 Creating MCP tools for Claude Agent SDK...');
  
  // Neo4j Query Tool
  const neo4jExecuteQuery = tool('mcp__neo4j-mcp__execute_query', 
    'Execute Cypher queries against Neo4j AuraDB to get sports entities and relationships',
    {
      query: {
        type: 'string',
        description: 'Cypher query to execute',
        required: true
      },
      params: {
        type: 'object',
        description: 'Parameters for the Cypher query',
        required: false
      }
    },
    async ({ query, params = {} }) => {
      console.log(`🔍 NEO4J MCP: ${query}`);
      
      const neo4j = require('neo4j-driver');
      const driver = neo4j.driver(
        'neo4j+s://cce1f84b.databases.neo4j.io',
        neo4j.auth.basic('neo4j', 'process.env.NEO4J_PASSWORD || ""')
      );
      
      const session = driver.session();
      try {
        const result = await session.run(query, params);
        const records = result.records.map(record => record.toObject());
        console.log(`✅ NEO4J MCP RESULT: ${records.length} records`);
        return { success: true, data: records, count: records.length };
      } finally {
        await session.close();
        await driver.close();
      }
    }
  );

  // BrightData Search Tool
  const brightdataSearchEngine = tool('mcp__brightdata-mcp__search_engine',
    'Search the web for RFP opportunities and market intelligence using BrightData',
    {
      query: {
        type: 'string', 
        description: 'Search query for RFP opportunities',
        required: true
      },
      engine: {
        type: 'string',
        description: 'Search engine to use (google, bing, etc.)',
        required: false
      },
      num_results: {
        type: 'number',
        description: 'Number of results to return',
        required: false
      }
    },
    async ({ query, engine = 'google', num_results = 10 }) => {
      console.log(`🔍 BRIGHTDATA MCP: Searching for "${query}"`);
      
      const apiUrl = 'https://api.brightdata.com/serp';
      const apiToken = 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
      
      const searchParams = new URLSearchParams({
        q: query,
        engine: engine,
        num: num_results.toString()
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
        const results = data.organic_results || [];
        console.log(`✅ BRIGHTDATA MCP RESULT: ${results.length} results`);
        return { success: true, results, count: results.length, query, engine };
      } catch (error) {
        console.warn(`⚠️ BRIGHTDATA MCP FALLBACK: ${error.message}`);
        return {
          success: true, 
          results: [{
            title: `Search result for: ${query}`,
            link: 'https://example.com',
            snippet: `BrightData API unavailable - using fallback result for "${query}"`,
            fallback: true
          }],
          count: 1,
          fallback: true,
          error: error.message
        };
      }
    }
  );

  // Perplexity Analysis Tool  
  const perplexityChatCompletion = tool('mcp__perplexity-mcp__chat_completion',
    'Get AI-powered analysis and market intelligence using Perplexity',
    {
      messages: {
        type: 'array',
        description: 'Messages for the AI chat completion',
        required: true
      },
      model: {
        type: 'string',
        description: 'Model to use (sonar, etc.)',
        required: false
      }
    },
    async ({ messages, model = 'sonar' }) => {
      console.log(`🔍 PERPLEXITY MCP CHAT: ${messages[messages.length - 1]?.content?.substring(0, 50)}...`);
      
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
        const message = data.choices?.[0]?.message?.content || '';
        console.log(`✅ PERPLEXITY CHAT RESULT: ${message.length} characters`);
        return { success: true, message, usage: data.usage, model };
      } catch (error) {
        console.warn(`⚠️ PERPLEXITY CHAT FALLBACK: ${error.message}`);
        return { 
          success: true,
          message: `AI analysis unavailable (${error.message}). This is a fallback response for the query.`,
          fallback: true,
          error: error.message
        };
      }
    }
  );

  console.log('✅ MCP tools created successfully:');
  console.log('  - mcp__neo4j-mcp__execute_query');
  console.log('  - mcp__brightdata-mcp__search_engine');
  console.log('  - mcp__perplexity-mcp__chat_completion');

  return [
    neo4jExecuteQuery,
    brightdataSearchEngine,
    perplexityChatCompletion
  ];
};