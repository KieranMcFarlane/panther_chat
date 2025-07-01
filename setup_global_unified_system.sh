#!/bin/bash

# Global Unified Sports Intelligence System Setup
# Integrates crawl4ai-rag and prem-intel-graph into the existing global Neo4j knowledge graph

set -e

echo "🌍 Setting up Global Unified Sports Intelligence System..."
echo "=================================================="

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

# Check prerequisites
print_status "Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Prerequisites check completed"

# Create necessary directories
print_status "Creating directory structure..."

mkdir -p monitoring
mkdir -p logs
mkdir -p .env.local

# Create environment configuration
print_status "Setting up environment configuration..."

cat > .env.global <<EOF
# Global Unified Sports Intelligence System Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=pantherpassword

# AI API Keys (add your keys here)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# System Configuration
SYSTEM_NAME=Global Sports Intelligence
SYSTEM_VERSION=1.0.0
ENABLE_TECHNICAL_ANALYSIS=true
ENABLE_BUSINESS_INTELLIGENCE=true
ENABLE_PREMIER_LEAGUE_INTELLIGENCE=true

# Logging Configuration
LOG_LEVEL=INFO
LOG_FORMAT=json
EOF

# Create monitoring configuration
print_status "Setting up monitoring..."

cat > monitoring/nginx.conf <<EOF
events {
    worker_connections 1024;
}

http {
    upstream neo4j {
        server global-neo4j:7474;
    }
    
    upstream crawl4ai {
        server enhanced-crawl4ai-rag:8000;
    }
    
    upstream prem_intel {
        server prem-intel-service:3000;
    }
    
    upstream mcp_server {
        server unified-mcp-server:8000;
    }

    server {
        listen 80;
        server_name localhost;

        location / {
            root /usr/share/nginx/html;
            index index.html;
        }
        
        location /neo4j/ {
            proxy_pass http://neo4j/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        location /crawl4ai/ {
            proxy_pass http://crawl4ai/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        location /intel/ {
            proxy_pass http://prem_intel/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        location /mcp/ {
            proxy_pass http://mcp_server/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
    }
}
EOF

cat > monitoring/status.html <<EOF
<!DOCTYPE html>
<html>
<head>
    <title>Global Sports Intelligence System</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; }
        .services { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 30px; }
        .service { border: 1px solid #ddd; padding: 20px; border-radius: 6px; background: #f9f9f9; }
        .service h3 { color: #34495e; margin-top: 0; }
        .service a { color: #3498db; text-decoration: none; }
        .service a:hover { text-decoration: underline; }
        .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status.healthy { background: #2ecc71; color: white; }
        .features { margin-top: 30px; padding: 20px; background: #ecf0f1; border-radius: 6px; }
        .features h3 { color: #2c3e50; }
        .features ul { columns: 2; column-gap: 40px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🌍 Global Sports Intelligence System</h1>
        <p style="text-align: center; color: #7f8c8d;">Unified Knowledge Graph for Sports Organizations, Technical Analysis & Business Intelligence</p>
        
        <div class="services">
            <div class="service">
                <h3>🧠 Neo4j Knowledge Graph</h3>
                <span class="status healthy">ACTIVE</span>
                <p>Global sports world database with comprehensive organization data</p>
                <a href="/neo4j/" target="_blank">Neo4j Browser →</a>
            </div>
            
            <div class="service">
                <h3>🤖 Enhanced Crawl4AI RAG</h3>
                <span class="status healthy">ACTIVE</span>
                <p>AI-powered code analysis with sports organization context</p>
                <a href="/crawl4ai/health" target="_blank">Health Check →</a>
            </div>
            
            <div class="service">
                <h3>🏆 Premier League Intelligence</h3>
                <span class="status healthy">ACTIVE</span>
                <p>Business intelligence for Premier League clubs and agencies</p>
                <a href="/intel/health" target="_blank">Health Check →</a>
            </div>
            
            <div class="service">
                <h3>🔧 Unified MCP Server</h3>
                <span class="status healthy">ACTIVE</span>
                <p>Model Context Protocol server for AI integration</p>
                <a href="/mcp/" target="_blank">MCP Interface →</a>
            </div>
        </div>
        
        <div class="features">
            <h3>🚀 System Capabilities</h3>
            <ul>
                <li>Global Sports Organization Knowledge Graph</li>
                <li>Technical Repository Analysis</li>
                <li>AI Hallucination Detection</li>
                <li>Business Intelligence Signals</li>
                <li>Premier League Club Intelligence</li>
                <li>Agency Relationship Tracking</li>
                <li>Digital Maturity Assessment</li>
                <li>Partnership Opportunity Discovery</li>
                <li>Cross-domain Insights Generation</li>
                <li>Real-time Signal Ingestion</li>
            </ul>
        </div>
    </div>
</body>
</html>
EOF

# Create additional Dockerfiles needed
print_status "Creating additional Docker configurations..."

cat > Dockerfile.unified-mcp <<EOF
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc g++ curl && rm -rf /var/lib/apt/lists/*

COPY crawl4ai-rag/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir neo4j python-dotenv mcp

COPY crawl4ai-rag/ ./

ENV PYTHONPATH=/app:/app/knowledge_graphs
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["python", "src/enhanced_crawl4ai_mcp.py"]
EOF

cat > Dockerfile.prem-intel <<EOF
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY prem-intel-graph/package*.json ./
RUN npm install

COPY prem-intel-graph/ ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
EOF

# Stop any existing containers
print_status "Stopping any existing containers..."
docker-compose -f docker-compose.unified.yml down 2>/dev/null || true

# Build and start the unified system
print_status "Building and starting the Global Unified Sports Intelligence System..."

# Load environment variables
export $(cat .env.global | grep -v '^#' | xargs)

# Build and start services
docker-compose -f docker-compose.unified.yml up --build -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."

# Function to check service health
check_service() {
    local service_name=$1
    local health_url=$2
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s $health_url > /dev/null 2>&1; then
            print_success "$service_name is ready"
            return 0
        fi
        
        print_status "Waiting for $service_name... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    print_error "$service_name failed to start"
    return 1
}

# Check Neo4j
print_status "Checking Neo4j..."
sleep 30  # Give Neo4j extra time to start

# Check services
check_service "Enhanced Crawl4AI RAG" "http://localhost:8001/health"
check_service "Premier League Intel" "http://localhost:8002/health" 

# Display system information
print_success "Global Unified Sports Intelligence System is ready!"
echo ""
echo "🌍 System Access Points:"
echo "=================================="
echo "• System Dashboard:        http://localhost:8080"
echo "• Neo4j Browser:          http://localhost:7474"
echo "• Enhanced Crawl4AI RAG:  http://localhost:8001"
echo "• Premier League Intel:   http://localhost:8002"
echo "• Unified MCP Server:     http://localhost:8003"
echo ""
echo "🔑 Neo4j Credentials:"
echo "• Username: neo4j"
echo "• Password: pantherpassword"
echo ""
echo "🏆 Premier League Intelligence Features:"
echo "• Business Intelligence Signals"
echo "• Club & Agency Relationship Tracking"  
echo "• Technical Analysis Integration"
echo "• Partnership Opportunity Discovery"
echo ""
echo "🤖 Technical Analysis Features:"
echo "• AI Hallucination Detection"
echo "• Code Quality Assessment"
echo "• Repository Complexity Analysis"
echo "• Cross-domain Signal Generation"
echo ""
echo "📊 Usage Examples:"
echo "• Query Premier League Intelligence: Navigate to the system dashboard"
echo "• Analyze Repository: Use the MCP server endpoints"
echo "• View Knowledge Graph: Access Neo4j browser"
echo ""

# Create management script
cat > manage_system.sh <<EOF
#!/bin/bash

case "\$1" in
    start)
        echo "Starting Global Unified Sports Intelligence System..."
        docker-compose -f docker-compose.unified.yml up -d
        ;;
    stop)
        echo "Stopping Global Unified Sports Intelligence System..."
        docker-compose -f docker-compose.unified.yml down
        ;;
    restart)
        echo "Restarting Global Unified Sports Intelligence System..."
        docker-compose -f docker-compose.unified.yml restart
        ;;
    logs)
        docker-compose -f docker-compose.unified.yml logs -f \${2:-}
        ;;
    status)
        docker-compose -f docker-compose.unified.yml ps
        ;;
    seed)
        echo "Re-seeding knowledge graph..."
        docker-compose -f docker-compose.unified.yml up kg-seeder --force-recreate
        ;;
    *)
        echo "Usage: \$0 {start|stop|restart|logs|status|seed}"
        echo ""
        echo "Examples:"
        echo "  \$0 start          # Start all services"
        echo "  \$0 logs neo4j     # View Neo4j logs"
        echo "  \$0 seed           # Re-seed knowledge graph"
        exit 1
        ;;
esac
EOF

chmod +x manage_system.sh

print_success "Global Unified Sports Intelligence System setup completed!"
print_status "Use './manage_system.sh' to manage the system"
echo "" 