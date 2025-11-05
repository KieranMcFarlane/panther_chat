# 🐆 Yellow Panther AI - Sports Intelligence & Knowledge Graph System

## 📚 **Documentation**

All documentation has been organized in the [`/docs`](./docs/) directory:

- **[📖 Documentation Index](./docs/README.md)** - Complete documentation overview
- **🏆 [Sports Intelligence](./docs/sports-intelligence/)** - Sports entity enrichment and targeting
- **🏗️ [Schemas & Frameworks](./docs/schemas/)** - Database schemas and enrichment frameworks  
- **⚙️ [System Guides](./docs/system-guides/)** - Technical setup and configuration
- **🚀 [Deployment](./docs/deployment/)** - Deployment guides and server configuration
- **🔗 [Integrations](./docs/integrations/)** - API integrations and MCP servers
- **📋 [Projects](./docs/projects/)** - Project overviews and documentation

## 🎯 **Quick Start**

1. **Sports Intelligence**: Start with [Yellow Panther Optimized Targeting Schema](./docs/sports-intelligence/YELLOW_PANTHER_OPTIMIZED_TARGETING_SCHEMA.md)
2. **System Setup**: Begin with [Neo4j Connection Guide](./docs/system-guides/NEO4J_CONNECTION_GUIDE.md)  
3. **Project Overview**: Read [Project Summary](./docs/projects/PROJECT_SUMMARY.md)

---

# Yellow Panther AI - Sales Intelligence System

A powerful Next.js application that combines **Agentic RAG**, **LinkedIn Scraping via BrightData MCP**, and **Neo4j Knowledge Graph** to help Yellow Panther win and maintain mobile app projects for Premier League, Team GB, and Premier Padel.

## 🎯 Purpose

Yellow Panther specializes in building and maintaining mobile apps for sports organizations. This AI system provides:

- **Sales Intelligence**: Identify decision makers at target organizations
- **Relationship Mapping**: Track existing client relationships and project status  
- **Technical Insights**: Leverage RAG system for sports technology trends
- **Opportunity Identification**: Find new business prospects and warm introductions

## 🏗️ Architecture

### Integrated Systems:
1. **Next.js + Vercel AI SDK** - Modern chat interface with streaming responses
2. **Agentic RAG System** - Technical knowledge base (your existing FastAPI system)
3. **Neo4j Knowledge Graph** - Business relationships and project data
4. **BrightData LinkedIn MCP** - Real-time contact discovery
5. **OpenAI GPT-4** - Intelligent tool selection and response generation

### Key Features:
- 🤖 **Intelligent Tool Selection** - AI automatically chooses the right data source
- 🔄 **Real-time Streaming** - Responses stream in real-time with tool visibility
- 🕸️ **Knowledge Graph** - Complex relationship queries about clients and projects
- 🔗 **LinkedIn Integration** - Find decision makers at target companies
- 📚 **RAG Integration** - Technical insights from your existing knowledge base

## 🚀 Quick Start

### Prerequisites

Make sure you have your existing RAG system running:
```bash
# In your agentic-rag-knowledge-graph directory
cd ../ottomator-agents/agentic-rag-knowledge-graph
python3 -m agent.api  # Should be running on http://localhost:8058
```

### Setup

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
The `.env.local` file is already set up with your existing credentials:
- OpenAI API key
- Neo4j connection (localhost:7687)
- PostgreSQL connection (Neon)
- BrightData API key
- RAG API URL (http://localhost:8058)

3. **Seed the Knowledge Graph**
```bash
npm run seed-graph
```

This creates a comprehensive graph with:
- **Yellow Panther** as the central company
- **Premier League, Team GB, Premier Padel** as clients/prospects
- **Key contacts** at each organization with LinkedIn profiles
- **Project data** including current apps and proposals
- **Team members** and their specializations

4. **Start the Development Server**
```bash
npm run dev
```

Visit http://localhost:3000 to access the Yellow Panther AI interface.

## 💬 Example Queries

### Sales Intelligence
```
"Who are the key decision makers at Premier League for mobile apps?"
```
→ Uses LinkedIn search + Knowledge graph to find contacts

### Project Status  
```
"What's the status of our Team GB app project?"
```
→ Queries knowledge graph for project details and team assignments

### Opportunity Discovery
```
"Show me opportunities at Premier League"
```
→ Combines graph data with RAG insights for warm intro paths

### Technical Insights
```
"What sports app trends should we know about for Premier League?"
```
→ Searches RAG system for industry intelligence

### Relationship Mapping
```
"Who at Yellow Panther manages the Premier Padel project?"
```
→ Knowledge graph traversal for internal team structure

## 🛠️ Tool Integration

The AI automatically selects from three powerful tools:

### 1. Knowledge Graph (Neo4j)
- **Purpose**: Business relationships, projects, contacts, opportunities
- **Data**: Yellow Panther team, client relationships, project status
- **Queries**: Who works on what, client contact info, project timelines

### 2. LinkedIn Search (BrightData MCP)
- **Purpose**: Find decision makers at target companies
- **Data**: Real-time LinkedIn profiles and contact information
- **Filters**: Company, job title, location, industry

### 3. RAG System Integration
- **Purpose**: Technical insights and industry knowledge
- **Data**: Your existing knowledge base about sports technology
- **Content**: AI trends, app development insights, market intelligence

## 📊 Knowledge Graph Schema

```
Company (Yellow Panther)
├── PROVIDES_SERVICES_TO → Client (Team GB, Premier Padel)
├── TARGETS → Client (Premier League)
└── EMPLOYS → TeamMember (CEO, CTO, PMs)

Client
├── HAS_CONTACT → Contact (Decision makers)
└── NEEDS → Project (Mobile apps)

Project
├── MANAGED_BY → TeamMember
└── DEVELOPED_FOR → Client

Contact
├── WORKS_AT → Client
└── HAS_LINKEDIN → LinkedIn Profile
```

## 🎯 Business Impact

### For Yellow Panther Leadership:
- **Identify warm intro paths** to Premier League decision makers
- **Track project status** across all active clients
- **Discover expansion opportunities** within existing accounts
- **Leverage technical expertise** to position against competitors

### For Sales Team:
- **Contact intelligence** with LinkedIn profiles and interests
- **Relationship mapping** to find the right person to approach
- **Technical talking points** from RAG system insights
- **Project references** to showcase relevant experience

### For Project Managers:
- **Team allocation** visibility across all projects
- **Client communication** history and preferences  
- **Technical requirements** matching with team expertise
- **Competitive intelligence** for proposals

## 🔧 Development

### Adding New Clients
Update `scripts/seedGraph.js` to add new organizations, contacts, and opportunities.

### CopilotKit Agent Endpoint and Environment
- CopilotKit chat endpoint: `/apps/signal-noise-app/src/app/api/copilotkit/route.ts`
- The endpoint streams via Claude Agent SDK and uses MCP servers.
- Required environment variables (set in your `.env.local`):
  - `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `NEO4J_DATABASE` (optional, defaults to `neo4j`)
  - `AURA_INSTANCEID`, `AURA_INSTANCENAME` (if using Neo4j Aura)
  - `BRIGHTDATA_API_TOKEN`, `BRIGHTDATA_PRO_MODE` (optional, defaults to `true`)
  - Optional CopilotKit Cloud keys if used: `NEXT_PUBLIC_LICENSE_KEY`, `COPILOT_CLOUD_PUBLIC_API_KEY`

### Extending LinkedIn Integration
Replace mock data in `src/lib/linkedin-scraper.ts` with real BrightData MCP calls:

```typescript
// Uncomment and configure the real BrightData integration
export async function searchLinkedInProfilesReal(query, filters) {
  const response = await fetch('https://api.brightdata.com/linkedin/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, filters, limit: 20 }),
  });
  return response.json();
}
```

### RAG System Queries
The system connects to your existing FastAPI RAG endpoint. Ensure it's running and accessible at the configured URL.

## 📈 Next Steps

1. **Real BrightData Integration** - Connect to actual LinkedIn MCP API
2. **CRM Integration** - Sync contacts and opportunities with Salesforce/HubSpot  
3. **Email Templates** - Generate personalized outreach based on graph insights
4. **Calendar Integration** - Schedule follow-ups based on opportunity pipeline
5. **Advanced Analytics** - Track conversion rates and relationship strength

## 🤝 Contributing

This system is designed to grow with Yellow Panther's business. Add new clients, contacts, and opportunities to the knowledge graph as the business expands.

---

**Built with Next.js, Vercel AI SDK, Neo4j, and your existing Agentic RAG system** 🚀 