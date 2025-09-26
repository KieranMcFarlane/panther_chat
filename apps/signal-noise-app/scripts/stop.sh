#!/bin/bash

# Signal Noise App Stop Script
# This script gracefully stops all services for the Signal Noise App

set -e

echo "🛑 Stopping Signal Noise App..."

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

# Stop FastAPI application
stop_app() {
    if [ -f "app.pid" ]; then
        APP_PID=$(cat app.pid)
        if ps -p $APP_PID > /dev/null 2>&1; then
            print_status "Stopping FastAPI application (PID: $APP_PID)..."
            kill $APP_PID
            sleep 2
            
            # Force kill if still running
            if ps -p $APP_PID > /dev/null 2>&1; then
                print_warning "Force killing FastAPI application..."
                kill -9 $APP_PID
            fi
            print_success "FastAPI application stopped"
        else
            print_warning "FastAPI application not running"
        fi
        rm -f app.pid
    else
        print_warning "No app.pid file found"
    fi
}

# Stop Celery worker
stop_worker() {
    if [ -f "worker.pid" ]; then
        WORKER_PID=$(cat worker.pid)
        if ps -p $WORKER_PID > /dev/null 2>&1; then
            print_status "Stopping Celery worker (PID: $WORKER_PID)..."
            kill $WORKER_PID
            sleep 2
            
            # Force kill if still running
            if ps -p $WORKER_PID > /dev/null 2>&1; then
                print_warning "Force killing Celery worker..."
                kill -9 $WORKER_PID
            fi
            print_success "Celery worker stopped"
        else
            print_warning "Celery worker not running"
        fi
        rm -f worker.pid
    else
        print_warning "No worker.pid file found"
    fi
}

# Stop Celery monitor
stop_monitor() {
    if [ -f "flower.pid" ]; then
        FLOWER_PID=$(cat flower.pid)
        if ps -p $FLOWER_PID > /dev/null 2>&1; then
            print_status "Stopping Celery monitor (PID: $FLOWER_PID)..."
            kill $FLOWER_PID
            sleep 2
            
            # Force kill if still running
            if ps -p $FLOWER_PID > /dev/null 2>&1; then
                print_warning "Force killing Celery monitor..."
                kill -9 $FLOWER_PID
            fi
            print_success "Celery monitor stopped"
        else
            print_warning "Celery monitor not running"
        fi
        rm -f flower.pid
    else
        print_warning "No flower.pid file found"
    fi
}

# Stop Docker services
stop_docker() {
    print_status "Stopping Docker services..."
    
    # Stop Redis
    if docker ps -q -f name=signal-noise-redis | grep -q .; then
        print_status "Stopping Redis..."
        docker-compose stop redis
        print_success "Redis stopped"
    else
        print_warning "Redis container not running"
    fi
    
    # Stop Neo4j if running
    if docker ps -q -f name=signal-noise-neo4j | grep -q .; then
        print_status "Stopping Neo4j..."
        docker-compose stop neo4j
        print_success "Neo4j stopped"
    fi
    
    # Stop all signal-noise containers
    print_status "Stopping all signal-noise containers..."
    docker-compose down
    print_success "All Docker services stopped"
}

# Clean up log files
cleanup_logs() {
    print_status "Cleaning up log files..."
    
    # Remove log files if they exist
    for log_file in app.log worker.log flower.log; do
        if [ -f "$log_file" ]; then
            rm "$log_file"
            print_status "Removed $log_file"
        fi
    done
    
    print_success "Log cleanup completed"
}

# Main stop sequence
main() {
    print_status "Stopping Signal Noise App..."
    
    # Stop application components
    stop_app
    stop_worker
    stop_monitor
    
    # Stop infrastructure
    stop_docker
    
    # Cleanup
    cleanup_logs
    
    print_success "🎉 Signal Noise App has been stopped!"
    echo ""
    echo "📝 To start again: ./start.sh"
    echo "📝 To start with monitoring: ./start.sh --with-monitor"
    echo ""
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [--help|-h]"
        echo ""
        echo "This script stops all Signal Noise App services:"
        echo "  - FastAPI application"
        echo "  - Celery worker"
        echo "  - Celery monitor (if running)"
        echo "  - Docker services (Redis, Neo4j)"
        echo "  - Cleans up log files and PID files"
        echo ""
        echo "Options:"
        echo "  --help, -h        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                 Stop all services"
        echo "  $0 --help         Show help"
        exit 0
        ;;
    *)
        main
        ;;
esac
