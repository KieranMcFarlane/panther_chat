# 🐆 Yellow Panther AI - Open WebUI Integration with Progress Streaming

Complete setup guide for integrating Yellow Panther's RAG intelligence system with **Open WebUI** featuring **real-time progress streaming** for crawling and knowledge graph operations.

## 🆕 NEW: Real-Time Progress Streaming

Yellow Panther now shows **live progress** for long-running operations while keeping conversation flowing:

- 🕸️ **Crawling Progress**: Step-by-step crawling status with completion indicators
- 🧠 **Knowledge Graph Queries**: Real-time graph traversal and relationship mapping
- 🔗 **LinkedIn Research**: Progressive contact discovery with enrichment status
- 📊 **Intelligence Gathering**: Live updates for Premier League club research

All operations stream progress in the **dropdown** while allowing you to continue chatting!

## 🏗️ System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Open WebUI    │◄──►│ RAG Proxy Server │◄──►│ Yellow Panther  │
│                 │    │  (Port 8331)     │    │  Next.js App    │
│ - Model Dropdown│    │                  │    │  (Port 3001)    │
│ - Progress View │    │ Progress Stream  │    │                 │
│ - Chat Interface│    │ Agent Selection  │    │ Advanced Tools  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                ▲
                                │
                       ┌──────────────────┐
                       │ Ollama / OpenAI  │
                       │ Underlying LLMs  │
                       │  (Port 11434)    │
                       └──────────────────┘
```

## 🚀 Quick Setup

### 1. Start Yellow Panther Backend
```bash
cd yellow-panther-ai
PORT=3001 npm run dev  # Starts on port 3001
```

### 2. Start Ollama (for local models)
```bash
ollama serve  # Starts on port 11434
ollama pull llama3.1  # Optional: Pull specific models
```

### 3. Start Progress-Aware RAG Proxy
```bash
cd yellow-panther-ai
OPENWEBUI_PROXY_PORT=8331 python openwebui-rag-proxy-dynamic.py  # Starts on port 8331
```

### 4. Configure Open WebUI
1. Open Open WebUI in your browser
2. Go to **Settings** → **Connections** 
3. Add custom model provider:
   - **API Base URL**: `http://localhost:8331/v1`
   - **API Key**: `anything` (not validated)
   - **Model Type**: `OpenAI`

## 🎯 Available Models with Progress

Select from **4 specialized RAG agents** × **Multiple LLM models**:

### 🐆 Yellow Panther RAG + Model Options
- **🐆 Yellow Panther RAG + ⚡ o3-mini** (Premier League intelligence with cutting-edge reasoning)
- **🐆 Yellow Panther RAG + 🧠 GPT-4o** (Comprehensive intelligence with advanced capabilities)
- **🐆 Yellow Panther RAG + 🦙 Llama 3.1** (Local processing with privacy)

### ⚽ Premier League Intelligence + Model Options
- **⚽ Premier League Intelligence + ⚡ o3-mini** (Club analysis with progress tracking)
- **⚽ Premier League Intelligence + 🦙 Llama 3** (Local Premier League expertise)

### 🔗 LinkedIn Network Analyzer + Model Options
- **🔗 LinkedIn Network Analyzer + 🧠 GPT-4o** (Professional network mapping with live updates)
- **🔗 LinkedIn Network Analyzer + 🌪️ Mistral** (Efficient contact discovery)

### 🕸️ Sports Knowledge Graph + Model Options
- **🕸️ Sports Knowledge Graph + 🔮 Qwen 2.5** (Advanced graph queries with visualization)
- **🕸️ Sports Knowledge Graph + 💻 Code Llama** (Technical relationship analysis)

## 📊 Progress Streaming Features

### Crawling Operations
When you ask to crawl a website, you'll see:
```
🚀 Initializing Yellow Panther AI...

🕸️ Crawling Operation Detected
📋 Preparing crawling infrastructure...
🔧 Configuring browser sessions...
🎯 Targeting specified URLs...
📊 Analyzing page structure...
📝 Extracting content...
🧠 Processing with AI...
💾 Storing in knowledge base...

✅ Crawling Complete! All data has been processed and stored.

📊 Results Summary:
- URL: https://example.com
- Status: ✅ Success
- Pages Crawled: 25
- Chunks Stored: 150
...
```

### Knowledge Graph Queries
For knowledge graph operations:
```
🕸️ Knowledge Graph Query Detected
🔗 Connecting to Neo4j database...
📊 Analyzing relationship patterns...
🧠 Processing graph traversals...
📋 Formatting results...

✅ Knowledge Graph Query Complete! All relationships analyzed.
```

### LinkedIn Research
LinkedIn searches show:
```
🔗 Initializing LinkedIn search...
🎯 Searching for: Arsenal decision makers
🏢 Filtering by company: Arsenal
👥 Analyzing profiles...
🕸️ Enriching knowledge graph...
🔗 Mapping relationships...

✅ LinkedIn Search Complete!
👥 Found: 15 profiles
...
```

## 🎮 Example Use Cases

### 1. Real-Time Website Crawling
```
User: "Crawl Arsenal's website for intelligence gathering"

Response: 
🚀 Initializing Yellow Panther AI...
🕸️ Crawling Operation Detected
📋 Preparing crawling infrastructure...
[Live progress updates...]
✅ Crawling Complete!
📊 Results: 15 pages crawled, 87 chunks stored
🎉 Arsenal's website intelligence is now in your knowledge base!
```

### 2. Progressive Knowledge Graph Analysis
```
User: "Show me all teams and relationships in the knowledge graph"

Response:
🕸️ Knowledge Graph Query Detected
🔗 Connecting to Neo4j database...
[Live progress updates...]
✅ Knowledge Graph Query Complete!
[Detailed relationship data...]
```

### 3. Live Premier League Intelligence
```
User: "Research Arsenal for mobile app opportunities"

Response:
🏆 Premier League Club Intelligence Initiated
🎯 Target Club: Arsenal
[Live progress for each search level...]
✅ Intelligence Gathering Complete!
📊 Arsenal Intelligence Summary:
- Contacts Found: 23
- Key Decision Makers: 8
- Digital Maturity: Digital innovation focus
```

## 🔧 Configuration Options

### Environment Variables
```bash
# RAG Backend
RAG_BACKEND_URL=http://localhost:3001

# Ollama
OLLAMA_BASE_URL=http://localhost:11434

# Proxy Server
OPENWEBUI_PROXY_PORT=8331
```

### Progress Customization
The proxy automatically detects operation types and shows appropriate progress:
- **Crawl keywords**: crawl, scrape, website, linkedin, site
- **Knowledge graph keywords**: knowledge graph, neo4j, relationships, teams, graph
- **Progress timing**: Configurable delays for optimal UX

## 🎯 Advanced Features

### 1. Operation Status Tracking
Monitor active operations:
```bash
curl http://localhost:8001/v1/operations
```

### 2. Multiple Concurrent Operations
Progress streaming supports multiple simultaneous operations with unique tracking IDs.

### 3. Conversation Flow Protection
Operations run in background while maintaining chat responsiveness.

### 4. Dynamic Model Switching
Change models mid-conversation without losing context.

## 🐛 Troubleshooting

### Progress Not Showing
1. Ensure you're using **streaming mode** in Open WebUI
2. Check that the proxy server is running on port 8001
3. Verify WebSocket connections are allowed

### Model Not Available
1. Check if Ollama is running: `ollama serve`
2. Pull required models: `ollama pull llama3.1`
3. Restart the proxy server

### Backend Connection Issues
1. Verify Next.js app is running: `http://localhost:3000`
2. Check environment variables
3. Review proxy logs for connection errors

## 📈 Performance Monitoring

### Operation Metrics
- **Crawling**: 30-60 seconds for standard websites
- **Knowledge Graph**: 5-15 seconds for complex queries
- **LinkedIn Research**: 10-30 seconds per contact level
- **Progress Updates**: Real-time with 300ms intervals

### Resource Usage
- **Memory**: ~2GB for full system
- **CPU**: Moderate during operations
- **Network**: Bandwidth dependent on crawling scope

## 🎉 Success Indicators

When everything is working correctly:
- ✅ Models show up in Open WebUI dropdown
- ✅ Progress streams appear in chat during operations
- ✅ Operations complete with summary statistics
- ✅ Knowledge graph enrichment happens automatically
- ✅ Conversation continues smoothly during operations

## 🔮 Next Steps

1. **Try the Arsenal Research**: `"Research Arsenal for mobile app opportunities"`
2. **Crawl a Website**: `"Crawl https://premierleague.com for intelligence"`
3. **Query Relationships**: `"Show me all teams in the knowledge graph"`
4. **LinkedIn Discovery**: `"Find Arsenal decision makers on LinkedIn"`

The system will show **live progress** for all operations while keeping your conversation flowing naturally!

---

**🐆 Yellow Panther AI** - Bringing real-time intelligence with conversation flow protection to Open WebUI! 