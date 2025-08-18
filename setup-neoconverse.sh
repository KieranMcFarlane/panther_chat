#!/bin/bash

echo "🤖 Setting up NeoConverse for your Neo4j Knowledge Graph..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first."
    exit 1
fi

# Create neoconverse directory
NEO4J_CONVERSE_DIR="neoconverse"
if [ -d "$NEO4J_CONVERSE_DIR" ]; then
    print_warning "NeoConverse directory already exists. Removing it..."
    rm -rf "$NEO4J_CONVERSE_DIR"
fi

print_status "Cloning NeoConverse repository..."
git clone https://github.com/neo4j-labs/neoconverse.git "$NEO4J_CONVERSE_DIR"

if [ ! -d "$NEO4J_CONVERSE_DIR" ]; then
    print_error "Failed to clone NeoConverse repository"
    exit 1
fi

cd "$NEO4J_CONVERSE_DIR"

print_status "Installing npm packages..."
npm install --legacy-peer-deps

if [ $? -ne 0 ]; then
    print_error "Failed to install npm packages"
    exit 1
fi

# Create environment file
print_status "Creating environment configuration..."

# Read existing Neo4j configuration
if [ -f "../shared-config.env" ]; then
    source ../shared-config.env
else
    # Default values
    NEO4J_URI="bolt://localhost:7687"
    NEO4J_USER="neo4j"
    NEO4J_PASSWORD="pantherpassword"
    NEO4J_DATABASE="neo4j"
fi

# Create .env file for NeoConverse
cat > .env << EOF
# NeoConverse Environment Configuration
# Generated for Panther Chat Knowledge Graph Integration

# LLM Configuration (OpenAI)
OPENAI_API_KEY=${OPENAI_API_KEY:-your_openai_api_key_here}
OPENAI_MODEL=gpt-4-turbo-preview
DEFAULT_PROVIDER=OpenAI
DEFAULT_MODEL=gpt-4-turbo-preview

# Neo4j Backend Configuration
NEXT_PUBLIC_BACKEND_HOST=${NEO4J_URI:-bolt://localhost:7687}
NEXT_PUBLIC_BACKEND_UNAME=${NEO4J_USER:-neo4j}
NEXT_PUBLIC_BACKEND_PWD=${NEO4J_PASSWORD:-pantherpassword}
NEXT_PUBLIC_BACKEND_DATABASE=${NEO4J_DATABASE:-neo4j}

# Encryption
ENCRYPTION_KEY=neoconversepanthersecretkey

# Optional: Google Vertex AI (if you want to use it)
# GOOGLE_API_KEY=your_google_api_key_here
# GOOGLE_MODEL=gemini-1.0-pro

# Optional: AWS Bedrock (if you want to use it)
# AWS_ACCESS_KEY_ID=your_aws_access_key_here
# AWS_SECRET_ACCESS_KEY=your_aws_secret_key_here
# AWS_MODEL=claude-3-haiku-20240307
EOF

print_success "Environment file created"

# Create custom agent configuration for your knowledge graph
print_status "Creating custom agent configuration..."

mkdir -p agents/cypherScripts

# Create a custom agent for your knowledge graph
cat > agents/cypherScripts/panther_knowledge_graph.cypher << 'EOF'
// Panther Knowledge Graph Agent Configuration
// This agent is specifically configured for the Panther Chat Knowledge Graph

// Create the agent node
CREATE (agent:Agent {
    id: "panther-knowledge-graph-agent",
    name: "Panther Knowledge Graph Assistant",
    description: "AI assistant for querying and analyzing the Panther Chat knowledge graph",
    systemPrompt: "You are an AI assistant specialized in analyzing and querying the Panther Chat knowledge graph. You help users understand relationships between sports data, organizations, and intelligence information. Always provide clear explanations and suggest relevant queries.",
    model: "gpt-4-turbo-preview",
    provider: "OpenAI",
    createdAt: datetime(),
    updatedAt: datetime()
})

// Create sample queries for the agent
CREATE (query1:Query {
    id: "sports-orgs-query",
    name: "Sports Organizations Analysis",
    description: "Find and analyze sports organizations in the knowledge graph",
    cypher: "MATCH (org:Organization)-[:HAS_SPORT]->(sport:Sport) RETURN org.name, sport.name, org.country LIMIT 10",
    category: "Sports Analysis"
})

CREATE (query2:Query {
    id: "intelligence-connections",
    name: "Intelligence Connections",
    description: "Find connections between intelligence sources and organizations",
    cypher: "MATCH (source:IntelligenceSource)-[:PROVIDES_TO]->(org:Organization) RETURN source.name, org.name, source.type LIMIT 10",
    category: "Intelligence Analysis"
})

CREATE (query3:Query {
    id: "federation-analysis",
    name: "Federation Analysis",
    description: "Analyze sports federations and their relationships",
    cypher: "MATCH (fed:Federation)-[:GOVERNING]->(sport:Sport) RETURN fed.name, sport.name, fed.region LIMIT 10",
    category: "Federation Analysis"
})

// Connect queries to the agent
CREATE (agent)-[:HAS_QUERY]->(query1)
CREATE (agent)-[:HAS_QUERY]->(query2)
CREATE (agent)-[:HAS_QUERY]->(query3)

// Create indexes for better performance
CREATE INDEX organization_name IF NOT EXISTS FOR (org:Organization) ON (org.name)
CREATE INDEX sport_name IF NOT EXISTS FOR (sport:Sport) ON (sport.name)
CREATE INDEX federation_name IF NOT EXISTS FOR (fed:Federation) ON (fed.name)
CREATE INDEX intelligence_source_name IF NOT EXISTS FOR (source:IntelligenceSource) ON (source.name)
EOF

print_success "Custom agent configuration created"

# Create a startup script
cat > start-neoconverse.sh << 'EOF'
#!/bin/bash

echo "🤖 Starting NeoConverse for Panther Knowledge Graph..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run setup-neoconverse.sh first."
    exit 1
fi

# Check if Neo4j is accessible
echo "🔍 Checking Neo4j connection..."
if ! curl -s http://localhost:7474 > /dev/null 2>&1; then
    echo "⚠️  Warning: Neo4j browser not accessible at http://localhost:7474"
    echo "   Make sure Neo4j is running and accessible"
fi

# Build the application
echo "🔨 Building NeoConverse..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please check the error messages above."
    exit 1
fi

# Start the application
echo "🚀 Starting NeoConverse..."
npm run start
EOF

chmod +x start-neoconverse.sh

# Create a development script
cat > dev-neoconverse.sh << 'EOF'
#!/bin/bash

echo "🔧 Starting NeoConverse in development mode..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found. Please run setup-neoconverse.sh first."
    exit 1
fi

# Start in development mode
npm run dev
EOF

chmod +x dev-neoconverse.sh

# Create a connection test script
cat > test-neo4j-connection.sh << 'EOF'
#!/bin/bash

echo "🔍 Testing Neo4j connection..."

# Source environment variables
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Test Neo4j connection using curl
echo "Testing Neo4j HTTP connection..."
if curl -s "http://localhost:7474" > /dev/null; then
    echo "✅ Neo4j HTTP connection successful"
else
    echo "❌ Neo4j HTTP connection failed"
fi

# Test with authentication
echo "Testing Neo4j authentication..."
if curl -s -u neo4j:pantherpassword "http://localhost:7474/db/neo4j/tx/commit" \
    -H "Content-Type: application/json" \
    -d '{"statements":[{"statement":"RETURN 1 as test"}]}' > /dev/null; then
    echo "✅ Neo4j authentication successful"
else
    echo "❌ Neo4j authentication failed"
fi

echo "🔍 Connection test complete"
EOF

chmod +x test-neo4j-connection.sh

print_success "NeoConverse setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your OpenAI API key in the .env file"
echo "2. Make sure Neo4j is running and accessible"
echo "3. Run './test-neo4j-connection.sh' to test the connection"
echo "4. Run './dev-neoconverse.sh' to start in development mode"
echo "5. Run './start-neoconverse.sh' to start in production mode"
echo ""
echo "🌐 NeoConverse will be available at: http://localhost:3000"
echo "🗄️ Neo4j Browser: http://localhost:7474"
echo ""
echo "📚 Documentation: https://github.com/neo4j-labs/neoconverse" 