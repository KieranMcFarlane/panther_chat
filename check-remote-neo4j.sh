#!/bin/bash

echo "🔍 SSH Check for Remote Neo4j Server (212.86.105.190)"
echo "=================================================="

# Check if we can SSH to the server
echo "📡 Testing SSH connection..."
if ssh -o ConnectTimeout=10 -o BatchMode=yes root@212.86.105.190 "echo 'SSH connection successful'" 2>/dev/null; then
    echo "✅ SSH connection successful"
else
    echo "❌ SSH connection failed"
    echo "   Please ensure you have SSH access to the server"
    echo "   You may need to add your SSH key or use password authentication"
    exit 1
fi

echo ""
echo "🔧 Checking Neo4j Service Status..."

# Check if Neo4j is running
ssh root@212.86.105.190 << 'EOF'
echo "📊 System Information:"
echo "   OS: $(uname -a)"
echo "   Memory: $(free -h | grep Mem | awk '{print $2}')"
echo "   Disk: $(df -h / | tail -1 | awk '{print $4}') available"
echo ""

echo "🐳 Docker Status:"
if command -v docker &> /dev/null; then
    echo "   Docker is installed"
    echo "   Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(neo4j|7687|7474)" || echo "   No Neo4j containers found"
else
    echo "   Docker not installed"
fi
echo ""

echo "🔌 Port Status:"
echo "   Port 7687 (Bolt):"
netstat -tlnp 2>/dev/null | grep :7687 || ss -tlnp 2>/dev/null | grep :7687 || echo "   Port 7687 not listening"
echo "   Port 7474 (HTTP):"
netstat -tlnp 2>/dev/null | grep :7474 || ss -tlnp 2>/dev/null | grep :7474 || echo "   Port 7474 not listening"
echo ""

echo "📦 Neo4j Process Check:"
if pgrep -f neo4j > /dev/null; then
    echo "   Neo4j process found:"
    ps aux | grep neo4j | grep -v grep
else
    echo "   No Neo4j process found"
fi
echo ""

echo "🗄️ Neo4j Data Directory:"
if [ -d "/var/lib/neo4j" ]; then
    echo "   /var/lib/neo4j exists"
    ls -la /var/lib/neo4j/
elif [ -d "/opt/neo4j" ]; then
    echo "   /opt/neo4j exists"
    ls -la /opt/neo4j/
else
    echo "   No standard Neo4j directories found"
fi
echo ""

echo "🔐 Neo4j Configuration:"
if [ -f "/etc/neo4j/neo4j.conf" ]; then
    echo "   Main config: /etc/neo4j/neo4j.conf"
    grep -E "(dbms.connector|dbms.security)" /etc/neo4j/neo4j.conf | head -10
elif [ -f "/opt/neo4j/conf/neo4j.conf" ]; then
    echo "   Main config: /opt/neo4j/conf/neo4j.conf"
    grep -E "(dbms.connector|dbms.security)" /opt/neo4j/conf/neo4j.conf | head -10
else
    echo "   No standard Neo4j config found"
fi
echo ""

echo "📋 Recent Neo4j Logs:"
if [ -f "/var/log/neo4j/neo4j.log" ]; then
    echo "   Last 10 lines of neo4j.log:"
    tail -10 /var/log/neo4j/neo4j.log
elif [ -f "/opt/neo4j/logs/neo4j.log" ]; then
    echo "   Last 10 lines of neo4j.log:"
    tail -10 /opt/neo4j/logs/neo4j.log
else
    echo "   No standard Neo4j logs found"
fi
echo ""

echo "🌐 Network Connectivity:"
echo "   Local connections to Neo4j:"
netstat -an | grep :7687 | head -5 || echo "   No local connections to port 7687"
echo ""

echo "🔍 Docker Neo4j Check (if running in Docker):"
if docker ps | grep -q neo4j; then
    echo "   Neo4j container details:"
    docker ps | grep neo4j
    echo ""
    echo "   Neo4j container logs:"
    docker logs $(docker ps | grep neo4j | awk '{print $1}') --tail 10
else
    echo "   No Neo4j Docker containers running"
fi
EOF

echo ""
echo "✅ SSH check completed!"
echo "💡 If Neo4j is not running, you can start it with:"
echo "   docker run -d --name panther-neo4j \\"
echo "     -p 7474:7474 -p 7687:7687 \\"
echo "     -e NEO4J_AUTH=neo4j/pantherpassword \\"
echo "     -e NEO4J_PLUGINS='[\"apoc\",\"graph-data-science\"]' \\"
echo "     neo4j:5.15.0"





