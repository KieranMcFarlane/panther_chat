# MCP Server Setup Guide

## 🎯 **Real MCP Integration Complete**

You now have a **fully working MCP server bus** with real integration to Neo4j, BrightData, and Perplexity MCP servers.

## 🚀 **Quick Start**

### **1. Install Dependencies**
```bash
cd mcp-servers
npm install
```

### **2. Start All MCP Servers**
```bash
./start-mcp-servers.sh
```

### **3. Test Integration**
```bash
curl -X POST http://localhost:3005/api/mcp-autonomous/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "all"}'
```

## 🏗️ **Architecture Overview**

```
[React Dashboard] 
    ↓ HTTP/WebSocket
[Next.js API Routes] 
    ↓ MCP Client Bus
[Neo4j MCP Server]    [BrightData MCP Server]    [Perplexity MCP Server]
        ↓                         ↓                             ↓
[Neo4j Database]      [BrightData API]           [Perplexity API]
```

## 📁 **File Structure**

```
mcp-servers/
├── package.json                          # MCP server dependencies
├── src/mcp-servers/
│   ├── neo4j-server.js                  # Neo4j MCP server
│   ├── brightdata-server.js             # BrightData MCP server
│   └── perplexity-server.js             # Perplexity MCP server
├── start-mcp-servers.sh                 # Startup script
├── stop-mcp-servers.sh                  # Stop script
└── logs/                                # Server logs

src/lib/mcp/
└── MCPClientBus.ts                      # MCP client bus manager

src/app/api/mcp-autonomous/
├── test/route.ts                        # Real MCP testing endpoint
├── start/route.ts                       # Autonomous system control
├── stop/route.ts                        # System stop endpoint
└── stream/route.ts                      # Real-time log streaming

src/app/mcp-autonomous/page.tsx          # Dashboard UI
```

## 🔧 **Available MCP Tools**

### **Neo4j MCP Server**
- `neo4j_query_entities` - Execute Cypher queries
- `neo4j_get_entity_relationships` - Get entity relationships
- `neo4j_search_entities` - Search entities by name/type
- `neo4j_get_entity_path` - Find paths between entities

### **BrightData MCP Server**
- `brightdata_search_google` - Google search with SERP API
- `brightdata_search_linkedin` - LinkedIn company/people search
- `brightdata_scrape_webpage` - Web page content extraction
- `brightdata_monitor_linkedin_posts` - LinkedIn post monitoring

### **Perplexity MCP Server**
- `perplexity_search` - AI-powered search with sources
- `perplexity_market_analysis` - Sports entity market analysis
- `perplexity_trend_analysis` - Industry trend analysis
- `perplexity_rfp_intelligence` - RFP opportunity assessment

## 🧪 **Testing Your MCP Setup**

### **Test Individual Tools**
```bash
# Test Neo4j
curl -X POST http://localhost:3005/api/mcp-autonomous/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "neo4j"}'

# Test BrightData  
curl -X POST http://localhost:3005/api/mcp-autonomous/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "brightdata"}'

# Test Perplexity
curl -X POST http://localhost:3005/api/mcp-autonomous/test \
  -H "Content-Type: application/json" \
  -d '{"testType": "perplexity"}'
```

### **Check Server Status**
```bash
# View running processes
ps aux | grep "mcp-servers"

# Check logs
tail -f mcp-servers/logs/neo4j-mcp.log
tail -f mcp-servers/logs/brightdata-mcp.log
tail -f mcp-servers/logs/perplexity-mcp.log
```

## 🎮 **Using the Dashboard**

1. **Navigate to**: `http://localhost:3005/mcp-autonomous`
2. **Click "Test MCP Tools"** - See real tool responses
3. **Click "Start MCP System"** - Run autonomous processing
4. **Watch live logs** - Real-time MCP tool execution

## 🔍 **What You'll See**

### **Successful Test Results:**
```
🧪 Starting Real MCP Tools Integration Test
🔍 Testing Neo4j MCP Tool...
✅ Neo4j MCP Test Successful: 1250 entities found
🔍 Testing BrightData MCP Tool...  
✅ BrightData MCP Test Successful: Search completed
🔍 Testing Perplexity MCP Tool...
✅ Perplexity MCP Test Successful: AI analysis completed
```

### **Live Processing Logs:**
```
🔍 Processing entity batch... (5 entities)
✅ Neo4j MCP: Found 12 relationships
✅ BrightData MCP: 8 market signals found
✅ Perplexity MCP: Market analysis completed
🎯 RFP Opportunity Detected: Digital Transformation
📊 Batch completed - JSON saved
```

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **MCP Servers Won't Start**
   ```bash
   # Check logs
   cat mcp-servers/logs/neo4j-mcp.log
   
   # Verify dependencies
   cd mcp-servers && npm install
   ```

2. **Connection Errors**
   ```bash
   # Check if servers are running
   ps aux | grep "mcp-servers"
   
   # Restart servers
   ./mcp-servers/stop-mcp-servers.sh
   ./mcp-servers/start-mcp-servers.sh
   ```

3. **API Response Errors**
   - Check environment variables in `.env.local`
   - Verify Neo4j credentials
   - Confirm BrightData API token
   - Validate Perplexity API key

### **Environment Variables Required:**
```bash
# .env.local
NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password

BRIGHTDATA_API_TOKEN=your-brightdata-token
BRIGHTDATA_API_URL=https://api.brightdata.com

PERPLEXITY_API_KEY=your-perplexity-key
```

## 🎯 **Production Deployment**

### **Systemd Service Setup:**
```bash
# Create service file
sudo nano /etc/systemd/system/mcp-servers.service

# Copy the service configuration (see below)
sudo systemctl daemon-reload
sudo systemctl enable mcp-servers
sudo systemctl start mcp-servers
```

### **Service Configuration:**
```ini
[Unit]
Description=Yellow Panther MCP Servers
After=network.target

[Service]
Type=forking
User=www-data
WorkingDirectory=/path/to/signal-noise-app/mcp-servers
ExecStart=/path/to/signal-noise-app/mcp-servers/start-mcp-servers.sh
ExecStop=/path/to/signal-noise-app/mcp-servers/stop-mcp-servers.sh
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## ✅ **Success Indicators**

You'll know your MCP integration is working when:

- ✅ **All 3 MCP servers start** without errors
- ✅ **Test API calls return** real data from your services
- ✅ **Dashboard shows green status** for all MCP tools
- ✅ **Live logs show real tool execution** with response times
- ✅ **JSON files are created** with actual analysis results

## 🎉 **You Now Have:**

- ✅ **Real MCP server bus** with direct tool integration
- ✅ **Neo4j knowledge graph** connectivity and querying
- ✅ **BrightData web research** and LinkedIn monitoring  
- ✅ **Perplexity AI-powered** market intelligence
- ✅ **Autonomous RFP processing** with real data sources
- ✅ **Live dashboard** with real-time monitoring
- ✅ **Production-ready** MCP infrastructure

**Your MCP-enabled autonomous RFP system is now fully operational with real integration!**