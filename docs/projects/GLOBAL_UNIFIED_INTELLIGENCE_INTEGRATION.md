# Global Unified Sports Intelligence System

## Overview

The Global Unified Sports Intelligence System integrates `crawl4ai-rag` technical analysis capabilities and `prem-intel-graph` business intelligence into the existing global Neo4j knowledge graph seeded with comprehensive sports world data from `sportsWorldSeed.json`.

## Architecture

```
🌍 Global Sports Intelligence System
├── 🧠 Global Neo4j Knowledge Graph (seeded with sportsWorldSeed.json)
│   ├── 📊 Sports Organizations (1000+ from Tier 1-3)
│   ├── 🏆 Premier League Enhanced Object
│   ├── 🏢 Agencies & Stakeholders
│   └── 📈 Business Intelligence Signals
├── 🤖 Enhanced Crawl4AI RAG Service
│   ├── 🔍 Technical Analysis
│   ├── 🧩 AI Hallucination Detection
│   └── 📊 Code Quality Assessment
├── 🏆 Premier League Intelligence Service
│   ├── 📊 Club Intelligence
│   ├── 🤝 Agency Relationships
│   └── 💡 Partnership Opportunities
└── 🔧 Unified MCP Server
    ├── 🌐 Global Intelligence Queries
    ├── 📈 Signal Generation
    └── 🎯 Opportunity Discovery
```

## Key Features

### 🌍 Global Knowledge Graph Integration
- **Sports World Data**: Comprehensive database of 1000+ sports organizations across 3 tiers
- **Premier League Enhancement**: Extended Premier League object with business intelligence capabilities
- **Cross-domain Insights**: Technical findings automatically generate business intelligence signals
- **Unified Schema**: Merged technical analysis and business intelligence entities

### 🤖 Technical Analysis Integration
- **Repository Analysis**: Analyze code repositories in the context of sports organizations
- **AI Hallucination Detection**: Identify potential AI-generated code issues
- **Complexity Assessment**: Evaluate technical debt and code quality
- **Technology Stack Analysis**: Identify modern development practices

### 🏆 Business Intelligence Enhancement
- **Agency Relationships**: Track partnerships between sports organizations and agencies
- **Digital Maturity Assessment**: Evaluate organizations' digital capabilities
- **Partnership Opportunities**: Identify potential new business relationships
- **Stakeholder Intelligence**: Monitor key decision-makers and their movements

### 🔧 Unified MCP Server
- **Global Queries**: Query across all sports organizations and intelligence
- **Signal Generation**: Create and ingest business intelligence signals
- **Opportunity Discovery**: Find partnership opportunities across the ecosystem
- **Cross-domain Analysis**: Combine technical and business insights

## Quick Start

### 1. Setup and Installation

```bash
# Clone the repository and navigate to the project directory
cd /path/to/panther_chat

# Make the setup script executable
chmod +x setup_global_unified_system.sh

# Run the setup (this will take 5-10 minutes)
./setup_global_unified_system.sh
```

### 2. Access the System

Once setup is complete, access the system through:

- **System Dashboard**: http://localhost:8080
- **Neo4j Browser**: http://localhost:7474 (neo4j/pantherpassword)
- **Enhanced Crawl4AI**: http://localhost:8001
- **Premier League Intel**: http://localhost:8002  
- **Unified MCP Server**: http://localhost:8003

### 3. System Management

```bash
# Start the system
./manage_system.sh start

# View system status
./manage_system.sh status

# View logs
./manage_system.sh logs neo4j

# Stop the system
./manage_system.sh stop

# Re-seed the knowledge graph
./manage_system.sh seed
```

## Usage Examples

### Analyze Repository for Sports Organization

```python
# Using the Global Unified Knowledge Graph
from global_unified_knowledge_graph import GlobalUnifiedKnowledgeGraph

global_kg = GlobalUnifiedKnowledgeGraph(neo4j_uri, neo4j_user, neo4j_password)
await global_kg.initialize()

# Analyze a repository in context of Premier League
results = await global_kg.analyze_repository_for_sports_org(
    repo_url="https://github.com/example/football-app",
    organization_name="Premier League",
    analysis_context={
        "focus_areas": ["fan_engagement", "digital_transformation"]
    }
)

print(f"Technical Analysis: {results['technical_analysis']}")
print(f"Business Intelligence: {results['business_intelligence']}")
print(f"Signals Generated: {len(results['signals_generated'])}")
print(f"Recommendations: {results['recommendations']}")
```

### Query Global Sports Intelligence

```python
# Get Premier League intelligence overview
premier_league_intel = await global_kg.query_global_intelligence(
    "premier_league_intelligence"
)

# Discover partnership opportunities
opportunities = await global_kg.query_global_intelligence(
    "top_opportunities"
)

# Get technical debt alerts across all organizations
alerts = await global_kg.query_global_intelligence(
    "technical_debt_alerts"
)
```

### Generate Business Intelligence Signals

```python
# Create a signal about digital transformation
signal = EnhancedSignalItem(
    organization="Arsenal",
    signal_type="Digital Transformation",
    signal_headline="Arsenal launches new fan engagement platform",
    signal_summary="Club invests in AI-powered fan experience technology",
    score=8.5,
    opportunity_type="Partnership Ready"
)

await global_kg.ingest_enhanced_signal(signal)
```

### Using the MCP Server

The Unified MCP Server provides tools for AI agents to interact with the system:

```json
{
  "tool": "analyze_repository_for_sports_organization",
  "arguments": {
    "repository_url": "https://github.com/example/repo",
    "organization_name": "Premier League",
    "analysis_context": {
      "focus_areas": ["technical_debt", "ai_integration"]
    }
  }
}
```

```json
{
  "tool": "discover_partnership_opportunities",
  "arguments": {
    "tier_filter": [1, 2],
    "digital_maturity_filter": ["High", "Very High"],
    "signal_types": ["Partnership Opportunity", "Digital Transformation"]
  }
}
```

## Data Schema

### Enhanced Premier League Object

The Premier League organization in the global knowledge graph is enhanced with:

```cypher
// Premier League Enhanced Properties
(pl:SportingOrganization {
  name: "Premier League",
  enhanced: true,
  intelligence_system: "Active",
  business_intelligence_enabled: true,
  technical_analysis_enabled: true,
  digital_maturity_assessment: "High"
})

// Related Entities
(pl)-[:has_agency_relationship]->(agency:Agency)
(pl)-[:contains_club]->(club:PremierLeagueClub)
(pl)-[:emits]->(signal:Signal)
```

### Business Intelligence Schema

```cypher
// Agencies
(agency:Agency {
  name: string,
  specialty: string,
  past_work: string,
  tier: string
})

// Premier League Clubs
(club:PremierLeagueClub {
  name: string,
  tier: string,
  location: string,
  digital_maturity: string,
  intelligence_status: "Active"
})

// Business Intelligence Signals
(signal:Signal {
  headline: string,
  summary: string,
  score: float,
  intelType: string,
  organization: string,
  opportunity_type: string,
  digital_maturity_impact: string
})
```

### Technical Analysis Schema

```cypher
// Repositories
(repo:Repository {
  name: string,
  url: string,
  description: string,
  language: string,
  created_at: datetime
})

// Technical Analysis Results
(signal:Signal {
  repository: string,
  hallucinations_count: int,
  confidence_score: float,
  code_quality_score: float
})
```

## Signal Types

The system generates various types of intelligence signals:

- **Code Analysis**: Technical repository analysis results
- **Technical Debt**: Code quality and complexity issues
- **AI Hallucination**: Potential AI-generated code problems
- **Digital Transformation**: Organization digital capability signals
- **Tech Investment**: Technology adoption and innovation signals
- **Partnership Opportunity**: Potential new business relationships
- **Stakeholder Movement**: Key personnel changes and movements
- **Innovation Signal**: Technology innovation and advancement indicators

## Cross-domain Intelligence

The system automatically generates business intelligence from technical analysis:

### Technical → Business Signal Generation

1. **High Code Complexity** → **Technical Debt Signal** → **Partnership Opportunity**
2. **AI-related Code Detection** → **Tech Investment Signal** → **Innovation Partnership**
3. **Modern Tech Stack** → **Digital Maturity Assessment** → **Strategic Partnership**
4. **Code Quality Issues** → **Technical Consulting Opportunity**

### Business Context Enhancement

Technical analysis is enhanced with business context:

- **Organization Digital Maturity**: Influences technical analysis interpretation
- **Existing Partnerships**: Affects opportunity scoring
- **Recent Signals**: Provides trend analysis
- **Stakeholder Relevance**: Identifies key decision-makers

## Configuration

### Environment Variables

```bash
# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword

# AI API Keys
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here

# System Features
ENABLE_TECHNICAL_ANALYSIS=true
ENABLE_BUSINESS_INTELLIGENCE=true
ENABLE_PREMIER_LEAGUE_INTELLIGENCE=true
```

### Docker Services

- **global-neo4j**: Global sports knowledge graph database
- **kg-seeder**: Unified knowledge graph seeding service
- **enhanced-crawl4ai-rag**: Technical analysis with global KG integration
- **prem-intel-service**: Premier League business intelligence
- **unified-mcp-server**: Unified MCP server for AI integration
- **health-monitor**: System health monitoring and dashboard

## API Endpoints

### Enhanced Crawl4AI RAG Service (Port 8001)
- `GET /health` - Service health check
- `POST /analyze` - Repository analysis with sports context

### Premier League Intelligence Service (Port 8002)
- `GET /health` - Service health check
- `GET /clubs` - Premier League clubs intelligence
- `GET /opportunities` - Partnership opportunities

### Unified MCP Server (Port 8003)
- MCP protocol for AI agent integration
- Tools for global intelligence queries
- Signal generation and opportunity discovery

## Monitoring and Management

### System Health Dashboard

Access the system dashboard at http://localhost:8080 to monitor:

- Service status and health
- Neo4j knowledge graph status
- Recent signal activity
- System capabilities overview

### Log Management

```bash
# View all logs
./manage_system.sh logs

# View specific service logs
./manage_system.sh logs neo4j
./manage_system.sh logs enhanced-crawl4ai-rag
./manage_system.sh logs prem-intel-service
```

### Knowledge Graph Management

```bash
# Re-seed the knowledge graph
./manage_system.sh seed

# Access Neo4j browser for direct queries
open http://localhost:7474
```

## Troubleshooting

### Common Issues

1. **Services not starting**: Check Docker resources and ports
2. **Neo4j connection issues**: Verify Neo4j is healthy before starting other services
3. **Knowledge graph not seeded**: Run `./manage_system.sh seed` to re-seed
4. **API keys not configured**: Update `.env.global` with valid API keys

### Debugging

```bash
# Check service status
./manage_system.sh status

# View service logs
./manage_system.sh logs [service-name]

# Restart specific service
docker-compose -f docker-compose.unified.yml restart [service-name]
```

## Development

### Adding New Signal Types

1. Update the schema extensions in `global_unified_knowledge_graph.py`
2. Add the signal type to the MCP server enum
3. Implement signal generation logic
4. Update documentation

### Extending Organization Support

1. Add organization data to `sportsWorldSeed.json`
2. Update seeding scripts to handle new organization types
3. Implement organization-specific analysis logic
4. Test with new organization queries

## Future Enhancements

- **Real-time Signal Streaming**: Live signal ingestion and processing
- **Advanced Analytics**: Machine learning for signal scoring and prediction
- **Multi-language Support**: Extend technical analysis to more programming languages
- **Mobile Interface**: Mobile-friendly dashboard and monitoring
- **API Rate Limiting**: Implement rate limiting for production deployment
- **Data Export**: Tools for exporting intelligence data and reports

## Support

For issues, questions, or contributions:

1. Check the system logs for error details
2. Review the troubleshooting section
3. Ensure all prerequisites are installed
4. Verify environment configuration

The Global Unified Sports Intelligence System provides a comprehensive platform for combining technical analysis with business intelligence across the global sports ecosystem, with enhanced capabilities for Premier League intelligence and partnership opportunity discovery. 