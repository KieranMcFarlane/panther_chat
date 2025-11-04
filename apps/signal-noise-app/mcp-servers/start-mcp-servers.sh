#!/bin/bash

# MCP Server Startup Script
# Starts all MCP servers for Yellow Panther Signal Noise App

echo "🚀 Starting MCP Servers for Yellow Panther..."

# Create logs directory
mkdir -p logs

# Function to start server with logging
start_server() {
    local server_name=$1
    local server_script=$2
    
    echo "🔌 Starting $server_name..."
    
    # Start server in background with logging
    node $server_script > logs/${server_name}.log 2>&1 &
    local pid=$!
    
    echo "✅ $server_name started (PID: $pid)"
    echo $pid > logs/${server_name}.pid
    
    # Give server time to start
    sleep 2
    
    # Check if server is still running
    if kill -0 $pid 2>/dev/null; then
        echo "✅ $server_name is running successfully"
    else
        echo "❌ $server_name failed to start. Check logs/${server_name}.log"
        cat logs/${server_name}.log
        return 1
    fi
    
    return 0
}

# Change to MCP servers directory
cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing MCP server dependencies..."
    npm install
fi

# Start Neo4j MCP Server
start_server "neo4j-mcp" "src/mcp-servers/neo4j-server.js" || exit 1

# Start BrightData MCP Server  
start_server "brightdata-mcp" "src/mcp-servers/brightdata-server.js" || exit 1

# Start Perplexity MCP Server
start_server "perplexity-mcp" "src/mcp-servers/perplexity-server.js" || exit 1

echo ""
echo "🎉 All MCP servers started successfully!"
echo ""
echo "📊 Server Status:"
echo "  - Neo4j MCP: Running (PID: $(cat logs/neo4j-mcp.pid 2>/dev/null || echo 'N/A'))"
echo "  - BrightData MCP: Running (PID: $(cat logs/brightdata-mcp.pid 2>/dev/null || echo 'N/A'))"  
echo "  - Perplexity MCP: Running (PID: $(cat logs/perplexity-mcp.pid 2>/dev/null || echo 'N/A'))"
echo ""
echo "📋 Available commands:"
echo "  - Stop all servers: ./stop-mcp-servers.sh"
echo "  - Check logs: tail -f logs/*.log"
echo "  - Restart single server: ./restart-server.sh <server-name>"
echo ""
echo "🔗 Test MCP integration:"
echo "  - curl -X POST http://localhost:3005/api/mcp-autonomous/test -H \"Content-Type: application/json\" -d '{\"testType\":\"all\"}'"
echo ""

# Wait a bit for servers to fully initialize
sleep 3

# Test if servers are responding
echo "🧪 Testing MCP server connectivity..."
node -e "
const { mcpBus } = require('../src/lib/mcp/MCPClientBus');
mcpBus.initialize().then(() => {
    console.log('✅ MCP Client Bus connected successfully');
    const tools = mcpBus.getAvailableTools();
    console.log(\`📝 Available tools: \${tools.length}\`);
    tools.forEach(tool => console.log(\`  - \${tool.name} (\${tool.server})\`));
    process.exit(0);
}).catch(err => {
    console.error('❌ MCP Client Bus failed:', err.message);
    process.exit(1);
});
"