# Neo4j Setup Guide

## 🎯 **Overview**

This guide helps you set up Neo4j for the Yellow Panther AI Sports Intelligence platform and seed it with data from the scraping_data folder.

## 🚀 **Option 1: Docker Setup (Recommended)**

### **1. Install Docker Desktop**
- Download from: https://www.docker.com/products/docker-desktop/
- Install and start Docker Desktop

### **2. Start Neo4j with Docker**
```bash
# Navigate to the project root
cd /Users/kieranmcfarlane/Downloads/panther_chat

# Start Neo4j container
docker-compose -f docker-compose.unified.yml up -d global-neo4j

# Check if Neo4j is running
docker ps | grep neo4j
```

### **3. Access Neo4j Browser**
- Open: http://localhost:7474
- Username: `neo4j`
- Password: `pantherpassword`

### **4. Seed the Database**
```bash
# Navigate to yellow-panther-ai
cd yellow-panther-ai

# Install dependencies if needed
npm install neo4j-driver

# Run the seeding script
node scripts/seedNeo4j.js
```

## 🛠️ **Option 2: Local Neo4j Installation**

### **1. Install Neo4j Desktop**
- Download from: https://neo4j.com/download/
- Install Neo4j Desktop

### **2. Create a New Database**
- Open Neo4j Desktop
- Click "Create" → "Create a Local Graph"
- Name: `sports-intelligence`
- Password: `pantherpassword`
- Version: 5.15.0

### **3. Start the Database**
- Click "Start" on your database
- Note the connection details (usually bolt://localhost:7687)

### **4. Seed the Database**
```bash
# Set environment variables
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=pantherpassword

# Run the seeding script
node scripts/seedNeo4j.js
```

## 📊 **Verification Steps**

### **1. Check Neo4j Connection**
```bash
# Test the API endpoint
curl -X POST http://localhost:3002/api/admin/neo4j \
  -H "Content-Type: application/json" \
  -d '{"action":"scan_seed_data"}'
```

### **2. Check Database Content**
In Neo4j Browser (http://localhost:7474), run:
```cypher
// Count all sports
MATCH (s:Sport) RETURN count(s) as sports_count;

// Count all federations
MATCH (f:Federation) RETURN count(f) as federations_count;

// View some sports
MATCH (s:Sport) RETURN s.name, s.tier LIMIT 10;

// View some federations
MATCH (f:Federation) RETURN f.name, f.sport, f.tier LIMIT 10;
```

### **3. Test Sports Intelligence Generator**
- Go to: http://localhost:3002/sports-intelligence-generator
- Select a sport (e.g., "EFL")
- Generate intelligence page
- Check that Neo4j integration works

## 🔧 **Troubleshooting**

### **Neo4j Connection Issues**
```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
docker logs global-sports-neo4j

# Restart Neo4j
docker-compose -f docker-compose.unified.yml restart global-neo4j
```

### **Database Seeding Issues**
```bash
# Check seed data files exist
ls -la scraping_data/sportsWorldSeed.json
ls -la scraping_data/international_federations_seed.json

# Run seeding with verbose output
NODE_ENV=development node scripts/seedNeo4j.js
```

### **API Connection Issues**
```bash
# Test Neo4j connection directly
node -e "
const neo4j = require('neo4j-driver');
const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic('neo4j', 'pantherpassword'));
driver.verifyConnectivity().then(() => console.log('✅ Connected')).catch(e => console.log('❌ Failed:', e.message));
"
```

## 📈 **Database Schema**

### **Sport Nodes**
```cypher
CREATE (s:Sport {
  name: String,
  description: String,
  tier: String,
  source: String,
  type: String,
  seededAt: DateTime
})
```

### **Federation Nodes**
```cypher
CREATE (f:Federation {
  name: String,
  sport: String,
  description: String,
  tier: String,
  source: String,
  type: String,
  priorityScore: Float,
  estimatedValue: String,
  seededAt: DateTime
})
```

### **Intelligence Nodes**
```cypher
CREATE (i:Intelligence {
  type: String,
  sport: String,
  division: String,
  status: String,
  generatedAt: DateTime
})
```

### **Digital Maturity Nodes**
```cypher
CREATE (d:DigitalMaturity {
  sport: String,
  assessment: String,
  score: Float,
  weaknesses: String,
  opportunities: String,
  assessedAt: DateTime
})
```

### **Relationships**
```cypher
// Sport has Intelligence
(s:Sport)-[:HAS_INTELLIGENCE]->(i:Intelligence)

// Sport has Digital Maturity
(s:Sport)-[:HAS_DIGITAL_MATURITY]->(d:DigitalMaturity)
```

## 🎯 **Expected Results**

After successful setup, you should see:

### **Database Statistics**
- **Sports**: ~150+ entities from sportsWorldSeed.json
- **Federations**: ~50+ entities from international_federations_seed.json
- **Total**: ~200+ sports entities

### **API Endpoints Working**
- `/api/admin/neo4j` - Neo4j operations
- `/api/admin/sports-intelligence-generator` - Sports intelligence generation
- `/sports-intelligence-generator` - Web interface

### **Generated Files**
- `src/lib/[sport]IntelligenceData.ts` - Data files
- `src/app/[sport]-intel/linkedin-overview/page.tsx` - Page files

## 🔄 **Maintenance**

### **Update Seed Data**
```bash
# After updating scraping_data files
node scripts/seedNeo4j.js
```

### **Backup Database**
```bash
# Export data
docker exec global-sports-neo4j neo4j-admin database dump neo4j --to-path=/var/lib/neo4j/import/backup
```

### **Reset Database**
```bash
# Clear all data
docker exec global-sports-neo4j cypher-shell -u neo4j -p pantherpassword "MATCH (n) DETACH DELETE n"

# Re-seed
node scripts/seedNeo4j.js
```

## 📚 **Useful Queries**

### **Find High-Priority Opportunities**
```cypher
MATCH (f:Federation)
WHERE f.priorityScore >= 8.0
RETURN f.name, f.sport, f.priorityScore, f.estimatedValue
ORDER BY f.priorityScore DESC
```

### **Find Tier 1 Sports**
```cypher
MATCH (s:Sport)
WHERE s.tier = 'tier_1'
RETURN s.name, s.description
ORDER BY s.name
```

### **Find Generated Intelligence**
```cypher
MATCH (s:Sport)-[:HAS_INTELLIGENCE]->(i:Intelligence)
RETURN s.name, i.status, i.generatedAt
ORDER BY i.generatedAt DESC
```

The Neo4j setup is now complete and ready for sports intelligence generation! 