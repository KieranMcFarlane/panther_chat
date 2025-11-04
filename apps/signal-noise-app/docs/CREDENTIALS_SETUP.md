# CopilotKit + Mastra Canvas Credentials Setup

## Required Credentials

### 1. OpenAI API Key (Required)
The Mastra agent uses OpenAI's GPT-4o-mini model for AI interactions.

**Setup:**
```bash
# Edit .env.local and add your OpenAI API key
echo "OPENAI_API_KEY=your-actual-openai-api-key-here" >> .env.local
```

**Get your key from:** https://platform.openai.com/api-keys

### 2. Backend API URL (Already Set)
The canvas connects to your existing FastAPI backend.

**Current setting:**
```bash
BACKEND_BASE_URL=http://localhost:3000
```

### 3. Optional: CopilotKit Cloud (Not Required)
If you want to use CopilotKit Cloud features, add:
```bash
COPILOT_CLOUD_PUBLIC_API_KEY=your-copilot-cloud-key-here
```

## Current Environment Files

### `.env.local` (Frontend/Canvas)
```bash
# CopilotKit + Mastra Configuration
OPENAI_API_KEY=your-openai-api-key-here
BACKEND_BASE_URL=http://localhost:3000

# Optional: CopilotKit Cloud (if using)
# COPILOT_CLOUD_PUBLIC_API_KEY=your-copilot-cloud-key-here

# Existing credentials from .env
NEXT_PUBLIC_CLAUDE_CONSOLE_URL=http://localhost:5173
```

### `.env` (Backend - Already Configured)
```bash
# Neo4j AuraDB Configuration
NEO4J_URI=neo4j+s://cce1f84b.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0

# API Keys
PERPLEXITY_API_KEY=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

# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO
```

## Verification Steps

1. **Set OpenAI API Key:**
   ```bash
   cd /Users/kieranmcfarlane/Downloads/panther_chat/signal-noise-app
   # Edit .env.local and replace 'your-openai-api-key-here' with actual key
   ```

2. **Test Canvas Route:**
   ```bash
   curl -s http://localhost:3001/canvas | head -5
   ```

3. **Test Backend Connection:**
   ```bash
   curl -s http://localhost:3000/health
   ```

4. **Test API Proxies:**
   ```bash
   curl -s -X POST http://localhost:3001/api/dossier/request \
     -H "Content-Type: application/json" \
     -d '{"entity_type":"company","entity_name":"Test","priority":"high"}'
   ```

## Security Notes

- ✅ `OPENAI_API_KEY` is server-only (not prefixed with `NEXT_PUBLIC_`)
- ✅ Backend credentials remain in `.env` (not exposed to frontend)
- ✅ All sensitive keys are properly isolated

## Next Steps

Once credentials are set:
1. Restart the Next.js dev server: `npm run dev`
2. Visit `http://localhost:3001/canvas`
3. Test AI chat functionality
4. Verify agent can create/update canvas cards
