#!/usr/bin/env node

/**
 * Neo4j MCP HTTP Bridge
 * Provides HTTP endpoints for the @alanse/mcp-neo4j-server stdio MCP
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.NEO4J_MCP_PORT || 3004;

// Neo4j connection details from your MCP config
const NEO4J_CONFIG = {
  NEO4J_URI: "neo4j+s://cce1f84b.databases.neo4j.io",
  NEO4J_USERNAME: "neo4j",
  NEO4J_PASSWORD: "llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0",
  NEO4J_DATABASE: "neo4j",
  AURA_INSTANCEID: "cce1f84b",
  AURA_INSTANCENAME: "Instance01"
};

console.log(`🚀 Neo4j MCP HTTP Bridge starting on port ${PORT}`);
console.log(`🔗 Neo4j URI: ${NEO4J_CONFIG.NEO4J_URI}`);
console.log(`👤 Neo4j User: ${NEO4J_CONFIG.NEO4J_USERNAME}`);
console.log(`🗄️  Neo4j Database: ${NEO4J_CONFIG.NEO4J_DATABASE}`);

// MCP subprocess
let mcpProcess = null;
let requestId = 0;

// Start the Neo4j MCP server
function startNeo4jMCP() {
  console.log('📦 Starting @alanse/mcp-neo4j-server...');
  
  mcpProcess = spawn('npx', ['-y', '@alanse/mcp-neo4j-server'], {
    env: {
      ...process.env,
      ...NEO4J_CONFIG
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpProcess.stdout.on('data', (data) => {
    console.log(`📦 Neo4j MCP: ${data.toString().trim()}`);
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log(`⚠️ Neo4j MCP Error: ${data.toString().trim()}`);
  });

  mcpProcess.on('close', (code) => {
    console.log(`❌ Neo4j MCP Server exited with code ${code}`);
    // Restart after a delay
    setTimeout(startNeo4jMCP, 5000);
  });

  mcpProcess.on('error', (error) => {
    console.error(`❌ Neo4j MCP Server error: ${error.message}`);
  });
}

// Helper function to send MCP requests
async function sendMCPRequest(method, params = {}) {
  return new Promise((resolve, reject) => {
    if (!mcpProcess || mcpProcess.killed) {
      reject(new Error('MCP process not running'));
      return;
    }

    const id = ++requestId;
    const request = {
      jsonrpc: "2.0",
      id: id,
      method: method,
      params: params
    };

    console.log(`🔧 Sending MCP request: ${method}`, params);

    let responseData = '';
    let timeout;

    const onData = (data) => {
      responseData += data.toString();
      
      // Try to parse complete JSON responses
      const lines = responseData.split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line.trim());
            if (response.id === id) {
              clearTimeout(timeout);
              mcpProcess.stdout.removeListener('data', onData);
              
              if (response.error) {
                console.log(`❌ MCP Error Response:`, response.error);
                reject(new Error(response.error.message || 'MCP request failed'));
              } else {
                console.log(`✅ MCP Success Response:`, response.result);
                resolve(response.result);
              }
              return;
            }
          } catch (e) {
            // Continue trying to parse
          }
        }
      }
    };

    mcpProcess.stdout.on('data', onData);

    // Set timeout
    timeout = setTimeout(() => {
      mcpProcess.stdout.removeListener('data', onData);
      reject(new Error('MCP request timeout'));
    }, 30000);

    // Send the request
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'neo4j-mcp-http-bridge',
    neo4j_uri: NEO4J_CONFIG.NEO4J_URI,
    neo4j_database: NEO4J_CONFIG.NEO4J_DATABASE,
    mcp_process_running: mcpProcess && !mcpProcess.killed,
    available_endpoints: [
      'POST /mcp - Generic MCP method calls',
      'POST /query - Execute Cypher queries',
      'POST /create-entity - Create entities',
      'POST /find-related - Find related entities'
    ]
  });
});

// Generic MCP endpoint
app.post('/mcp', async (req, res) => {
  try {
    const { method, params = {} } = req.body;
    
    if (!method) {
      return res.status(400).json({ error: 'Method is required' });
    }

    const result = await sendMCPRequest(method, params);
    res.json({ success: true, result });
  } catch (error) {
    console.error('MCP request failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'MCP request failed' 
    });
  }
});

// Specific endpoint for Cypher queries
app.post('/query', async (req, res) => {
  try {
    const { query, parameters = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Cypher query is required' });
    }

    const result = await sendMCPRequest('neo4j/query', {
      cypher: query,
      parameters: parameters
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Neo4j query failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Query failed' 
    });
  }
});

// Entity creation endpoint
app.post('/create-entity', async (req, res) => {
  try {
    const { entityType, properties, relationships = [] } = req.body;
    
    if (!entityType || !properties) {
      return res.status(400).json({ error: 'entityType and properties are required' });
    }

    const result = await sendMCPRequest('neo4j/create-entity', {
      entity_type: entityType,
      properties: properties,
      relationships: relationships
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Entity creation failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Entity creation failed' 
    });
  }
});

// Find related entities endpoint
app.post('/find-related', async (req, res) => {
  try {
    const { entityName, relationshipTypes = [], maxDepth = 2 } = req.body;
    
    if (!entityName) {
      return res.status(400).json({ error: 'entityName is required' });
    }

    const result = await sendMCPRequest('neo4j/find-related', {
      entity_name: entityName,
      relationship_types: relationshipTypes,
      max_depth: maxDepth
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Finding related entities failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Finding related entities failed' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Express error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`✅ Neo4j MCP HTTP Bridge listening on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /mcp - Generic MCP method calls`);
  console.log(`   POST /query - Execute Cypher queries`);
  console.log(`   POST /create-entity - Create entities`);
  console.log(`   POST /find-related - Find related entities`);
  
  // Start the MCP subprocess
  startNeo4jMCP();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down Neo4j MCP HTTP Bridge...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down Neo4j MCP HTTP Bridge...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});

