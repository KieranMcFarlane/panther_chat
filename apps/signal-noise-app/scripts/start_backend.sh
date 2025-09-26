#!/bin/bash
cd /Users/kieranmcfarlane/Downloads/panther_chat/signal-noise-app
source venv/bin/activate

# Set AuraDB environment variables
export NEO4J_URI="neo4j+s://cce1f84b.databases.neo4j.io"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0"

echo "Starting backend with AuraDB configuration..."
echo "NEO4J_URI: $NEO4J_URI"
echo "NEO4J_USER: $NEO4J_USER"
echo "NEO4J_PASSWORD: ${NEO4J_PASSWORD:0:10}..."

# Start the backend
python3 -m backend.main






