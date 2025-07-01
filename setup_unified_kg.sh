#!/bin/bash

# Unified Knowledge Graph Setup Script
# Sets up the integrated crawl4ai-rag and Premier League Intelligence Graph system

set -e

echo "🚀 Setting up Unified Knowledge Graph Integration"
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_status "Docker and Docker Compose found"

# Check if we're in the right directory
if [ ! -f "README.md" ] || [ ! -d "crawl4ai-rag" ] || [ ! -d "prem-intel-graph" ]; then
    print_error "Please run this script from the panther_chat root directory"
    exit 1
fi

print_status "Running from correct directory"

# Create shared configuration if it doesn't exist
if [ ! -f "shared-config.env" ]; then
    print_info "Creating shared configuration file..."
    cat > shared-config.env << EOF
# Unified Panther Chat Knowledge Graph Configuration
# Used by both Premier League Intelligence Graph and crawl4ai-rag

# Neo4j Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword
NEO4J_DATABASE=neo4j

# For Docker environment, use this instead:
# NEO4J_URI=bolt://neo4j:7687

# Enable knowledge graph functionality
USE_KNOWLEDGE_GRAPH=true

# OpenAI Configuration (for AI analysis)
OPENAI_API_KEY=your_openai_api_key_here

# Environment
ENVIRONMENT=development

# Logging
LOG_LEVEL=INFO

# Services
CRAWL4AI_RAG_PORT=8001
PREM_INTEL_API_PORT=8002
NEO4J_HTTP_PORT=7474
NEO4J_BOLT_PORT=7687
EOF
    print_status "Created shared-config.env"
else
    print_status "shared-config.env already exists"
fi

# Copy shared config to crawl4ai-rag if needed
if [ ! -f "crawl4ai-rag/.env" ]; then
    print_info "Creating crawl4ai-rag environment configuration..."
    cp shared-config.env crawl4ai-rag/.env
    print_status "Created crawl4ai-rag/.env"
fi

# Create Docker network if it doesn't exist
if ! docker network ls | grep -q panther-network; then
    print_info "Creating Docker network..."
    docker network create panther-network
    print_status "Created panther-network"
else
    print_status "Docker network panther-network already exists"
fi

# Start the unified system
print_info "Starting unified knowledge graph services..."
cd prem-intel-graph

# Pull latest images
print_info "Pulling Docker images..."
docker-compose pull

# Start services
print_info "Starting services with Docker Compose..."
docker-compose up -d

# Wait for Neo4j to be ready
print_info "Waiting for Neo4j to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker exec panther-neo4j cypher-shell -u neo4j -p pantherpassword "RETURN 1" &> /dev/null; then
        print_status "Neo4j is ready"
        break
    fi
    
    attempt=$((attempt + 1))
    if [ $attempt -eq $max_attempts ]; then
        print_error "Neo4j failed to start within 60 seconds"
        exit 1
    fi
    
    echo -n "."
    sleep 2
done

# Apply the unified schema
print_info "Applying unified knowledge graph schema..."
if docker exec panther-neo4j cypher-shell -u neo4j -p pantherpassword -f /var/lib/neo4j/import/schema.cypher; then
    print_status "Schema applied successfully"
else
    print_warning "Schema application may have failed, but continuing..."
fi

# Go back to root directory
cd ..

print_status "Unified Knowledge Graph setup complete!"
echo ""
echo "🎯 Next Steps:"
echo "=============="
echo ""
echo "1. Services are running:"
echo "   • Neo4j Browser: http://localhost:7474 (neo4j/pantherpassword)"
echo "   • crawl4ai-rag: http://localhost:8001"
echo "   • prem-intel-api: http://localhost:8002"
echo ""
echo "2. Configure OpenAI API key (optional):"
echo "   • Edit shared-config.env and set OPENAI_API_KEY"
echo "   • Restart services: cd prem-intel-graph && docker-compose restart"
echo ""
echo "3. Test the integration:"
echo "   • Use analyze_with_business_intelligence MCP tool"
echo "   • Query business intelligence with query_business_intelligence"
echo "   • Parse repositories with parse_github_repository"
echo ""
echo "4. View documentation:"
echo "   • Read UNIFIED_KNOWLEDGE_GRAPH_INTEGRATION.md for detailed usage"
echo ""
echo "🔧 Management Commands:"
echo "======================"
echo ""
echo "Stop services:    cd prem-intel-graph && docker-compose down"
echo "View logs:        cd prem-intel-graph && docker-compose logs -f"
echo "Restart services: cd prem-intel-graph && docker-compose restart"
echo "Reset database:   cd prem-intel-graph && docker-compose down -v && docker-compose up -d"
echo ""
echo "🚀 The unified knowledge graph is ready for business intelligence!"

# Final status check
print_info "Performing final status check..."

# Check if all services are running
services=("panther-neo4j" "panther-crawl4ai-rag" "panther-prem-intel")
all_running=true

for service in "${services[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$service"; then
        print_status "$service is running"
    else
        print_error "$service is not running"
        all_running=false
    fi
done

if [ "$all_running" = true ]; then
    print_status "All services are running successfully!"
    echo ""
    echo -e "${GREEN}🎉 Unified Knowledge Graph is fully operational!${NC}"
else
    print_warning "Some services may not be running properly. Check logs with:"
    echo "cd prem-intel-graph && docker-compose logs"
fi 