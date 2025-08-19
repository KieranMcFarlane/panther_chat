#!/bin/bash

# Signal Noise App Startup Script
# This script starts all required services for the Signal Noise App

set -e

echo "🚀 Starting Signal Noise App..."

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

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Python virtual environment exists
check_venv() {
    if [ ! -d "venv" ]; then
        print_warning "Virtual environment not found. Creating one..."
        python3 -m venv venv
        print_success "Virtual environment created"
    fi
    
    print_status "Activating virtual environment..."
    source venv/bin/activate
    print_success "Virtual environment activated"
}

# Install/update dependencies
install_deps() {
    print_status "Installing/updating Python dependencies..."
    pip install -r requirements.txt
    print_success "Dependencies installed"
}

# Start Redis
start_redis() {
    print_status "Starting Redis..."
    docker-compose up -d redis
    
    # Wait for Redis to be ready
    print_status "Waiting for Redis to be ready..."
    until docker exec signal-noise-redis redis-cli ping > /dev/null 2>&1; do
        sleep 1
    done
    print_success "Redis is ready"
}

# Check Neo4j connection
check_neo4j() {
    print_status "Checking Neo4j connection..."
    
    # Try to connect to Neo4j
    if python3 -c "
import os
from backend.neo4j_client import Neo4jMCPClient
client = Neo4jMCPClient()
health = client.health_check()
client.close()
if health['status'] == 'healthy':
    exit(0)
else:
    exit(1)
" 2>/dev/null; then
        print_success "Neo4j connection successful"
    else
        print_warning "Neo4j connection failed. Make sure Neo4j is running."
        print_status "You can start Neo4j with: docker-compose up -d neo4j"
    fi
}

# Start the application
start_app() {
    print_status "Starting FastAPI application..."
    
    # Start FastAPI in background
    nohup uvicorn backend.main:app --host 0.0.0.0 --port 3000 > app.log 2>&1 &
    APP_PID=$!
    
    # Wait for app to start
    print_status "Waiting for FastAPI to start..."
    until curl -s http://localhost:3000/health > /dev/null 2>&1; do
        sleep 1
    done
    print_success "FastAPI is running on http://localhost:3000"
    
    # Save PID for later
    echo $APP_PID > app.pid
}

# Start Celery worker
start_worker() {
    print_status "Starting Celery worker..."
    
    # Start Celery worker in background
    nohup celery -A backend.worker worker --loglevel=info > worker.log 2>&1 &
    WORKER_PID=$!
    
    # Wait a moment for worker to start
    sleep 3
    print_success "Celery worker started"
    
    # Save PID for later
    echo $WORKER_PID > worker.pid
}

# Start Celery monitor (optional)
start_monitor() {
    if [ "$1" = "--with-monitor" ]; then
        print_status "Starting Celery monitor (Flower)..."
        
        # Start Flower in background
        nohup celery -A backend.worker flower --port=5555 > flower.log 2>&1 &
        FLOWER_PID=$!
        
        # Wait for Flower to start
        sleep 5
        print_success "Celery monitor is running on http://localhost:5555"
        
        # Save PID for later
        echo $FLOWER_PID > flower.pid
    fi
}

# Main startup sequence
main() {
    print_status "Starting Signal Noise App..."
    
    # Check prerequisites
    check_docker
    check_venv
    install_deps
    
    # Start infrastructure
    start_redis
    check_neo4j
    
    # Start application components
    start_app
    start_worker
    start_monitor "$1"
    
    print_success "🎉 Signal Noise App is now running!"
    echo ""
    echo "📱 FastAPI Application: http://localhost:3000"
    echo "📊 API Documentation: http://localhost:3000/docs"
    echo "🔍 Health Check: http://localhost:3000/health"
    echo "📈 Celery Monitor: http://localhost:5555"
    echo ""
    echo "📝 Logs:"
    echo "  - Application: tail -f app.log"
    echo "  - Worker: tail -f worker.log"
    echo "  - Monitor: tail -f flower.log"
    echo ""
    echo "🛑 To stop all services: ./stop.sh"
    echo ""
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--with-monitor]"
        echo ""
        echo "Options:"
        echo "  --with-monitor    Start Celery monitor (Flower) on port 5555"
        echo "  --help, -h        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                 Start basic services"
        echo "  $0 --with-monitor Start with monitoring"
        exit 0
        ;;
    *)
        main "$1"
        ;;
esac
