#!/usr/bin/env node

/**
 * Seed Demo Logs for Claude Agent Terminal
 * 
 * This script makes a simple API call to seed some demo logs
 * so that the agent-logs page has historical content to display.
 */

const http = require('http');

const demoLogs = [
  {
    level: 'info',
    category: 'claude-agent',
    source: 'ClaudeAgentSDK',
    message: '🤖 Claude Agent service initialized successfully',
    data: { version: '1.0.0', capabilities: ['enrichment', 'analysis', 'reasoning'] },
    tags: ['startup', 'claude-agent']
  },
  {
    level: 'info',
    category: 'system',
    source: 'Neo4jMCP',
    message: '📚 Knowledge graph connection established',
    data: { nodes: 593, relationships: 1247, database: 'sports-intelligence' },
    tags: ['startup', 'neo4j', 'knowledge-graph']
  },
  {
    level: 'info',
    category: 'claude-agent',
    source: 'BrightDataMCP',
    message: '🌐 Web scraping capabilities ready',
    data: { zones: 3, concurrent_requests: 10, proxy_status: 'active' },
    tags: ['startup', 'brightdata', 'scraping']
  },
  {
    level: 'info',
    category: 'claude-agent',
    source: 'EntityDossierEnrichmentService',
    message: '⚡ Entity enrichment service online',
    data: { cache_size: 150, processing_queue: 0, success_rate: 0.95 },
    tags: ['startup', 'enrichment', 'entity-dossier']
  },
  {
    level: 'info',
    category: 'claude-agent',
    source: 'ClaudeAgentSDK',
    message: '🎯 RFP Intelligence Complete: 3 Real Opportunities',
    data: { 
      opportunities_found: 3,
      high_value_targets: 2,
      average_fit_score: 85,
      organizations: ['UNESCO', 'Maryland Stadium Authority', 'Kalamazoo County']
    },
    entity_name: 'RFP Market Scan',
    tags: ['rfp-analysis', 'intelligence', 'opportunities']
  },
  {
    level: 'info',
    category: 'system',
    source: 'LiveLogService',
    message: '📝 Log service operational - ready for streaming',
    data: { buffer_size: 1000, flush_interval: '5s', storage: 'supabase + memory' },
    tags: ['system', 'logs', 'operational']
  }
];

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
  });
}

async function seedDemoLogs() {
  console.log('🌱 Seeding demo logs for Claude Agent terminal...');
  
  try {
    let addedCount = 0;
    
    // Add logs via API call to logs service
    for (const logData of demoLogs) {
      const options = {
        hostname: 'localhost',
        port: 3005,
        path: '/api/logs/add',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      try {
        const response = await makeRequest(options, logData);
        if (response.statusCode === 200) {
          addedCount++;
        } else {
          console.log(`⚠️ Failed to add log: ${response.statusCode}`);
        }
      } catch (error) {
        // API might not be available, that's okay for demo purposes
        console.log(`ℹ️ API not available for log seeding (${error.message})`);
      }
      
      // Small delay between logs
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Processed ${addedCount} demo logs`);
    console.log('');
    console.log('🚀 Agent logs page is ready!');
    console.log('📍 Visit /agent-logs to see the terminal interface');
    
  } catch (error) {
    console.error('❌ Failed to seed demo logs:', error.message);
    process.exit(1);
  }
}

// Run the seeding
seedDemoLogs().then(() => {
  console.log('✨ Demo log seeding completed');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error during demo log seeding:', error);
  process.exit(1);
});