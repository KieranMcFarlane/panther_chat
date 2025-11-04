# 🚀 NeoConverse Auto-Configuration Guide

## 🎯 Overview
This guide provides step-by-step instructions for auto-configuring NeoConverse with your Yellow Panther AI system, including Neo4j integration and enhanced query capabilities.

## ⚡ Quick Start
Run the auto-configuration script to set up everything automatically:
```bash
./setup-neoconverse.sh
```

## 🔧 Auto-Configuration Details

### Environment Variables Set
```env
# LLM Configuration (OpenAI)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
DEFAULT_PROVIDER=OpenAI
DEFAULT_MODEL=gpt-4-turbo-preview

# Neo4j Backend Configuration
NEXT_PUBLIC_BACKEND_HOST=bolt://localhost:7687
NEXT_PUBLIC_BACKEND_UNAME=neo4j
NEXT_PUBLIC_BACKEND_PWD=pantherpassword
NEXT_PUBLIC_BACKEND_DATABASE=neo4j
```

### Enhanced Agent Queries
1. **Sports Organizations Analysis** - Find and analyze sports organizations
2. **Intelligence Connections** - Find connections between intelligence sources
3. **Federation Analysis** - Analyze sports federations and relationships
4. **Club Relationship Analysis** - Analyze club and stakeholder relationships
5. **Premier League Data** - Get comprehensive Premier League insights
6. **Data Model Exploration** - Explore the overall data schema

## 🛠️ Management Commands

### Available Commands
```bash
# Start NeoConverse
./manage-neoconverse.sh start

# Check status
./manage-neoconverse.sh status

# Stop NeoConverse
./manage-neoconverse.sh stop

# Restart NeoConverse
./manage-neoconverse.sh restart

# Reconfigure
./manage-neoconverse.sh config

# Build for production
./manage-neoconverse.sh build
```

## 🎯 Example Queries to Try

### Natural Language Queries
- "Show me all sports organizations in the database"
- "What intelligence sources are connected to Premier League teams?"
- "Find federations governing football in Europe"
- "Analyze the relationships between clubs and their governing bodies"
- "What sports data do we have about Manchester United?"

### Predefined Queries
- Sports Organizations Analysis
- Intelligence Connections
- Federation Analysis
- Club Relationship Analysis
- Premier League Data
- Data Model Exploration

## 🔄 Troubleshooting

### If NeoConverse won't start:
1. **Check configuration**: `./manage-neoconverse.sh config`
2. **Verify Neo4j**: `docker ps | grep neo4j`
3. **Check logs**: Look for error messages in the terminal

### If theming doesn't apply:
1. **Restart NeoConverse**: `./manage-neoconverse.sh restart`
2. **Clear browser cache**: Hard refresh (Ctrl+F5)
3. **Check CSS import**: Verify `yellow-panther-theme.css` is loaded

### If queries don't work:
1. **Check Neo4j connection**: Visit http://localhost:7474
2. **Verify API key**: Check if OpenAI key is valid
3. **Test direct access**: Try http://localhost:3001

## 🎉 Ready to Use!

Your NeoConverse is now:
- ✅ **Auto-configured** with your OpenAI key and Neo4j database
- ✅ **Styled** to match your Yellow Panther theme
- ✅ **Integrated** with your dashboard
- ✅ **Enhanced** with comprehensive queries for your knowledge graph

You can start asking questions about your sports data immediately! 🚀 