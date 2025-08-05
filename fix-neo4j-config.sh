#!/bin/bash

echo "🔧 Fixing Neo4j configuration for Yellow Panther RAG system..."

# Update environment variables on remote server
cat > /tmp/update-neo4j-config.sh << 'EOF'
#!/bin/bash

echo "🔧 Updating Neo4j configuration on remote server..."

cd /opt/yellow-panther-ai

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found, creating one..."
    touch .env
fi

# Update or add Neo4j configuration
echo "🔧 Updating Neo4j connection to use local server..."

# Remove old Neo4j entries
grep -v '^NEO4J_' .env > .env.tmp || touch .env.tmp
mv .env.tmp .env

# Add correct Neo4j configuration
cat >> .env << 'EOFENV'

# Neo4j Configuration (Local Docker)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword
NEO4J_DATABASE=neo4j
EOFENV

echo "✅ Updated .env file with correct Neo4j configuration"

# Restart the services to pick up new configuration
echo "🔄 Restarting services..."
pkill -f "python3.*openwebui-rag-proxy-dynamic.py" || echo "No proxy process found"
pkill -f "npm.*dev" || echo "No Next.js process found"

# Wait a moment for processes to stop
sleep 3

# Start the services again
echo "🚀 Starting Dynamic RAG Proxy..."
cd /opt/yellow-panther-ai
nohup python3 openwebui-rag-proxy-dynamic.py > proxy.log 2>&1 &

echo "🚀 Starting Next.js frontend..."
nohup npm run dev > nextjs.log 2>&1 &

echo "⏳ Waiting for services to start..."
sleep 10

# Test the services
echo "🧪 Testing services..."
curl -s http://localhost:8001/health && echo "✅ RAG Proxy is running"
curl -s http://localhost:3001 && echo "✅ Next.js is running"

echo "✅ Services restarted with updated Neo4j configuration"
echo "📝 Logs available at:"
echo "   - RAG Proxy: /opt/yellow-panther-ai/proxy.log"
echo "   - Next.js: /opt/yellow-panther-ai/nextjs.log"
EOF

echo "📁 Uploading configuration fix script..."
scp /tmp/update-neo4j-config.sh root@212.86.105.190:/opt/

echo "🔧 Executing configuration fix on remote server..."
ssh root@212.86.105.190 'chmod +x /opt/update-neo4j-config.sh && /opt/update-neo4j-config.sh'

echo "✅ Neo4j configuration fix complete!"
echo "🧪 Testing knowledge graph connectivity..."
sleep 5
curl -s "http://212.86.105.190:8001/health" && echo "✅ RAG Proxy responding" || echo "❌ RAG Proxy not responding"

echo ""
echo "🎯 Next steps:"
echo "1. Try your Yellow Panther RAG query again in Open WebUI"
echo "2. You should now see successful knowledge graph connections"
echo "3. The system should display node counts and graph analysis" 