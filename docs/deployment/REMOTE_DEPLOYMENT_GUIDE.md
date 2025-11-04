# 🌍 Remote Deployment Guide: Global Sports Intelligence with Ollama

This guide walks you through deploying the Global Sports Intelligence System to your remote server with Ollama integration, allowing you to query the unified Neo4j knowledge graph using any Ollama model like o3-mini.

## ✅ Prerequisites

### Remote Server Requirements
- **Ubuntu 20.04+** or similar Linux distribution
- **8GB+ RAM** (16GB recommended)
- **50GB+ disk space**
- **Docker and Docker Compose** support
- **SSH access** with key-based authentication

### Local Machine Requirements
- SSH client configured
- `rsync` installed
- Network access to remote server

## 🚀 Quick Deployment Steps

### 1. Deploy to Remote Server

```bash
# Replace with your server details
./deploy_to_remote_server.sh YOUR_SERVER_IP YOUR_USERNAME

# Example:
./deploy_to_remote_server.sh 192.168.1.100 ubuntu
```

This script will:
- ✅ Check SSH connectivity
- ✅ Install/verify Ollama on remote server
- ✅ Install Docker and Docker Compose
- ✅ Copy all project files
- ✅ Set up environment configuration

### 2. SSH into Your Server

```bash
ssh YOUR_USERNAME@YOUR_SERVER_IP
cd global-sports-intelligence
```

### 3. Start the System

```bash
# Start all services
./setup_global_unified_system.sh

# Or use the enhanced management script
./manage_remote_system.sh YOUR_SERVER_IP YOUR_USERNAME start
```

### 4. Pull Ollama Models

```bash
# From your local machine, pull required models
./manage_remote_system.sh YOUR_SERVER_IP YOUR_USERNAME pull-models
```

### 5. Test the System

```bash
# Test query functionality
./manage_remote_system.sh YOUR_SERVER_IP YOUR_USERNAME test-query
```

## 🔧 System Management

### Available Management Commands

```bash
# Check system status
./manage_remote_system.sh SERVER_IP USERNAME status

# Start system
./manage_remote_system.sh SERVER_IP USERNAME start

# Stop system
./manage_remote_system.sh SERVER_IP USERNAME stop

# Restart system
./manage_remote_system.sh SERVER_IP USERNAME restart

# View logs
./manage_remote_system.sh SERVER_IP USERNAME logs

# Pull/update Ollama models
./manage_remote_system.sh SERVER_IP USERNAME pull-models

# Test query functionality
./manage_remote_system.sh SERVER_IP USERNAME test-query
```

### Service Endpoints

Once deployed, your system will be available at:

| Service | URL | Description |
|---------|-----|-------------|
| **FastAPI with Ollama** | `http://YOUR_SERVER_IP:8000` | Main query interface with Ollama integration |
| **Neo4j Browser** | `http://YOUR_SERVER_IP:7474` | Database browser (neo4j/pantherpassword) |
| **Health Monitor** | `http://YOUR_SERVER_IP:8080` | System health dashboard |
| **Enhanced Crawl4AI** | `http://YOUR_SERVER_IP:8001` | Technical repository analysis |
| **Premier League Intel** | `http://YOUR_SERVER_IP:8002` | Business intelligence service |
| **MCP Server** | `http://YOUR_SERVER_IP:8003` | Model Context Protocol server |

## 📡 Querying with Ollama

### API Endpoints

#### 1. Query with Ollama (Recommended)
```bash
curl -X POST http://YOUR_SERVER_IP:8000/query-ollama \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the top partnership opportunities in Premier League?",
    "model": "o3-mini",
    "include_context": true,
    "max_tokens": 1000,
    "temperature": 0.1
  }'
```

#### 2. Direct Sports Intelligence Query
```bash
curl -X POST http://YOUR_SERVER_IP:8000/sports-intelligence \
  -H "Content-Type: application/json" \
  -d '{
    "query_type": "premier_league_intelligence",
    "organization": "Premier League"
  }'
```

#### 3. Knowledge Graph Statistics
```bash
curl http://YOUR_SERVER_IP:8000/knowledge-graph/stats
```

#### 4. Available Ollama Models
```bash
curl http://YOUR_SERVER_IP:8000/ollama/models
```

### Example Queries

1. **Premier League Analysis**:
   ```json
   {
     "query": "Analyze the digital transformation opportunities for Premier League clubs",
     "model": "o3-mini",
     "include_context": true
   }
   ```

2. **Partnership Discovery**:
   ```json
   {
     "query": "Find potential technology partnerships for sports organizations",
     "model": "o3-mini",
     "include_context": true
   }
   ```

3. **Technical Analysis**:
   ```json
   {
     "query": "What are the AI hallucination risks in sports technology repositories?",
     "model": "o3-mini",
     "include_context": true
   }
   ```

## 🎯 Model Selection

### Available Models

The system supports any Ollama model. Common options:

- **o3-mini**: Fast, efficient, good for sports intelligence
- **llama3**: General purpose, good reasoning
- **codellama**: Better for technical repository analysis
- **mistral**: Balanced performance and speed

### Switching Models

You can use any model by specifying it in your query:

```json
{
  "query": "Your question",
  "model": "llama3",  // or "o3-mini", "codellama", etc.
  "include_context": true
}
```

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Global Sports Intelligence                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Ollama    │    │  FastAPI    │    │   Neo4j     │     │
│  │   Models    │◄──►│  Service    │◄──►│ Knowledge   │     │
│  │             │    │             │    │   Graph     │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Crawl4AI    │    │ Premier     │    │    MCP      │     │
│  │ Technical   │◄──►│ League      │◄──►│   Server    │     │
│  │ Analysis    │    │ Business    │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## 🔒 Security Considerations

### Firewall Configuration
```bash
# Allow required ports
sudo ufw allow 8000  # FastAPI
sudo ufw allow 7474  # Neo4j Browser
sudo ufw allow 7687  # Neo4j Bolt
sudo ufw allow 11434 # Ollama
```

### SSL/TLS (Production)
For production deployment, consider:
- Setting up reverse proxy with nginx
- SSL certificates with Let's Encrypt
- Authentication and authorization

## 🐛 Troubleshooting

### Common Issues

#### 1. Ollama Not Starting
```bash
# Check Ollama service
ssh YOUR_USERNAME@YOUR_SERVER_IP
ps aux | grep ollama

# Start manually if needed
nohup ollama serve > ollama.log 2>&1 &
```

#### 2. Docker Permissions
```bash
# Add user to docker group
sudo usermod -aG docker YOUR_USERNAME
# Log out and back in
```

#### 3. Neo4j Connection Issues
```bash
# Check Neo4j logs
docker logs global-sports-neo4j

# Test connection
docker exec global-sports-neo4j cypher-shell -u neo4j -p pantherpassword "RETURN 1"
```

#### 4. Port Conflicts
```bash
# Check what's using ports
netstat -tulpn | grep :8000
```

### Log Locations

- **Ollama logs**: `~/global-sports-intelligence/ollama.log`
- **Docker logs**: `docker logs CONTAINER_NAME`
- **System logs**: Check with `./manage_remote_system.sh SERVER_IP USERNAME logs`

## 📊 Performance Optimization

### For Better Performance

1. **Increase Docker memory limits** in docker-compose.yml
2. **Use faster models** like o3-mini for production
3. **Configure Neo4j memory** settings based on your data size
4. **Monitor resource usage** with system tools

### Resource Requirements by Scale

| Data Size | RAM | CPU | Storage |
|-----------|-----|-----|---------|
| Small (< 1K orgs) | 8GB | 4 cores | 50GB |
| Medium (< 10K orgs) | 16GB | 8 cores | 100GB |
| Large (10K+ orgs) | 32GB | 16 cores | 200GB |

## 🎉 Success Verification

Your system is working correctly when:

1. ✅ All Docker containers are healthy: `docker ps`
2. ✅ Ollama responds: `curl http://localhost:11434/api/tags`
3. ✅ FastAPI health check passes: `curl http://localhost:8000/health`
4. ✅ Neo4j has data: Check `/knowledge-graph/stats` endpoint
5. ✅ Query test succeeds: Use `test-query` command

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs using the management script
3. Verify all prerequisites are met
4. Test each component individually

---

🚀 **You now have a fully integrated Global Sports Intelligence system running on your remote server with Ollama support!** 

Query the unified Neo4j knowledge graph using any Ollama model of your choice through the FastAPI interface at `http://YOUR_SERVER_IP:8000`. 