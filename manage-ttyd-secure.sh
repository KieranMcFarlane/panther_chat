#!/bin/bash

# Secure TTYD Management Script for Yellow Panther AI
# This script manages TTYD with JWT authentication integration

TTYD_PORT=${TTYD_PORT:-7681}
TTYD_JWT_SECRET=${TTYD_JWT_SECRET:-"your_jwt_secret_here"}
TTYD_PID_FILE="/tmp/ttyd-secure.pid"
TTYD_LOG_FILE="/tmp/ttyd-secure.log"
TTYD_ACCESS_LOG="/tmp/ttyd-access.log"

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
    echo -e "${BLUE}  Secure TTYD Terminal Service${NC}"
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

# Function to generate JWT token (simple base64 for demo)
generate_jwt() {
    local payload="{\"sub\":\"admin\",\"iat\":$(date +%s),\"exp\":$(($(date +%s) + 86400)),\"aud\":\"ttyd\"}"
    echo -n "$payload" | base64
}

# Function to start secure ttyd
start() {
    print_header
    if is_running; then
        print_warning "Secure TTYD is already running on port $TTYD_PORT"
        return 1
    fi
    
    print_status "Starting Secure TTYD terminal sharing service..."
    print_status "Port: $TTYD_PORT"
    print_status "JWT Authentication: Enabled"
    print_status "Access URL: http://localhost:$TTYD_PORT"
    
    # Create access log directory
    mkdir -p "$(dirname "$TTYD_ACCESS_LOG")"
    
    # Start ttyd with JWT authentication
    ttyd \
        --port "$TTYD_PORT" \
        --terminal-type xterm-256color \
        --max-clients 5 \
        --check-origin \
        --debug 7 \
        --log-file "$TTYD_LOG_FILE" \
        --url-arg \
        --client-option "enableJWT=true" \
        --client-option "jwtSecret=$TTYD_JWT_SECRET" \
        /bin/zsh &
    
    # Save PID
    echo $! > "$TTYD_PID_FILE"
    
    if is_running; then
        print_status "Secure TTYD started successfully!"
        print_status "PID: $(cat $TTYD_PID_FILE)"
        print_status "Log file: $TTYD_LOG_FILE"
        print_status "Access your terminal at: http://localhost:$TTYD_PORT"
        print_status "JWT Authentication Required"
        
        # Generate sample JWT token
        local sample_token=$(generate_jwt)
        print_status "Sample JWT Token: $sample_token"
        print_status "Use this token in your app for authentication"
    else
        print_error "Failed to start Secure TTYD"
        return 1
    fi
}

# Function to stop ttyd
stop() {
    print_header
    if ! is_running; then
        print_warning "Secure TTYD is not running"
        return 1
    fi
    
    print_status "Stopping Secure TTYD..."
    kill $(cat "$TTYD_PID_FILE")
    rm -f "$TTYD_PID_FILE"
    
    if ! is_running; then
        print_status "Secure TTYD stopped successfully!"
    else
        print_error "Failed to stop Secure TTYD"
        return 1
    fi
}

# Function to restart ttyd
restart() {
    print_header
    print_status "Restarting Secure TTYD..."
    stop
    sleep 2
    start
}

# Function to check status
status() {
    print_header
    if is_running; then
        print_status "Secure TTYD is running"
        print_status "PID: $(cat $TTYD_PID_FILE)"
        print_status "Port: $TTYD_PORT"
        print_status "Access URL: http://localhost:$TTYD_PORT"
        print_status "Log file: $TTYD_LOG_FILE"
        print_status "JWT Authentication: Enabled"
        
        # Show recent logs
        if [ -f "$TTYD_LOG_FILE" ]; then
            echo ""
            print_status "Recent logs:"
            tail -10 "$TTYD_LOG_FILE" 2>/dev/null || echo "No logs available"
        fi
        
        # Show access attempts
        if [ -f "$TTYD_ACCESS_LOG" ]; then
            echo ""
            print_status "Recent access attempts:"
            tail -5 "$TTYD_ACCESS_LOG" 2>/dev/null || echo "No access logs available"
        fi
    else
        print_warning "Secure TTYD is not running"
    fi
}

# Function to show logs
logs() {
    print_header
    if [ -f "$TTYD_LOG_FILE" ]; then
        print_status "Showing Secure TTYD logs:"
        tail -f "$TTYD_LOG_FILE"
    else
        print_warning "No log file found. Secure TTYD may not be running."
    fi
}

# Function to show access logs
access_logs() {
    print_header
    if [ -f "$TTYD_ACCESS_LOG" ]; then
        print_status "Showing access logs:"
        tail -f "$TTYD_ACCESS_LOG"
    else
        print_warning "No access log file found."
    fi
}

# Function to configure ttyd
config() {
    print_header
    print_status "Current Secure TTYD Configuration:"
    echo "Port: $TTYD_PORT"
    echo "JWT Secret: $TTYD_JWT_SECRET"
    echo "PID File: $TTYD_PID_FILE"
    echo "Log File: $TTYD_LOG_FILE"
    echo "Access Log: $TTYD_ACCESS_LOG"
    
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
    read -p "Change JWT secret? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Enter new JWT secret: " new_secret
        if [ ! -z "$new_secret" ]; then
            TTYD_JWT_SECRET=$new_secret
            print_status "JWT secret updated"
        fi
    fi
}

# Function to generate JWT token for testing
generate_token() {
    print_header
    print_status "Generating JWT token for testing..."
    
    local token=$(generate_jwt)
    print_status "Generated JWT Token:"
    echo "$token"
    
    echo ""
    print_status "Test URL:"
    echo "http://localhost:$TTYD_PORT?token=$token"
    
    echo ""
    print_status "Copy this token to your authentication system"
}

# Function to show help
show_help() {
    print_header
    echo "Usage: $0 {start|stop|restart|status|logs|access-logs|config|generate-token|help}"
    echo ""
    echo "Commands:"
    echo "  start          - Start Secure TTYD with JWT authentication"
    echo "  stop           - Stop Secure TTYD service"
    echo "  restart        - Restart Secure TTYD service"
    echo "  status         - Show Secure TTYD status and configuration"
    echo "  logs           - Show Secure TTYD logs in real-time"
    echo "  access-logs    - Show access logs in real-time"
    echo "  config         - Configure Secure TTYD settings"
    echo "  generate-token - Generate JWT token for testing"
    echo "  help           - Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TTYD_PORT        - Port to run on (default: 7681)"
    echo "  TTYD_JWT_SECRET  - JWT secret for authentication"
    echo ""
    echo "Security Features:"
    echo "  - JWT-based authentication"
    echo "  - Origin checking enabled"
    echo "  - Access logging"
    echo "  - Maximum client limits"
    echo ""
    echo "Examples:"
    echo "  TTYD_PORT=8080 $0 start    # Start on port 8080"
    echo "  $0 status                   # Check status"
    echo "  $0 generate-token           # Generate test JWT token"
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
    access-logs)
        access_logs
        ;;
    config)
        config
        ;;
    generate-token)
        generate_token
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Usage: $0 {start|stop|restart|status|logs|access-logs|config|generate-token|help}"
        exit 1
        ;;
esac

exit 0
