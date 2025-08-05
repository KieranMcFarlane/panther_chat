#!/bin/bash

echo "🗄️ Setting up Neo4j on Remote Server with Sports Data..."

# Create Neo4j setup script for remote server
cat > /tmp/remote-neo4j-setup.sh << 'EOF'
#!/bin/bash

echo "🗄️ Installing and configuring Neo4j on remote server..."

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    apt update
    apt install -y apt-transport-https ca-certificates curl gnupg lsb-release
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

# Stop any existing Neo4j container
echo "🛑 Stopping existing Neo4j containers..."
docker stop panther-neo4j 2>/dev/null || echo "No existing Neo4j container found"
docker rm panther-neo4j 2>/dev/null || echo "No existing Neo4j container to remove"

# Create directory for Neo4j data
mkdir -p /opt/neo4j-data
mkdir -p /opt/neo4j-import

# Start Neo4j container
echo "🚀 Starting Neo4j container..."
docker run -d \
  --name panther-neo4j \
  --restart unless-stopped \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/pantherpassword \
  -e NEO4J_PLUGINS='["apoc", "graph-data-science"]' \
  -e NEO4J_apoc_export_file_enabled=true \
  -e NEO4J_apoc_import_file_enabled=true \
  -e NEO4J_apoc_import_file_use__neo4j__config=true \
  -e NEO4J_dbms_security_procedures_unrestricted=apoc.* \
  -e NEO4J_dbms_memory_heap_initial__size=1G \
  -e NEO4J_dbms_memory_heap_max__size=2G \
  -e NEO4J_dbms_memory_pagecache_size=512M \
  -v /opt/neo4j-data:/data \
  -v /opt/neo4j-import:/var/lib/neo4j/import \
  neo4j:5.15-community

# Wait for Neo4j to start
echo "⏳ Waiting for Neo4j to start (30 seconds)..."
sleep 30

# Check if Neo4j is responding
echo "🔍 Checking Neo4j status..."
for i in {1..10}; do
  if docker exec panther-neo4j cypher-shell -u neo4j -p pantherpassword "RETURN 1 as test" &>/dev/null; then
    echo "✅ Neo4j is running and responding!"
    break
  fi
  echo "⏳ Waiting for Neo4j... ($i/10)"
  sleep 5
done

echo "🗄️ Neo4j setup complete!"
echo "📊 Access Neo4j Browser at: http://212.86.105.190:7474"
echo "🔗 Bolt connection: bolt://212.86.105.190:7687"
echo "👤 Username: neo4j"
echo "🔐 Password: pantherpassword"
EOF

echo "📝 Created remote Neo4j setup script"
echo "📤 Uploading and executing on remote server..."

scp /tmp/remote-neo4j-setup.sh root@212.86.105.190:/tmp/
ssh root@212.86.105.190 'chmod +x /tmp/remote-neo4j-setup.sh && /tmp/remote-neo4j-setup.sh'

echo "✅ Remote Neo4j setup complete!"
echo ""
echo "🔄 Next step: Update remote configuration..." 