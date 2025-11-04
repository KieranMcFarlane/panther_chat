#!/usr/bin/env node

/**
 * Generate test logs for Claude Agent system
 * This creates sample log entries to test the Live Agent Logs page
 */

const generateTestLogs = async () => {
  console.log('🎭 Generating test Claude Agent logs...\n');

  try {
    // Generate a series of test logs that simulate Claude Agent activity
    const testLogs = [
      {
        level: 'info',
        category: 'claude-agent',
        source: 'IntelligentEntityEnrichmentService',
        message: '🤖 Claude Agent initialized with MCP tools',
        tags: ['claude-agent', 'initialization']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'IntelligentEntityEnrichmentService',
        entity_name: 'Manchester United',
        message: '🧠 Analyzing entity: Manchester United (Football Club)',
        tags: ['claude-agent', 'entity-analysis']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔧 Tool selection: Neo4j MCP - querying entity relationships',
        tags: ['claude-agent', 'tool-execution', 'neo4j-mcp']
      },
      {
        level: 'info',
        category: 'enrichment',
        source: 'Neo4jMCP',
        entity_name: 'Manchester United',
        message: '📊 Found 47 relationships, 8 direct partnerships',
        tags: ['neo4j', 'relationship-analysis']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🎯 Strategy assigned: INTENSIVE (high-value entity)',
        tags: ['claude-agent', 'strategy-assignment']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔧 Tool selection: BrightData MCP - LinkedIn scraping',
        tags: ['claude-agent', 'tool-execution', 'brightdata-mcp']
      },
      {
        level: 'info',
        category: 'enrichment',
        source: 'BrightDataMCP',
        entity_name: 'Manchester United',
        message: '🔍 LinkedIn: Found 2,847 employee profiles, 15 recent updates',
        tags: ['brightdata', 'linkedin', 'scraping']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔧 Tool selection: Perplexity MCP - market intelligence',
        tags: ['claude-agent', 'tool-execution', 'perplexity-mcp']
      },
      {
        level: 'info',
        category: 'enrichment',
        source: 'PerplexityMCP',
        entity_name: 'Manchester United',
        message: '📈 Market analysis: $3.2B valuation, growing digital presence',
        tags: ['perplexity', 'market-intelligence', 'analysis']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔧 Tool selection: Supabase MCP - storing enrichment results',
        tags: ['claude-agent', 'tool-execution', 'supabase-mcp']
      },
      {
        level: 'info',
        category: 'enrichment',
        source: 'IntelligentEntityEnrichmentService',
        entity_name: 'Manchester United',
        message: '✅ Entity enrichment completed successfully (3.2s)',
        tags: ['enrichment', 'success']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'IntelligentEntityEnrichmentService',
        entity_name: 'Real Madrid',
        message: '🧠 Analyzing entity: Real Madrid (Football Club)',
        tags: ['claude-agent', 'entity-analysis']
      },
      {
        level: 'warn',
        category: 'enrichment',
        source: 'BrightDataMCP',
        entity_name: 'Real Madrid',
        message: '⚠️ LinkedIn rate limit approaching, implementing backoff',
        tags: ['brightdata', 'rate-limit', 'warning']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔄 Adaptive throttling: 2s delay between requests',
        tags: ['claude-agent', 'rate-limiting', 'optimization']
      },
      {
        level: 'error',
        category: 'enrichment',
        source: 'PerplexityMCP',
        entity_name: 'Real Madrid',
        message: '❌ Perplexity API timeout, using cached analysis',
        tags: ['perplexity', 'api-error', 'fallback']
      },
      {
        level: 'info',
        category: 'claude-agent',
        source: 'ClaudeAgentSDK',
        message: '🔧 Error recovery: Using alternative data sources',
        tags: ['claude-agent', 'error-recovery', 'resilience']
      }
    ];

    // Send logs to the LiveLogService via API
    for (let i = 0; i < testLogs.length; i++) {
      const log = testLogs[i];
      
      try {
        const response = await fetch('http://localhost:3005/api/test/log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });

        if (response.ok) {
          console.log(`✅ Log ${i + 1}/${testLogs.length} sent: ${log.message.substring(0, 50)}...`);
        } else {
          console.log(`⚠️ Log ${i + 1} failed: ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Log ${i + 1} error: ${error.message}`);
      }

      // Add small delay between logs
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log('\n🎉 Test logs generated successfully!');
    console.log('\n📝 What to do next:');
    console.log('   1. Open http://localhost:3005/agent-logs');
    console.log('   2. You should see the test logs appearing in the terminal');
    console.log('   3. Try different filters to see Claude Agent vs enrichment logs');
    console.log('   4. Click "🚀 Trigger Claude Agent" to see real-time activity');

  } catch (error) {
    console.error('❌ Failed to generate test logs:', error.message);
  }
};

// Run the test
generateTestLogs();