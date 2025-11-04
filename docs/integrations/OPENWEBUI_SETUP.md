# Open WebUI Integration Guide

This guide shows how to expose your Yellow Panther RAG agents as selectable "models" in Open WebUI, while still using your existing Vercel AI SDK backend with all the tools and knowledge bases.

## Overview

```
Open WebUI → Select "🐆 Yellow Panther RAG Agent" → Proxy Server → Your Next.js Backend → RAG Tools
```

Instead of talking directly to Ollama models, Open WebUI will route selected conversations through your full RAG pipeline including:
- ✅ Neo4j Knowledge Graph queries
- ✅ LinkedIn Intelligence searches  
- ✅ Premier League club research
- ✅ Sports industry RAG system
- ✅ All existing tools and personas

## Quick Setup

### 1. Install Dependencies
```bash
cd yellow-panther-ai
pip install -r requirements-proxy.txt
```

### 2. Start Your Systems
```bash
# Terminal 1: Start your Next.js backend (if not running)
PORT=3001 npm run dev

# Terminal 2: Start the OpenWebUI proxy
OPENWEBUI_PROXY_PORT=8331 python openwebui-rag-proxy-dynamic.py
```

### 3. Configure Open WebUI

1. **Add Custom Model Provider** in Open WebUI:
   - Go to **Settings** → **Models** → **Add Model**
   - **API Base URL**: `http://localhost:8331/v1`
   - **API Key**: `anything` (not validated)
   - **Model**: Leave blank (will auto-discover)

2. **Select Your RAG Agent** in chat:
   - In a new conversation, click the model dropdown
   - Select one of:
     - 🐆 **Yellow Panther RAG Agent** (full capabilities)
     - ⚽ **Premier League Intelligence** (clubs focus)
     - 🔗 **LinkedIn Network Analyzer** (contacts focus)
     - 🕸️ **Sports Knowledge Graph** (relationships focus)

## Available RAG Agent Models

### 🐆 Yellow Panther RAG Agent
**Full-capability agent with access to all tools**
- Premier League intelligence and club analysis
- LinkedIn network analysis and professional insights
- Neo4j knowledge graph queries for relationship mapping
- Sports industry RAG search for technical and market insights
- Uses all available tools as appropriate for comprehensive analysis

### ⚽ Premier League Intelligence
**Specialized for Premier League club research**
- All 20 Premier League clubs analysis
- Key stakeholder identification
- Digital maturity assessment  
- Partnership opportunity scoring
- Primarily uses `researchPremierLeagueClub` and `researchAllPremierLeagueClubs` tools

### 🔗 LinkedIn Network Analyzer
**Deep LinkedIn analysis specialist**
- 25K+ sports professionals database
- IT and digital roles mapping
- Network connection analysis
- Contact relationship tracking
- Primarily uses `searchLinkedIn` tool

### 🕸️ Sports Knowledge Graph
**Neo4j knowledge graph specialist**
- 300+ sports organizations
- Relationship mapping
- Project tracking
- Industry trend analysis
- Primarily uses `queryKnowledgeGraph` tool

## Configuration

### Environment Variables
```bash
# Optional: Change proxy port (default: 8331)
export OPENWEBUI_PROXY_PORT=8331

# Optional: Change backend URL (default: http://localhost:3001)
export RAG_BACKEND_URL=http://localhost:3001
```

### Troubleshooting

**Problem**: Models don't appear in Open WebUI dropdown
- **Solution**: Check that proxy is running on port 8331 and API base URL is correct

**Problem**: "Error: Failed to connect to RAG backend"
- **Solution**: Ensure your Next.js app is running on port 3001 (`PORT=3001 npm run dev`)

**Problem**: Responses are empty or malformed
- **Solution**: Check that your `/api/chat` route is working with a direct test

**Problem**: Open WebUI shows "Model not found"
- **Solution**: Make sure you're selecting one of the 4 predefined model IDs

**Problem**: Proxy shows "address already in use"
- **Solution**: Use port 8331 instead of 8001: `OPENWEBUI_PROXY_PORT=8331 python openwebui-rag-proxy-dynamic.py`

### Testing the Proxy

Test the proxy directly:
```bash
curl -X POST http://localhost:8331/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "yellow-panther-rag",
    "messages": [{"role": "user", "content": "Who are the key decision makers at Brighton?"}],
    "stream": false
  }'
```

### Health Check
```bash
curl http://localhost:8331/health
```

## Benefits

✅ **Better UI**: Open WebUI's superior chat interface vs basic Vercel AI SDK UI
✅ **Same Backend**: All your existing RAG tools, knowledge graphs, and agents work unchanged  
✅ **Model Selection**: Choose specialized agents (Premier League vs LinkedIn vs Knowledge Graph)
✅ **Streaming**: Full streaming support for real-time responses
✅ **Multiple Users**: Open WebUI handles user sessions and conversation history
✅ **Advanced Features**: Open WebUI's file uploads, conversation management, etc.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐
│   Open WebUI    │───▶│  Proxy Server    │───▶│   Next.js Backend   │
│                 │    │  (Port 8001)     │    │   (Port 3000)       │
│ Model Selection │    │                  │    │                     │
│ - Yellow Panther│    │ OpenAI-Compatible│    │ Vercel AI SDK       │
│ - Premier League│    │ API Translation  │    │ + All Your Tools    │
│ - LinkedIn      │    │                  │    │                     │
│ - Knowledge Graph    │                  │    │ • Neo4j             │
└─────────────────┘    └──────────────────┘    │ • LinkedIn API      │
                                                │ • RAG System        │
                                                │ • Crawl4AI          │
                                                └─────────────────────┘
```

The proxy server acts as a translation layer, converting Open WebUI's OpenAI-style requests into calls to your existing Vercel AI SDK backend, then formatting the responses back to OpenAI format for Open WebUI to display.

## Next Steps

Once this is working, you can:
1. **Add more specialized agents** by modifying `AVAILABLE_MODELS` in `openwebui-rag-proxy.py`
2. **Create agent-specific system prompts** for different use cases
3. **Deploy the proxy** alongside your Next.js app for production use
4. **Integrate with Ollama models** by adding local model options alongside your RAG agents

This gives you the best of both worlds: Open WebUI's excellent interface with your powerful RAG system underneath! 