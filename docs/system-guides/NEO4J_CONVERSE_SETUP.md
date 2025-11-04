# NeoConverse Setup for Panther Chat Knowledge Graph

This guide will help you set up [NeoConverse](https://github.com/neo4j-labs/neoconverse) to interact with your existing Neo4j knowledge graph using natural language.

## 🎯 What is NeoConverse?

NeoConverse is a GenAI copilot that allows you to interact with your Neo4j graph database using plain English. It provides:
- Natural language querying of your knowledge graph
- AI-powered analysis and insights
- Customizable agents for specific use cases
- Beautiful web interface for data visualization

## 🚀 Quick Setup

### Prerequisites

1. **Node.js and npm** - Make sure you have Node.js installed
2. **Neo4j Database** - Your existing Neo4j instance should be running
3. **OpenAI API Key** - For the AI conversation capabilities

### Step 1: Run the Setup Script

```bash
chmod +x setup-neoconverse.sh
./setup-neoconverse.sh
```

This script will:
- Clone the NeoConverse repository
- Install all required dependencies
- Create environment configuration
- Set up custom agents for your knowledge graph
- Create utility scripts for testing and running

### Step 2: Configure Your Environment

Edit the `.env` file in the `neoconverse` directory:

```bash
cd neoconverse
nano .env
```

Update these key values:
```env
# Your OpenAI API key
OPENAI_API_KEY=your_actual_openai_api_key_here

# Neo4j connection (should be auto-configured from your existing setup)
NEXT_PUBLIC_BACKEND_HOST=bolt://localhost:7687
NEXT_PUBLIC_BACKEND_UNAME=neo4j
NEXT_PUBLIC_BACKEND_PWD=pantherpassword
NEXT_PUBLIC_BACKEND_DATABASE=neo4j
```

### Step 3: Test the Connection

```bash
./test-neo4j-connection.sh
```

This will verify that NeoConverse can connect to your Neo4j database.

### Step 4: Start NeoConverse

**Development mode (recommended for testing):**
```bash
./dev-neoconverse.sh
```

**Production mode:**
```bash
./start-neoconverse.sh
```

## 🌐 Accessing NeoConverse

Once running, you can access NeoConverse at:
- **NeoConverse Interface**: http://localhost:3000
- **Neo4j Browser**: http://localhost:7474

## 🎯 Using NeoConverse with Your Knowledge Graph

### 1. Explore Predefined Agents

NeoConverse comes with a "Panther Knowledge Graph Assistant" agent that includes:
- Sports Organizations Analysis
- Intelligence Connections Analysis
- Federation Analysis

### 2. Natural Language Queries

You can ask questions like:
- "Show me all sports organizations in the database"
- "What intelligence sources are connected to Premier League teams?"
- "Find federations governing football in Europe"
- "Analyze the relationships between clubs and their governing bodies"

### 3. Custom Queries

You can also write custom Cypher queries or ask the AI to help you construct them.

## 🔧 Customization

### Adding Custom Agents

You can create custom agents by adding Cypher scripts to `agents/cypherScripts/`. The setup script has already created a sample agent for your knowledge graph.

### Modifying the Agent Configuration

Edit `agents/cypherScripts/panther_knowledge_graph.cypher` to:
- Add more predefined queries
- Modify the system prompt
- Add new categories of analysis

### Example Custom Query

```cypher
// Add a new query to your agent
CREATE (query4:Query {
    id: "club-relationships",
    name: "Club Relationship Analysis",
    description: "Analyze relationships between clubs and their stakeholders",
    cypher: "MATCH (club:Club)-[:HAS_OWNER]->(owner:Owner) RETURN club.name, owner.name, club.league LIMIT 10",
    category: "Club Analysis"
})
```

## 🛠️ Troubleshooting

### Common Issues

1. **Neo4j Connection Failed**
   - Ensure Neo4j is running: `docker ps | grep neo4j`
   - Check credentials in `.env` file
   - Verify Neo4j is accessible at http://localhost:7474

2. **OpenAI API Errors**
   - Verify your API key is correct
   - Check your OpenAI account has sufficient credits
   - Ensure the API key has the necessary permissions

3. **Build Errors**
   - Try running `npm install --legacy-peer-deps` again
   - Check Node.js version compatibility
   - Clear npm cache: `npm cache clean --force`

4. **Port Conflicts**
   - NeoConverse runs on port 3000 by default
   - If port 3000 is in use, modify the port in `package.json`

### Debug Mode

Run NeoConverse in development mode for detailed error messages:
```bash
./dev-neoconverse.sh
```

## 📊 Integration with Your Existing System

### Current Neo4j Setup

Your existing Neo4j instance is configured with:
- **Host**: localhost:7687 (Bolt) / localhost:7474 (HTTP)
- **Username**: neo4j
- **Password**: pantherpassword
- **Database**: neo4j

### Data Schema

NeoConverse will work with your existing knowledge graph schema. The setup includes sample queries for:
- Organizations and Sports relationships
- Intelligence Sources and their connections
- Federation governance structures

### Performance Optimization

The setup script creates indexes for better query performance:
- Organization names
- Sport names
- Federation names
- Intelligence source names

## 🔄 Updating NeoConverse

To update to the latest version:

```bash
cd neoconverse
git pull origin master
npm install --legacy-peer-deps
./start-neoconverse.sh
```

## 📚 Additional Resources

- [NeoConverse GitHub Repository](https://github.com/neo4j-labs/neoconverse)
- [Neo4j Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## 🎉 Next Steps

1. **Test the basic functionality** with the predefined queries
2. **Customize the agent** for your specific use cases
3. **Add more sophisticated queries** based on your data
4. **Integrate with your existing workflows** if needed

Your NeoConverse setup is now ready to help you interact with your knowledge graph using natural language! 🚀 