#!/usr/bin/env node
/**
 * BrightData MCP Server Launcher
 * 
 * This script starts the BrightData MCP server for web scraping and search capabilities.
 * It can be used standalone or as part of the Claude Agent SDK integration.
 * 
 * Usage:
 *   node scripts/brightdata-mcp-server.js
 *   
 * Environment:
 *   BRIGHTDATA_TOKEN - Your BrightData API token
 *   BRIGHTDATA_ZONE - BrightData zone name (optional)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const SCRIPT_DIR = __dirname;
const PROJECT_DIR = path.dirname(SCRIPT_DIR);
const LOG_DIR = path.join(PROJECT_DIR, 'logs');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Log file with timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const logFile = path.join(LOG_DIR, `brightdata-mcp-${timestamp}.log`);

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Also write to log file
    fs.appendFileSync(logFile, logMessage + '\n');
}

function startMcpServer() {
    log('🚀 Starting BrightData MCP Server...');
    
    // Check for required environment
    const brightDataToken = process.env.BRIGHTDATA_TOKEN;
    if (!brightDataToken) {
        log('❌ BRIGHTDATA_TOKEN environment variable required');
        log('💡 Set it with: export BRIGHTDATA_TOKEN=your_token_here');
        process.exit(1);
    }
    
    // Check if @brightdata/mcp-server is installed
    try {
        require.resolve('@brightdata/mcp-server');
        log('✅ @brightdata/mcp-server found');
    } catch (e) {
        log('❌ @brightdata/mcp-server not installed');
        log('💡 Install it with: npm install -g @brightdata/mcp-server');
        process.exit(1);
    }
    
    // Start the MCP server
    const serverProcess = spawn('npx', ['@brightdata/mcp-server'], {
        stdio: ['inherit', 'pipe', 'pipe'],
        env: {
            ...process.env,
            BRIGHTDATA_TOKEN: brightDataToken,
            BRIGHTDATA_ZONE: process.env.BRIGHTDATA_ZONE || 'linkedin_posts_monitor',
            PORT: '8014',
            HOST: 'localhost'
        },
        cwd: PROJECT_DIR
    });
    
    serverProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            log(`📤 ${output}`);
        }
    });
    
    serverProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
            log(`❌ ${output}`);
        }
    });
    
    serverProcess.on('error', (error) => {
        log(`💥 Failed to start MCP server: ${error.message}`);
        process.exit(1);
    });
    
    serverProcess.on('close', (code) => {
        if (code !== 0) {
            log(`💥 MCP server exited with code ${code}`);
            process.exit(code);
        } else {
            log('✅ MCP server stopped gracefully');
        }
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        log('🛑 Received SIGINT, shutting down MCP server...');
        serverProcess.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        log('🛑 Received SIGTERM, shutting down MCP server...');
        serverProcess.kill('SIGTERM');
    });
    
    // Wait a moment and check if server is responsive
    setTimeout(() => {
        log('🔍 Checking if MCP server is responsive...');
        
        const http = require('http');
        const req = http.request({
            hostname: 'localhost',
            port: 8014,
            path: '/',
            method: 'GET',
            timeout: 5000
        }, (res) => {
            if (res.statusCode === 200) {
                log('✅ BrightData MCP server is running on http://localhost:8014');
                log('📝 Logs being written to: ' + logFile);
                log('🔧 Ready for Claude Agent SDK integration');
            } else {
                log(`⚠️  MCP server responded with status: ${res.statusCode}`);
            }
        });
        
        req.on('error', (error) => {
            log(`❌ MCP server health check failed: ${error.message}`);
            log('💡 The server may still be starting up...');
        });
        
        req.on('timeout', () => {
            log('⚠️  MCP server health check timed out');
            req.destroy();
        });
        
        req.end();
        
    }, 3000);
    
    return serverProcess;
}

// Start the server
if (require.main === module) {
    const server = startMcpServer();
    
    // Export for potential use in other modules
    module.exports = { startMcpServer, log };
} else {
    // Export functions when required as module
    module.exports = { startMcpServer, log };
}