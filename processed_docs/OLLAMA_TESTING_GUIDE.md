# Testing Yellow Panther RAG with Self-Hosted Ollama

This guide shows how to test your Yellow Panther RAG agents alongside your existing self-hosted Ollama models in Open WebUI.

## Setup Overview

```
Open WebUI → Model Selection:
├── 🦙 llama3 (Ollama)          ← Your existing models
├── 🤖 mistral (Ollama)         ← Direct Ollama models  
├── 🐆 Yellow Panther RAG       ← Your RAG agent
├── ⚽ Premier League Intel     ← Specialized RAG
└── 🔗 LinkedIn Analyzer       ← Specialized RAG
```

## Prerequisites

### 1. Verify Ollama is Running
```bash
# Check Ollama status
ollama list

# Test Ollama API
curl http://localhost:11434/api/tags

# If not running, start Ollama
ollama serve
```

### 2. Verify Open WebUI Setup
```bash
# If using Docker
docker run -d -p 3000:8080 \
  -e OLLAMA_BASE_URL=http://localhost:11434 \
  -v open-webui:/app/backend/data \
  --name open-webui \
  --restart always \
  ghcr.io/open-webui/open-webui:main

# Or if installed locally
open-webui serve
```

### 3. Test Your Current Setup
1. Open Open WebUI (usually http://localhost:3000)
2. Verify you can see your Ollama models in the dropdown
3. Test a conversation with an existing Ollama model

## Integration Steps

### 1. Start Your RAG Backend
```bash
cd yellow-panther-ai

# Start your Next.js backend
npm run dev
# Should be running on http://localhost:3000
```

### 2. Start the RAG Proxy
```bash
# In another terminal
python3 openwebui-rag-proxy.py
# Should be running on http://localhost:8001
```

### 3. Add RAG Models to Open WebUI

**Option A: Using the Web Interface**
1. Go to Open WebUI → **Settings** → **Admin** → **Models**
2. Click **"Add Model"**
3. Fill in:
   - **Model ID**: `yellow-panther-rag`
   - **Model Name**: `🐆 Yellow Panther RAG Agent`
   - **Base URL**: `http://localhost:8001/v1`
   - **API Key**: `sk-anything` (not validated)
4. Save and repeat for other models

**Option B: Using Environment Variables**
```bash
# Add to your Open WebUI environment
export OPENAI_API_BASE_URLS="http://localhost:8001/v1"
export OPENAI_API_KEYS="sk-anything"

# Restart Open WebUI
```

**Option C: Using Docker with Multiple Providers**
```bash
docker run -d -p 3000:8080 \
  -e OLLAMA_BASE_URL=http://localhost:11434 \
  -e OPENAI_API_BASE_URL=http://localhost:8001/v1 \
  -e OPENAI_API_KEY=sk-anything \
  -v open-webui:/app/backend/data \
  --name open-webui \
  --restart always \
  ghcr.io/open-webui/open-webui:main
```

## Testing Scenarios

### Test 1: Basic Model Listing
```bash
# Test that both Ollama and RAG models appear
curl http://localhost:3000/api/models

# Should show both:
# - Ollama models (llama3, mistral, etc.)
# - RAG models (yellow-panther-rag, premier-league-intel, etc.)
```

### Test 2: Direct Ollama vs RAG Comparison
1. **Test with Ollama Model (e.g., llama3)**:
   - Ask: "Tell me about Premier League clubs"
   - Expected: General knowledge response

2. **Test with Yellow Panther RAG**:
   - Ask: "Tell me about Premier League clubs"
   - Expected: Detailed intelligence with LinkedIn data, stakeholder info, partnership opportunities

### Test 3: Specialized Agent Testing
```bash
# Test Premier League Intelligence agent
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "premier-league-intel",
    "messages": [{"role": "user", "content": "Research Brighton & Hove Albion"}]
  }'

# Test LinkedIn Network Analyzer
curl -X POST http://localhost:8001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "linkedin-network-analyzer", 
    "messages": [{"role": "user", "content": "Find IT professionals at Arsenal"}]
  }'
```

### Test 4: Performance Comparison
1. **Speed Test**: Compare response times between Ollama and RAG
2. **Quality Test**: Ask the same sports industry question to both
3. **Tool Usage**: RAG should show tool invocations, Ollama won't

## Troubleshooting

### Problem: RAG models don't appear in Open WebUI
**Solution**: Check model configuration
```bash
# Verify proxy is accessible
curl http://localhost:8001/v1/models

# Check Open WebUI logs for connection errors
docker logs open-webui  # If using Docker
```

### Problem: "Connection refused" to Ollama
**Solution**: 
```bash
# Check Ollama is running
ollama list

# Verify Ollama API is accessible
curl http://localhost:11434/api/tags

# Restart Ollama if needed
ollama serve
```

### Problem: RAG responses are slow/timeout
**Solution**: 
```bash
# Check your Next.js backend is running
curl http://localhost:3000

# Monitor RAG proxy logs
python3 openwebui-rag-proxy.py  # Check console output

# Test backend directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "test"}]}'
```

### Problem: Models show but give errors
**Solution**: Verify API compatibility
```bash
# Test the proxy health
curl http://localhost:8001/health

# Run the test script
python3 test-proxy.py
```

## Advanced Configuration

### Using Both Ollama and RAG for Different Tasks

**Conversation Strategy**:
1. **Use Ollama models** for:
   - General conversations
   - Code generation  
   - Creative writing
   - Quick responses

2. **Use RAG agents** for:
   - Sports industry intelligence
   - Contact research
   - Business opportunity analysis
   - Specialized knowledge queries

### Model Selection Tips

**In Open WebUI conversations**:
- Start with RAG agents for business queries
- Switch to Ollama for follow-up general questions
- Use specialized RAG agents (Premier League, LinkedIn) for focused research

### Performance Optimization

```bash
# For faster RAG responses, ensure your backend is optimized
export NODE_ENV=production
export RAG_CACHE_TTL=300  # Cache responses for 5 minutes

# For Ollama performance
ollama run llama3 --num-gpu 1  # Use GPU if available
```

## Example Conversation Flow

```
1. User selects "🐆 Yellow Panther RAG Agent"
   Query: "Research Manchester United's digital team"
   → Uses searchLinkedIn + researchPremierLeagueClub tools
   → Returns detailed stakeholder analysis

2. User switches to "🦙 llama3" 
   Query: "Write an email template for reaching out"
   → Uses Ollama's language generation
   → Returns generic business email template

3. User switches back to "⚽ Premier League Intelligence"
   Query: "What's the partnership status of Man United?"
   → Uses specialized club intelligence
   → Returns current agency relationships and opportunities
```

## Benefits of This Hybrid Approach

✅ **Best of Both Worlds**: 
- Ollama for general AI capabilities
- RAG for specialized business intelligence

✅ **Model Selection**:
- Choose the right tool for each task
- Seamless switching between models

✅ **Cost Effective**:
- Local Ollama models (free)
- Powerful RAG for business-critical queries

✅ **Privacy**:
- Sensitive business data stays local
- No external API calls for general queries

This setup gives you the flexibility to use local Ollama models for everyday tasks while leveraging your specialized RAG system for sports industry intelligence! 