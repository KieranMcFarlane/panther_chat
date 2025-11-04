# Neo4j Database Connection Guide

This guide provides multiple ways to connect to your Neo4j database and run queries.

## 🗄️ Database Configuration

Your Neo4j database is configured with the following settings:
- **Host**: `212.86.105.190`
- **Port**: `7687` (Bolt), `7474` (HTTP)
- **Username**: `neo4j`
- **Password**: `pantherpassword`
- **Database**: `neo4j`

## 🚀 Quick Start

### Option 1: Basic Connection Test (JavaScript)
```bash
node connect-neo4j.js
```

This script will:
- Connect to your Neo4j database
- Display database information
- Show basic statistics (node count, relationship count)
- Display schema information (node labels, relationship types)
- Run a sample query

### Option 2: Interactive Query Runner (JavaScript)
```bash
node neo4j-interactive.js
```

This provides an interactive session where you can:
- Run custom Cypher queries
- View database information
- Explore schema
- Get help with commands

**Available Commands:**
- `help` - Show available commands
- `info` - Show database information
- `stats` - Show database statistics
- `schema` - Show database schema
- `clear` - Clear the screen
- `quit`, `exit`, `q` - Exit the application

### Option 3: Python Connection (Python)
```bash
# Install dependencies first
pip install -r requirements-neo4j.txt

# Run the connection script
python connect-neo4j.py
```

## 🔧 Prerequisites

### For JavaScript:
- Node.js installed
- Dependencies already installed (`npm install`)

### For Python:
- Python 3.7+
- Install dependencies: `pip install -r requirements-neo4j.txt`

## 📊 Example Queries

Here are some useful Cypher queries you can try:

### Basic Queries
```cypher
// Count all nodes
MATCH (n) RETURN count(n) as totalNodes

// Count all relationships
MATCH ()-[r]->() RETURN count(r) as totalRelationships

// Get all node labels
CALL db.labels() YIELD label RETURN label

// Get all relationship types
CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType
```

### Data Exploration
```cypher
// Get sample data from each label
MATCH (n) RETURN labels(n) as labels, count(n) as count ORDER BY count DESC

// Find nodes with specific properties
MATCH (n) WHERE n.name IS NOT NULL RETURN n.name LIMIT 10

// Explore relationships
MATCH (n)-[r]->(m) RETURN type(r), count(r) ORDER BY count(r) DESC LIMIT 10
```

### Sports Data Queries (if applicable)
```cypher
// Find all teams
MATCH (t:Team) RETURN t.name, t.league

// Find players by team
MATCH (p:Player)-[:PLAYS_FOR]->(t:Team) 
WHERE t.name = 'Arsenal' 
RETURN p.name, p.position

// Find recent matches
MATCH (m:Match) 
WHERE m.date >= '2024-01-01' 
RETURN m.homeTeam, m.awayTeam, m.date 
ORDER BY m.date DESC
```

## 🐳 Docker Alternative

If you prefer to use Docker, you can also connect to the Neo4j container directly:

```bash
# Connect to the running container
docker exec -it global-sports-neo4j cypher-shell -u neo4j -p pantherpassword

# Or use the browser interface
open http://212.86.105.190:7474
```

## 🔍 Troubleshooting

### Connection Issues
1. **Check if Neo4j is running**: The database should be accessible at `212.86.105.190:7687`
2. **Verify credentials**: Username `neo4j`, password `pantherpassword`
3. **Check network**: Ensure your machine can reach the remote server
4. **Firewall settings**: Port 7687 should be open for Bolt connections

### Common Errors
- **ServiceUnavailable**: Neo4j service is not running
- **AuthError**: Incorrect username/password
- **Connection timeout**: Network connectivity issues

### Testing Network Connectivity
```bash
# Test if the port is reachable
telnet 212.86.105.190 7687

# Or use netcat
nc -zv 212.86.105.190 7687
```

## 📚 Additional Resources

- [Neo4j Cypher Query Language](https://neo4j.com/docs/cypher-manual/current/)
- [Neo4j JavaScript Driver Documentation](https://neo4j.com/docs/javascript-manual/current/)
- [Neo4j Python Driver Documentation](https://neo4j.com/docs/python-manual/current/)

## 🎯 Next Steps

Once connected, you can:
1. Explore your data structure
2. Run analysis queries
3. Build knowledge graphs
4. Integrate with your applications
5. Use the data for AI/ML purposes

## 📞 Support

If you encounter issues:
1. Check the connection logs
2. Verify your network configuration
3. Ensure Neo4j is running on the remote server
4. Check the `shared-config.env` file for correct settings
