# Claude Agent SDK ↔ FastAPI ↔ CopilotKit Integration

A minimal working loop that integrates Claude Agent SDK with CopilotKit chat panel using FastAPI as a webhook intermediary.

## Architecture

```
CopilotKit Chat Panel ↔ Next.js Frontend ↔ FastAPI Webhook ↔ Claude Agent SDK ↔ MCP Tools
```

### Components

1. **FastAPI Webhook Server** (`claude-webhook-server.py`)
   - Handles CopilotKit requests via webhook
   - Integrates with Claude Agent SDK
   - Supports streaming responses
   - Manages MCP server configuration

2. **Next.js Frontend** (existing app)
   - CopilotKit chat interface
   - Modified API route to forward requests to FastAPI
   - Streaming response handling

3. **Claude Agent SDK** (Python)
   - Processes chat messages
   - Manages MCP tool connections
   - Handles session continuity

## Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- Custom API credentials (provided) OR Anthropic API key

### 1. Environment Setup

Create a `.env` file based on `.env.example`:

**Option A: Custom API Configuration (Default)**
```bash
# Custom API Configuration for Claude Agent SDK
ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic
ANTHROPIC_AUTH_TOKEN=c4b860075e254d219887557d13477116.e8Gtsb5sXuDggh2c

# Neo4j Configuration (for MCP tools)
NEO4J_URI=neo4j+s://demo.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=neo4j
```

**Option B: Standard Anthropic API**
```bash
# Standard Anthropic API
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# Neo4j Configuration (for MCP tools)
NEO4J_URI=neo4j+s://demo.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-neo4j-password
NEO4J_DATABASE=neo4j
```

### 2. Install Dependencies

```bash
# Python dependencies
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements-webhook.txt

# Node.js dependencies
npm install
```

### 3. Start the Integration

**Option 1: Use the startup script (recommended)**
```bash
./start-claude-integration.sh
```

**Option 2: Manual startup**
```bash
# Terminal 1: Start FastAPI webhook server
python claude-webhook-server.py

# Terminal 2: Start Next.js application
npm run dev
```

### 4. Test the Integration

```bash
# Test both servers are running
python test-claude-integration.py
```

Then open http://localhost:3005 and:
1. Click the chat button (bottom-right corner)
2. Try asking: "Find Premier League clubs"
3. Try asking: "Execute a Neo4j query"
4. Try asking: "Search for sports business opportunities"

## File Structure

```
├── claude-webhook-server.py      # FastAPI webhook server
├── requirements-webhook.txt      # Python dependencies
├── start-claude-integration.sh   # Startup script
├── test-claude-integration.py    # Test script
├── .mcp.json                    # MCP configuration (from existing)
└── src/
    ├── app/api/copilotkit/
    │   └── route.ts              # Modified CopilotKit route
    ├── app/layout.tsx            # Added CopilotKit provider
    └── components/
        ├── chat/
        │   └── SimpleChatSidebar.tsx  # Updated to use CopilotKit
        └── copilotkit/
            └── ClaudeCopilotSidebar.tsx
```

## Key Features

### Streaming Responses
- Real-time streaming from Claude Agent SDK to CopilotKit
- Status updates (thinking, connected, completed)
- Tool usage notifications

### Session Management
- Continuous conversations with session persistence
- User-specific session tracking

### MCP Integration
- Neo4j database queries
- Web search and scraping
- Memory/knowledge retrieval
- File system operations

### Error Handling
- Graceful error handling and user feedback
- Connection recovery
- CORS support

## Configuration

### API Configuration

The integration supports both custom API configuration and standard Anthropic API:

**Custom API (Default):**
- Uses `ANTHROPIC_BASE_URL` and `ANTHROPIC_AUTH_TOKEN`
- Automatically configured in startup scripts
- Bypasses standard Anthropic API routing

**Standard Anthropic API:**
- Uses `ANTHROPIC_API_KEY`
- Falls back if custom configuration is not available

### MCP Configuration
Edit `.mcp.json` to configure available MCP servers:

```json
{
  "mcpServers": {
    "neo4j": {
      "command": "node",
      "args": ["neo4j-mcp-server.js"],
      "env": {
        "NEO4J_URI": "neo4j+s://demo.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "your-password"
      }
    }
  }
}
```

### FastAPI Server Configuration
- Default port: 8001
- CORS enabled for localhost:3005
- Health check endpoint: `/health`

### CopilotKit Configuration
- Runtime URL: `/api/copilotkit`
- Custom labels and instructions
- Context passing for user sessions

## Troubleshooting

### Common Issues

1. **Port conflicts**
   - Make sure ports 8001 and 3005 are available
   - Check with `lsof -i :8001` and `lsof -i :3005`

2. **API key issues**
   - Verify ANTHROPIC_API_KEY is set
   - Check the key is valid and has credits

3. **MCP server issues**
   - Verify `.mcp.json` exists and is valid
   - Check MCP server commands and paths

4. **CORS issues**
   - Ensure frontend is running on localhost:3005
   - Check CORS configuration in FastAPI server

### Debug Commands

```bash
# Check FastAPI server
curl http://localhost:8001/health

# Check webhook endpoint
curl -X POST http://localhost:8001/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# Check Next.js app
curl http://localhost:3005

# Check CopilotKit route
curl -X POST http://localhost:3005/api/copilotkit \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

## Development

### Modifying the Integration

1. **FastAPI server**: Edit `claude-webhook-server.py`
2. **CopilotKit route**: Edit `src/app/api/copilotkit/route.ts`
3. **Frontend components**: Edit files in `src/components/copilotkit/`

### Adding New Features

1. **New MCP tools**: Add to `.mcp.json` and update agent prompt
2. **Custom context**: Modify context passing in CopilotKit components
3. **Additional endpoints**: Add new routes to FastAPI server

## Production Deployment

For production deployment:

1. **Environment variables**: Use proper environment variable management
2. **HTTPS**: Configure SSL certificates
3. **Scaling**: Consider using WebSocket connections for better streaming
4. **Security**: Add authentication and authorization
5. **Monitoring**: Add logging and health checks

## License

This integration follows the same license as the parent project.