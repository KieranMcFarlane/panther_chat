#!/bin/bash

# Manage Remote Global Sports Intelligence System with Ollama Integration
# Usage: ./manage_remote_system.sh <server_ip> <username> <action>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check arguments
if [ $# -lt 3 ]; then
    print_error "Usage: $0 <server_ip> <username> <action>"
    print_error "Actions: start, stop, restart, status, logs, pull-models, test-query"
    print_error "Example: $0 192.168.1.100 ubuntu start"
    exit 1
fi

SERVER_IP=$1
USERNAME=$2
ACTION=$3
SERVER_DIR="/home/$USERNAME/global-sports-intelligence"

print_status "🌍 Managing Global Sports Intelligence System on Remote Server"
echo "Server: $USERNAME@$SERVER_IP"
echo "Action: $ACTION"
echo "=================================================="

# Functions for different actions
start_system() {
    print_status "Starting the global sports intelligence system..."
    
    ssh $USERNAME@$SERVER_IP "
        cd $SERVER_DIR
        
        # Make sure Ollama is running
        if ! pgrep ollama > /dev/null; then
            print_status 'Starting Ollama...'
            nohup ollama serve > ollama.log 2>&1 &
            sleep 5
        fi
        
        # Start the Docker services
        docker-compose -f docker-compose.unified.yml up -d
        
        # Wait for services to be healthy
        echo 'Waiting for services to become healthy...'
        sleep 30
        
        # Check service health
        docker-compose -f docker-compose.unified.yml ps
    "
    
    print_success "System started! Available endpoints:"
    echo "- FastAPI with Ollama: http://$SERVER_IP:8000"
    echo "- Neo4j Browser: http://$SERVER_IP:7474"
    echo "- Health Monitor: http://$SERVER_IP:8080"
    echo "- Enhanced Crawl4AI: http://$SERVER_IP:8001"
    echo "- Premier League Intel: http://$SERVER_IP:8002"
    echo "- MCP Server: http://$SERVER_IP:8003"
}

stop_system() {
    print_status "Stopping the global sports intelligence system..."
    
    ssh $USERNAME@$SERVER_IP "
        cd $SERVER_DIR
        docker-compose -f docker-compose.unified.yml down
    "
    
    print_success "System stopped successfully"
}

restart_system() {
    print_status "Restarting the global sports intelligence system..."
    stop_system
    sleep 5
    start_system
}

check_status() {
    print_status "Checking system status..."
    
    ssh $USERNAME@$SERVER_IP "
        cd $SERVER_DIR
        
        echo '=== Docker Services ==='
        docker-compose -f docker-compose.unified.yml ps
        
        echo ''
        echo '=== Ollama Status ==='
        if pgrep ollama > /dev/null; then
            echo 'Ollama: Running'
            curl -s http://localhost:11434/api/tags | head -20
        else
            echo 'Ollama: Not running'
        fi
        
        echo ''
        echo '=== Health Checks ==='
        
        # FastAPI Health
        echo -n 'FastAPI Service: '
        if curl -s -f http://localhost:8000/health > /dev/null; then
            echo 'Healthy'
        else
            echo 'Unhealthy'
        fi
        
        # Neo4j Health
        echo -n 'Neo4j Database: '
        if docker exec global-sports-neo4j cypher-shell -u neo4j -p pantherpassword 'RETURN 1' > /dev/null 2>&1; then
            echo 'Healthy'
        else
            echo 'Unhealthy'
        fi
    "
}

view_logs() {
    print_status "Viewing system logs..."
    
    ssh $USERNAME@$SERVER_IP "
        cd $SERVER_DIR
        echo '=== FastAPI with Ollama Logs ==='
        docker-compose -f docker-compose.unified.yml logs --tail=50 ollama-fastapi-service
        
        echo ''
        echo '=== Neo4j Logs ==='
        docker-compose -f docker-compose.unified.yml logs --tail=20 global-neo4j
    "
}

pull_ollama_models() {
    print_status "Managing Ollama models on remote server..."
    
    ssh $USERNAME@$SERVER_IP "
        # Ensure Ollama is running
        if ! pgrep ollama > /dev/null; then
            echo 'Starting Ollama...'
            nohup ollama serve > ollama.log 2>&1 &
            sleep 10
        fi
        
        echo 'Available models:'
        ollama list
        
        echo ''
        echo 'Pulling o3-mini model (if not already available)...'
        if ! ollama list | grep -q 'o3-mini'; then
            ollama pull o3-mini
        else
            echo 'o3-mini already available'
        fi
        
        echo ''
        echo 'Pulling llama3 model (backup option)...'
        if ! ollama list | grep -q 'llama3'; then
            ollama pull llama3:latest
        else
            echo 'llama3 already available'
        fi
        
        echo ''
        echo 'Final model list:'
        ollama list
    "
    
    print_success "Ollama models updated"
}

test_query() {
    print_status "Testing query functionality..."
    
    # Test query with o3-mini
    TEST_QUERY="What Premier League clubs are tracked in the knowledge graph?"
    
    print_status "Testing query: '$TEST_QUERY'"
    
    ssh $USERNAME@$SERVER_IP "
        cd $SERVER_DIR
        
        echo '=== Testing FastAPI Health ==='
        curl -s http://localhost:8000/health | jq '.'
        
        echo ''
        echo '=== Testing Available Models ==='
        curl -s http://localhost:8000/ollama/models | jq '.available_models'
        
        echo ''
        echo '=== Testing Knowledge Graph Stats ==='
        curl -s http://localhost:8000/knowledge-graph/stats | jq '.total_nodes, .total_relationships'
        
        echo ''
        echo '=== Testing Query with Ollama ==='
        curl -s -X POST http://localhost:8000/query-ollama \
            -H 'Content-Type: application/json' \
            -d '{
                \"query\": \"$TEST_QUERY\",
                \"model\": \"o3-mini\",
                \"include_context\": true,
                \"max_tokens\": 500,
                \"temperature\": 0.1
            }' | jq '.response, .metadata'
    "
    
    print_success "Query test completed"
}

# Execute the requested action
case $ACTION in
    "start")
        start_system
        ;;
    "stop")
        stop_system
        ;;
    "restart")
        restart_system
        ;;
    "status")
        check_status
        ;;
    "logs")
        view_logs
        ;;
    "pull-models")
        pull_ollama_models
        ;;
    "test-query")
        test_query
        ;;
    *)
        print_error "Unknown action: $ACTION"
        print_error "Available actions: start, stop, restart, status, logs, pull-models, test-query"
        exit 1
        ;;
esac 