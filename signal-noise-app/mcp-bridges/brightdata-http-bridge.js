#!/usr/bin/env node

/**
 * BrightData MCP HTTP Bridge
 * Provides HTTP endpoints for the @brightdata/mcp stdio MCP
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.BRIGHTDATA_MCP_PORT || 8014;

// BrightData configuration from your MCP config
const BRIGHTDATA_CONFIG = {
  API_TOKEN: "bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4",
  PRO_MODE: "true"
};

console.log(`🚀 BrightData MCP HTTP Bridge starting on port ${PORT}`);
console.log(`🔑 API Token configured: ${BRIGHTDATA_CONFIG.API_TOKEN ? 'Yes' : 'No'}`);
console.log(`🌟 Pro Mode: ${BRIGHTDATA_CONFIG.PRO_MODE}`);

// MCP subprocess
let mcpProcess = null;
let requestId = 0;

// Start the BrightData MCP server
function startBrightDataMCP() {
  console.log('📦 Starting @brightdata/mcp server...');
  
  mcpProcess = spawn('npx', ['-y', '@brightdata/mcp'], {
    env: {
      ...process.env,
      ...BRIGHTDATA_CONFIG
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  mcpProcess.stdout.on('data', (data) => {
    console.log(`📦 BrightData MCP: ${data.toString().trim()}`);
  });

  mcpProcess.stderr.on('data', (data) => {
    console.log(`⚠️ BrightData MCP Error: ${data.toString().trim()}`);
  });

  mcpProcess.on('close', (code) => {
    console.log(`❌ BrightData MCP Server exited with code ${code}`);
    // Restart after a delay
    setTimeout(startBrightDataMCP, 5000);
  });

  mcpProcess.on('error', (error) => {
    console.error(`❌ BrightData MCP Server error: ${error.message}`);
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
    }, 60000); // Longer timeout for web scraping

    // Send the request
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'brightdata-mcp-http-bridge',
    api_token_configured: !!BRIGHTDATA_CONFIG.API_TOKEN,
    pro_mode: BRIGHTDATA_CONFIG.PRO_MODE === 'true',
    mcp_process_running: mcpProcess && !mcpProcess.killed,
    available_endpoints: [
      'POST /mcp - Generic MCP method calls',
      'POST /scrape - Scrape websites as markdown',
      'POST /search-linkedin - Search LinkedIn profiles',
      'POST /search-serp - Search engine results'
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

// Website scraping endpoint
app.post('/scrape', async (req, res) => {
  try {
    const { url, format = 'markdown' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await sendMCPRequest('scrape_as_markdown', {
      url: url
    });
    
    res.json({ 
      success: true, 
      data: {
        url: url,
        content: result,
        format: format
      }
    });
  } catch (error) {
    console.error('Website scraping failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Scraping failed' 
    });
  }
});

// LinkedIn profile search endpoint
app.post('/search-linkedin', async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await sendMCPRequest('search_engine', {
      query: `site:linkedin.com/in ${query}`,
      engine: 'google',
      limit: limit
    });
    
    // Process results to extract LinkedIn profile data
    const profiles = result?.results?.map((item, index) => ({
      id: `linkedin_${index}`,
      name: extractNameFromTitle(item.title),
      title: extractTitleFromSnippet(item.snippet),
      company: extractCompanyFromSnippet(item.snippet),
      profileUrl: item.url,
      snippet: item.snippet,
      connections: extractConnectionsFromSnippet(item.snippet)
    })) || [];

    res.json({ 
      success: true, 
      profiles: profiles,
      totalResults: profiles.length,
      query: query
    });
  } catch (error) {
    console.error('LinkedIn search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'LinkedIn search failed' 
    });
  }
});

// Search engine results endpoint
app.post('/search-serp', async (req, res) => {
  try {
    const { query, engine = 'google', limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await sendMCPRequest('search_engine', {
      query: query,
      engine: engine,
      limit: limit
    });
    
    res.json({ 
      success: true, 
      results: result?.results || [],
      totalResults: result?.results?.length || 0,
      query: query,
      engine: engine
    });
  } catch (error) {
    console.error('SERP search failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Search failed' 
    });
  }
});

// Helper functions to extract data from search results
function extractNameFromTitle(title) {
  // Try to extract name from LinkedIn title
  const match = title.match(/^([^-|]+)/);
  return match ? match[1].trim() : title;
}

function extractTitleFromSnippet(snippet) {
  // Try to extract job title from snippet
  const titleMatch = snippet.match(/(?:at|@)\s+([^·•]+)/);
  return titleMatch ? titleMatch[1].trim() : 'Unknown';
}

function extractCompanyFromSnippet(snippet) {
  // Try to extract company from snippet
  const companyMatch = snippet.match(/(?:at|@)\s+([^·•]+)(?:·|•)/);
  return companyMatch ? companyMatch[1].trim() : 'Unknown';
}

function extractConnectionsFromSnippet(snippet) {
  // Try to extract connection count from snippet
  const connectionMatch = snippet.match(/(\d+[+]?)\s+connections?/i);
  return connectionMatch ? parseInt(connectionMatch[1].replace('+', '')) : null;
}

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
  console.log(`✅ BrightData MCP HTTP Bridge listening on port ${PORT}`);
  console.log(`🌐 Health check: http://localhost:${PORT}/health`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /mcp - Generic MCP method calls`);
  console.log(`   POST /scrape - Scrape websites as markdown`);
  console.log(`   POST /search-linkedin - Search LinkedIn profiles`);
  console.log(`   POST /search-serp - Search engine results`);
  
  // Start the MCP subprocess
  startBrightDataMCP();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down BrightData MCP HTTP Bridge...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down BrightData MCP HTTP Bridge...');
  if (mcpProcess) {
    mcpProcess.kill();
  }
  process.exit(0);
});

