# Yellow Panther RAG - Deployment Guide v2.0

🚀 **Quick deployment for OpenWebUI integration with direct OpenAI**

## Prerequisites

- Remote server: 212.86.105.190
- OpenWebUI running on port 3000
- .env file with OpenAI API key configured

## Files Overview

- **setup-remote-server.sh** - Initial server setup and dependency installation
- **deploy-remote-openwebui.sh** - Start the RAG proxy services  
- **openwebui-rag-proxy.py** - Direct OpenAI integration proxy
- **.env** - Environment configuration with API keys

## Deployment Steps

### 1. Copy Files to Server
```bash
scp setup-remote-server.sh deploy-remote-openwebui.sh openwebui-rag-proxy.py root@212.86.105.190:/opt/yellow-panther-ai/
```

### 2. SSH to Server
```bash
ssh root@212.86.105.190
cd /opt/yellow-panther-ai
```

### 3. Run Setup (First Time Only)
```bash
./setup-remote-server.sh
```

This will:
- Create/verify .env file with all configurations
- Install Python dependencies (fastapi, uvicorn, openai, etc.)
- Test OpenAI connection
- Verify system requirements

### 4. Deploy Services
```bash
./deploy-remote-openwebui.sh
```

This will:
- Load environment variables from .env
- Start Next.js backend (port 4200) for RAG tools
- Start OpenWebUI proxy (port 8090) with direct OpenAI integration
- Show configuration instructions

### 5. Configure OpenWebUI

1. Open: http://212.86.105.190:3000/
2. Go to **Settings → Models → Add Model**
3. Configure:
   - **API Base URL**: `http://212.86.105.190:8090/v1`
   - **API Key**: `anything` (proxy handles authentication)
4. **Save** and select your RAG models!

## Available Models

- 🐆 **yellow-panther-rag** - Full capabilities  
- ⚽ **premier-league-intel** - Premier League focus
- 🔗 **linkedin-network-analyzer** - LinkedIn contacts
- 🕸️ **sports-knowledge-graph** - Neo4j relationships

## Environment Configuration

The .env file contains:

```bash
# Core OpenAI Configuration
LLM_API_KEY=sk-proj-nQMd... # Your OpenAI API key
LLM_CHOICE=gpt-4o-mini

# Neo4j (AuraDB Free)
NEO4J_URI=neo4j+s://8ea452cf.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=03mCRD_G1heKdVGiVKHQ1TvR0mIlb1zLxiLa9ouMjIw

# PostgreSQL (Neon)
DATABASE_URL=postgresql://agentic_rag_db_owner:npg_BAuLqMZ26VCR@ep-rapid-meadow-abqnw3sw-pooler.eu-west-2.aws.neon.tech/agentic_rag_db?sslmode=require&channel_binding=require

# LinkedIn Scraping
BRIGHTDATA_API_KEY=1a1ee26d6b814f34ed637fc94c2b05d98c35a6454e9ed740f1b8bcca77c0aa9a

# And more configurations...
```

## Health Checks

```bash
# Check proxy health
curl http://localhost:8090/health

# List available models
curl http://localhost:8090/v1/models

# Test OpenAI connection
curl https://api.openai.com/v1/models -H "Authorization: Bearer $LLM_API_KEY"
```

## Troubleshooting

### Missing OpenAI Key
If you get API key errors:
```bash
nano .env
# Verify LLM_API_KEY is set correctly
```

### Port Conflicts  
The scripts automatically find available ports:
- Next.js: 4200+
- Proxy: 8090+

### Service Status
```bash
# Check running processes
ps aux | grep -E "(python3.*proxy|npm.*dev)"

# View logs
tail -f nohup.out
```

### Restart Services
```bash
# Kill existing processes
pkill -f "python3.*proxy"
pkill -f "npm.*dev"

# Restart
./deploy-remote-openwebui.sh
```

## What's New in v2.0

✅ **Direct OpenAI Integration** - No more Vercel AI SDK parsing  
✅ **Clean Responses** - Perfect text in OpenWebUI  
✅ **Auto Environment Loading** - .env file automatically loaded  
✅ **Better Error Handling** - Clear diagnostics  
✅ **Simplified Architecture** - Fewer moving parts  

---

🐆 **Yellow Panther RAG v2.0** - Enterprise sports intelligence made simple 