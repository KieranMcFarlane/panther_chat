#!/bin/bash

# TTYD Management Script for Yellow Panther AI
# This script manages the ttyd terminal sharing service

TTYD_PORT=${TTYD_PORT:-7681}
TTYD_CREDENTIALS=${TTYD_CREDENTIALS:-"admin:panther123"}
TTYD_PID_FILE="/tmp/ttyd.pid"
TTYD_LOG_FILE="/tmp/ttyd.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}  TTYD Terminal Sharing Service${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check if ttyd is running
is_running() {
    if [ -f "$TTYD_PID_FILE" ]; then
        if kill -0 $(cat "$TTYD_PID_FILE") 2>/dev/null; then
            return 0
        else
            rm -f "$TTYD_PID_FILE"
            return 1
        fi
    fi
    return 1
}

# Function to start ttyd
start() {
    print_header
    if is_running; then
        print_warning "TTYD is already running on port $TTYD_PORT"
        return 1
    fi
    
    print_status "Starting TTYD terminal sharing service..."
    print_status "Port: $TTYD_PORT"
    print_status "Credentials: $TTYD_CREDENTIALS"
    print_status "Access URL: http://localhost:$TTYD_PORT"
    
    # Start ttyd in background
    ttyd \
        --port "$TTYD_PORT" \
        --credential "$TTYD_CREDENTIALS" \
        --terminal-type xterm-256color \
        --max-clients 5 \
        --check-origin \
        --debug 7 \
        --log-file "$TTYD_LOG_FILE" \
        /bin/zsh &
    
    # Save PID
    echo $! > "$TTYD_PID_FILE"
    
    if is_running; then
        print_status "TTYD started successfully!"
        print_status "PID: $(cat $TTYD_PID_FILE)"
        print_status "Log file: $TTYD_LOG_FILE"
        print_status "Access your terminal at: http://localhost:$TTYD_PORT"
        print_status "Username: admin, Password: panther123"
    else
        print_error "Failed to start TTYD"
        return 1
    fi
}

# Function to stop ttyd
stop() {
    print_header
    if ! is_running; then
        print_warning "TTYD is not running"
        return 1
    fi
    
    print_status "Stopping TTYD..."
    kill $(cat "$TTYD_PID_FILE")
    rm -f "$TTYD_PID_FILE"
    
    if ! is_running; then
        print_status "TTYD stopped successfully!"
    else
        print_error "Failed to stop TTYD"
        return 1
    fi
}

# Function to restart ttyd
restart() {
    print_header
    print_status "Restarting TTYD..."
    stop
    sleep 2
    start
}

# Function to check status
status() {
    print_header
    if is_running; then
        print_status "TTYD is running"
        print_status "PID: $(cat $TTYD_PID_FILE)"
        print_status "Port: $TTYD_PORT"
        print_status "Access URL: http://localhost:$TTYD_PORT"
        print_status "Log file: $TTYD_LOG_FILE"
        
        # Show recent logs
        if [ -f "$TTYD_LOG_FILE" ]; then
            echo ""
            print_status "Recent logs:"
            tail -10 "$TTYD_LOG_FILE" 2>/dev/null || echo "No logs available"
        fi
    else
        print_warning "TTYD is not running"
    fi
}

# Function to show logs
logs() {
    print_header
    if [ -f "$TTYD_LOG_FILE" ]; then
        print_status "Showing TTYD logs:"
        tail -f "$TTYD_LOG_FILE"
    else
        print_warning "No log file found. TTYD may not be running."
    fi
}

# Function to configure ttyd
config() {
    print_header
    print_status "Current TTYD Configuration:"
    echo "Port: $TTYD_PORT"
    echo "Credentials: $TTYD_CREDENTIALS"
    echo "PID File: $TTYD_PID_FILE"
    echo "Log File: $TTYD_LOG_FILE"
    
    echo ""
    read -p "Change port? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter new port (default: 7681): " new_port
        if [ ! -z "$new_port" ]; then
            TTYD_PORT=$new_port
            print_status "Port updated to: $TTYD_PORT"
        fi
    fi
    
    echo ""
    read -p "Change credentials? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter new credentials (format: username:password): " new_creds
        if [ ! -z "$new_creds" ]; then
            TTYD_CREDENTIALS=$new_creds
            print_status "Credentials updated to: $TTYD_CREDENTIALS"
        fi
    fi
}

# Function to show help
show_help() {
    print_header
    echo "Usage: $0 {start|stop|restart|status|logs|config|help}"
    echo ""
    echo "Commands:"
    echo "  start   - Start TTYD terminal sharing service"
    echo "  stop    - Stop TTYD service"
    echo "  restart - Restart TTYD service"
    echo "  status  - Show TTYD status and configuration"
    echo "  logs    - Show TTYD logs in real-time"
    echo "  config  - Configure TTYD settings"
    echo "  help    - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TTYD_PORT        - Port to run on (default: 7681)"
    echo "  TTYD_CREDENTIALS - Username:password (default: admin:panther123)"
    echo ""
    echo "Examples:"
    echo "  TTYD_PORT=8080 $0 start    # Start on port 8080"
    echo "  $0 status                   # Check status"
    echo "  $0 logs                     # View logs"
}

# Main script logic
case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    config)
        config
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Usage: $0 {start|stop|restart|status|logs|config|help}"
        exit 1
        ;;
esac

exit 0


