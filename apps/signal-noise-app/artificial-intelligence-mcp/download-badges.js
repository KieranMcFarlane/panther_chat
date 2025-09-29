#!/usr/bin/env node

// Script to download all missing badges using the artificial-intelligence-mcp server
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadMissingBadges() {
  console.log('🚀 Starting badge download process...');
  console.log('📋 This will download badges for all 144 entities identified in the dry run');
  
  try {
    // We'll use the MCP server's scan_and_download_missing_badges tool
    // Since we can't directly call MCP tools, we'll use the underlying functions
    
    // Import the MCP server functions
    const { scanAndDownloadMissingBadges } = await import('./dist/index.js');
    
    console.log('🔍 Scanning for entities without badges...');
    
    // Call the function with dry_run: false to actually download badges
    const result = await scanAndDownloadMissingBadges(false);
    
    console.log('✅ Badge download process completed!');
    console.log('📊 Results:');
    console.log(JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('❌ Error downloading badges:', error.message);
    process.exit(1);
  }
}

// Alternative approach using direct MCP server communication
async function downloadViaMCP() {
  console.log('🚀 Starting badge download via MCP server...');
  
  return new Promise((resolve, reject) => {
    // Create a JSON-RPC request to call the scan_and_download_missing_badges tool
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "scan_and_download_missing_badges",
        arguments: {
          dry_run: false
        }
      }
    };
    
    // Spawn the MCP server process
    const mcpProcess = spawn('node', ['dist/index.js'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let response = '';
    let error = '';
    
    mcpProcess.stdout.on('data', (data) => {
      response += data.toString();
    });
    
    mcpProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    mcpProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ MCP server completed successfully');
        console.log('Response:', response);
        resolve(response);
      } else {
        console.error('❌ MCP server failed with code:', code);
        console.error('Error:', error);
        reject(new Error(`MCP server failed with code ${code}`));
      }
    });
    
    mcpProcess.on('error', (err) => {
      console.error('❌ Failed to start MCP server:', err);
      reject(err);
    });
    
    // Send the request
    mcpProcess.stdin.write(JSON.stringify(request) + '\n');
    
    // Close stdin after sending the request
    mcpProcess.stdin.end();
  });
}

// Main execution
async function main() {
  try {
    console.log('🎯 Badge Download Script');
    console.log('====================');
    
    // Try the direct approach first
    await downloadMissingBadges();
    
  } catch (error) {
    console.log('⚠️  Direct approach failed, trying MCP server approach...');
    try {
      await downloadViaMCP();
    } catch (mcpError) {
      console.error('❌ Both approaches failed:');
      console.error('Direct error:', error.message);
      console.error('MCP error:', mcpError.message);
      process.exit(1);
    }
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { downloadMissingBadges, downloadViaMCP };