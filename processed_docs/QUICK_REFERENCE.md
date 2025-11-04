# 🐆 Quick Reference: Bright Data to Knowledge Graph

## **🚀 Quick Start**

### **1. Start Services**
```bash
# Start Bright Data MCP Server
cd yellow-panther-ai/mcp-servers
node brightdata-simple-server.js

# Start Yellow Panther (in another terminal)
cd yellow-panther-ai
npm run dev -- -p 3432
```

### **2. Use Admin Panel**
Visit: [http://localhost:3432/admin](http://localhost:3432/admin)
- Click "Live LinkedIn Scraping" for real-time data
- Click "AI LinkedIn Analysis" for profile search
- Click "Update Knowledge Graph" to save to Neo4j

### **3. Run Automated Script**
```bash
cd yellow-panther-ai
node scripts/brightdata-to-knowledge-graph.js
```

---

## **🔧 Key API Endpoints**

### **Bright Data MCP (Port 8012)**
```bash
# Health check
curl http://localhost:8012/health

# Search profiles
curl -X POST http://localhost:8012/tools/search_linkedin_profiles \
  -H "Content-Type: application/json" \
  -d '{"query":"Cricket West Indies","company":"Cricket West Indies","limit":5}'
```

### **Yellow Panther Admin (Port 3432)**
```bash
# Live scraping
curl -X POST http://localhost:3432/api/admin/neo4j \
  -H "Content-Type: application/json" \
  -d '{"action":"scrape_linkedin_live"}'

# Update knowledge graph
curl -X POST http://localhost:3432/api/admin/neo4j \
  -H "Content-Type: application/json" \
  -d '{"action":"update_knowledge_graph"}'
```

---

## **🎯 Common Use Cases**

### **Find Decision Makers**
```bash
curl -X POST http://localhost:8012/tools/search_linkedin_profiles \
  -d '{"query":"digital transformation","job_title":"CEO","company":"Cricket West Indies"}'
```

### **Generate Market Signals**
```bash
curl -X POST http://localhost:3432/api/admin/neo4j \
  -d '{"action":"scrape_linkedin_live"}'
```

### **Update Knowledge Graph**
```bash
curl -X POST http://localhost:3432/api/admin/neo4j \
  -d '{"action":"update_knowledge_graph"}'
```

---

## **📊 Expected Results**

### **Market Signals**
- **High Priority**: CEO, Director, CTO roles
- **Medium Priority**: Technology leaders
- **Low Priority**: General staff

### **Knowledge Graph**
- **Contact Nodes**: LinkedIn profiles
- **Company Nodes**: Sports organizations
- **Relationship Edges**: Professional connections

---

## **🚨 Troubleshooting**

### **Check Services**
```bash
# Bright Data MCP
curl http://localhost:8012/health

# Yellow Panther
curl http://localhost:3432/api/admin/neo4j \
  -d '{"action":"scrape_linkedin_live"}'
```

### **Common Issues**
- **Port 8012**: Bright Data MCP server not running
- **Port 3432**: Yellow Panther app not running
- **Neo4j**: Using mock data if real instance unavailable

---

## **📚 Full Documentation**
- **Complete Guide**: `BRIGHTDATA_KNOWLEDGE_GRAPH_GUIDE.md`
- **Integration Script**: `scripts/brightdata-to-knowledge-graph.js`
- **Admin Panel**: [http://localhost:3432/admin](http://localhost:3432/admin)

---

**🐆 Yellow Panther AI - Sports Intelligence Platform** ⚡ 