#!/bin/bash

# MCP Server Stop Script
# Stops all running MCP servers

echo "🛑 Stopping MCP Servers..."

# Function to stop server
stop_server() {
    local server_name=$1
    local pid_file="logs/${server_name}.pid"
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        echo "🛑 Stopping $server_name (PID: $pid)..."
        
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            
            # Wait for graceful shutdown
            sleep 2
            
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                echo "⚡ Force killing $server_name..."
                kill -9 "$pid"
            fi
            
            echo "✅ $server_name stopped"
        else
            echo "⚠️ $server_name was not running"
        fi
        
        rm -f "$pid_file"
    else
        echo "⚠️ No PID file found for $server_name"
    fi
}

# Stop all servers
stop_server "neo4j-mcp"
stop_server "brightdata-mcp" 
stop_server "perplexity-mcp"

# Clean up any remaining node processes
echo "🧹 Cleaning up remaining processes..."
pkill -f "neo4j-server.js" 2>/dev/null || true
pkill -f "brightdata-server.js" 2>/dev/null || true
pkill -f "perplexity-server.js" 2>/dev/null || true

echo "✅ All MCP servers stopped"