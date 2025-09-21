# OpenWebUI Direct Integration v2.0

🎯 **Problem Solved**: The previous version had complex Vercel AI SDK stream parsing that caused garbled responses in OpenWebUI. This version bypasses that entirely with direct OpenAI integration.

## What Changed

### Before (v1.0)
```
OpenWebUI → Proxy → Next.js (Vercel AI SDK) → OpenAI
                   ↳ Complex stream parsing
                   ↳ Raw chunks like f:{} 0:"text"
```

### After (v2.0) 
```
OpenWebUI → Proxy → OpenAI (Direct)
           ↳ Clean OpenAI streaming
           ↳ Perfect text responses
```

## Architecture

- **OpenWebUI Proxy v2.0**: FastAPI server that calls OpenAI directly
- **Next.js Backend**: Optional, only needed for RAG tools
- **OpenWebUI**: Clean text responses, no more parsing issues

## Quick Setup

### 1. On Remote Server
```bash
# Copy files to server
scp openwebui-rag-proxy.py deploy-remote-openwebui.sh setup-remote-server.sh root@212.86.105.190:/opt/yellow-panther-ai/

# SSH to server
ssh root@212.86.105.190

# Navigate to directory
cd /opt/yellow-panther-ai

# Run setup
./setup-remote-server.sh

# Add your OpenAI API key
nano .env
# Add: OPENAI_API_KEY=your_key_here

# Start services
./deploy-remote-openwebui.sh
```

### 2. Configure OpenWebUI
1. Open: http://212.86.105.190:3000/
2. Go to Settings → Models → Add Model
3. Add:
   - **API Base URL**: `http://212.86.105.190:8090/v1`
   - **API Key**: `anything` (proxy handles OpenAI auth)
4. Save and select your RAG agents!

## Available Models

- 🐆 **Yellow Panther RAG Agent** - Full capabilities
- ⚽ **Premier League Intelligence** - Clubs focus  
- 🔗 **LinkedIn Network Analyzer** - Contacts focus
- 🕸️ **Sports Knowledge Graph** - Relationships focus

## Benefits

✅ **Clean Responses**: No more `f:{} 0:"text"` chunks  
✅ **Direct OpenAI**: Bypass Vercel AI SDK complexity  
✅ **Preserved RAG**: All intelligence capabilities intact  
✅ **Simple Architecture**: Easier to debug and maintain  
✅ **Better Performance**: Fewer hops, faster responses  

## Testing

```bash
# Check health
curl http://212.86.105.190:8090/health

# List models  
curl http://212.86.105.190:8090/v1/models

# Test chat (streaming)
curl -X POST http://212.86.105.190:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "yellow-panther-rag",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Environment Variables

Required:
- `OPENAI_API_KEY` - Your OpenAI API key

Optional:
- `OPENWEBUI_PROXY_PORT` - Proxy port (default: 8090)
- `RAG_BACKEND_URL` - Next.js backend URL (default: http://localhost:4200)

## Troubleshooting

### OpenAI Connection Issues
```bash
# Check API key
echo $OPENAI_API_KEY

# Test direct OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Port Conflicts
The script automatically finds available ports:
- Next.js: 4200+ 
- Proxy: 8090+

### Firewall
Make sure these ports are open:
- 8090 (proxy)
- 4200 (Next.js - optional)
- 3000 (OpenWebUI)

## Logs

```bash
# Proxy logs
tail -f /var/log/yellow-panther/proxy.log

# Check processes
ps aux | grep -E "(python3.*proxy|npm.*dev)"

# Health check
curl http://localhost:8090/health | jq
```

---

🐆 **Yellow Panther RAG v2.0** - Clean OpenAI integration for OpenWebUI 