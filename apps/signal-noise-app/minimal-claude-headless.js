#!/usr/bin/env node

/**
 * MINIMAL CLAUDE HEADLESS RFP SYSTEM
 * 
 * This is the bare minimum needed for Claude to actually execute MCP tools
 * No overcomplicated executor layers - just direct registration and execution
 */

import { query, registerMCP } from "@anthropic-ai/claude-sdk/headless";

// Direct MCP clients - no abstraction layer
const neo4jClient = {
  async execute_query({ query, params = {} }) {
    console.log(`🔍 NEO4J QUERY: ${query}`);
    
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver(
      'neo4j+s://cce1f84b.databases.neo4j.io',
      neo4j.auth.basic('neo4j', 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0')
    );
    
    const session = driver.session();
    try {
      const result = await session.run(query, params);
      const records = result.records.map(record => record.toObject());
      console.log(`✅ NEO4J RESULT: ${records.length} records returned`);
      return records;
    } finally {
      await session.close();
      await driver.close();
    }
  }
};

const brightdataClient = {
  async search_engine({ query, engine = 'google', limit = 10 }) {
    console.log(`🔍 BRIGHTDATA SEARCH: ${query}`);
    
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
      const results = data.organic_results || [];
      console.log(`✅ BRIGHTDATA RESULT: ${results.length} search results returned`);
      return results;
    } catch (error) {
      console.warn(`⚠️ BRIGHTDATA FALLBACK: ${error.message}`);
      return [{
        title: `API Error - Fallback for: ${query}`,
        link: 'https://api-error.com',
        snippet: `BrightData API unavailable (${error.message})`,
        fallback: true
      }];
    }
  }
};

const perplexityClient = {
  async chat_completion({ messages, model = 'sonar' }) {
    console.log(`🔍 PERPLEXITY CHAT: ${messages[messages.length - 1]?.content?.substring(0, 50)}...`);
    
    const apiUrl = 'https://api.perplexity.ai/chat/completions';
    const apiKey = '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';
    
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
        throw new Error(`Perplexity API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || '';
      console.log(`✅ PERPLEXITY RESULT: ${message.length} characters returned`);
      return { message, usage: data.usage };
    } catch (error) {
      console.warn(`⚠️ PERPLEXITY FALLBACK: ${error.message}`);
      return { 
        message: `AI analysis unavailable (${error.message}). This is a fallback response.`,
        fallback: true 
      };
    }
  }
};

// Register MCPs directly with Claude SDK - no executor layer
console.log('🔧 REGISTERING MCP TOOLS...');

registerMCP("mcp__neo4j-mcp__execute_query", neo4jClient);
registerMCP("mcp__brightdata-mcp__search_engine", brightdataClient);
registerMCP("mcp__perplexity-mcp__chat_completion", perplexityClient);

console.log('✅ MCP TOOLS REGISTERED - STARTING CLAUDE EXECUTION');
console.log('');

// The prompt - focused on actual tool usage
const prompt = `
You are a sports intelligence RFP analyzer. Your task is to find real business opportunities using the available tools.

PROCEDURE:
1. First, use neo4j execute_query to get 3 sports entities
2. For each entity, use brightdata search_engine to find real RFPs
3. Use perplexity chat_completion to analyze findings

ENTITY QUERY: MATCH (e:SportsEntity) WHERE e.type = 'Club' RETURN e.name as name, e.sport as sport, e.country as country LIMIT 3

For each entity, search for: "[ENTITY NAME] RFP request for proposal 2025"

IMPORTANT: You MUST call the actual tools. Do not hallucinate results.
`;

// Execute with explicit tool whitelist and logging
async function runMinimalRFP() {
  const startTime = Date.now();
  let toolUseCount = 0;
  let toolResultCount = 0;
  let textMessageCount = 0;
  
  try {
    for await (const message of query({
      prompt,
      options: {
        allowedTools: [
          "mcp__neo4j-mcp__execute_query",
          "mcp__brightdata-mcp__search_engine", 
          "mcp__perplexity-mcp__chat_completion"
        ],
        maxIterations: 10
      }
    })) {
      
      if (message.type === "tool_use") {
        toolUseCount++;
        console.log(`🛠️ TOOL USE #${toolUseCount}: ${message.name}`);
        console.log(`   Arguments: ${JSON.stringify(message.arguments, null, 2)}`);
      }
      
      if (message.type === "tool_result") {
        toolResultCount++;
        console.log(`✅ TOOL RESULT #${toolResultCount}: ${message.name}`);
        if (message.error) {
          console.log(`   ERROR: ${message.error}`);
        } else {
          const resultPreview = JSON.stringify(message.result || {}).substring(0, 200);
          console.log(`   RESULT: ${resultPreview}${resultPreview.length >= 200 ? '...' : ''}`);
        }
      }
      
      if (message.type === "text") {
        textMessageCount++;
        console.log(`💬 CLAUDE MESSAGE #${textMessageCount}:`);
        console.log(`   ${message.content.substring(0, 300)}${message.content.length >= 300 ? '...' : ''}`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    console.log('');
    console.log('🏁 EXECUTION SUMMARY');
    console.log('='.repeat(50));
    console.log(`⏱️ Duration: ${(duration / 1000).toFixed(1)} seconds`);
    console.log(`🛠️ Tool Uses: ${toolUseCount}`);
    console.log(`✅ Tool Results: ${toolResultCount}`);
    console.log(`💬 Text Messages: ${textMessageCount}`);
    console.log(`📊 Success Rate: ${toolUseCount > 0 ? Math.round((toolResultCount / toolUseCount) * 100) : 0}%`);
    
    if (toolUseCount === 0) {
      console.log('');
      console.log('❌ NO TOOLS CALLED - This is the phantom execution problem');
      console.log('   Claude did not attempt to use any registered tools');
      console.log('   Possible causes:');
      console.log('   - Tools not properly registered');
      console.log('   - Tools not in allowedTools list');
      console.log('   - Claude choosing not to use tools');
    } else {
      console.log('');
      console.log('✅ TOOLS ACTUALLY EXECUTED - Real MCP calls made');
    }
    
  } catch (error) {
    console.error('❌ EXECUTION ERROR:', error);
  }
}

// Run it
runMinimalRFP().catch(console.error);