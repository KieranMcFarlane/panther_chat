#!/bin/bash

# 📊 RFP Autonomous System Monitor
# ================================
# 
# Monitors system health, performance, and autonomous operations
# Runs every 5 minutes via cron

LOG_FILE="/var/log/rfp-autonomous-monitor.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')
APP_DIR="/opt/rfp-autonomous"

# Function to log with timestamp
log() {
    echo "[$DATE] $1" >> "$LOG_FILE"
}

# Function to check PM2 processes
check_pm2() {
    local pm2_status
    pm2_status=$(pm2 jlist | jq '.[] | select(.name == "rfp-autonomous") | .pm2_env.status' 2>/dev/null | grep -c "online" || echo "0")
    
    if [ "$pm2_status" -eq 0 ]; then
        log "ERROR: No PM2 rfp-autonomous processes running"
        pm2 restart rfp-autonomous
        log "ACTION: Restarted rfp-autonomous PM2 processes"
    else
        log "OK: $pm2_status PM2 processes running"
    fi
}

# Function to check disk space
check_disk_space() {
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ "$disk_usage" -gt 85 ]; then
        log "WARNING: Disk usage critical at ${disk_usage}%"
        # Clean up old logs
        find /var/log -name "rfp-autonomous*.log" -mtime +7 -delete 2>/dev/null
        log "ACTION: Cleaned up old log files"
    elif [ "$disk_usage" -gt 70 ]; then
        log "WARNING: Disk usage high at ${disk_usage}%"
    else
        log "OK: Disk usage at ${disk_usage}%"
    fi
}

# Function to check memory usage
check_memory() {
    local mem_usage
    mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    
    if [ "$mem_usage" -gt 85 ]; then
        log "WARNING: Memory usage critical at ${mem_usage}%"
        pm2 restart rfp-autonomous
        log "ACTION: Restarted processes to free memory"
    elif [ "$mem_usage" -gt 70 ]; then
        log "WARNING: Memory usage high at ${mem_usage}%"
    else
        log "OK: Memory usage at ${mem_usage}%"
    fi
}

# Function to check application health
check_application_health() {
    if curl -f -s http://localhost:3000/api/health > /dev/null 2>&1; then
        log "OK: Application health check passed"
    else
        log "ERROR: Application health check failed"
        pm2 restart rfp-autonomous
        log "ACTION: Restarted application due to health check failure"
    fi
}

# Function to check autonomous agents
check_autonomous_agents() {
    # Check if autonomous verification endpoint responds
    if curl -f -s "http://localhost:3000/api/verification?check=autonomous" > /dev/null 2>&1; then
        log "OK: Autonomous agents verification passed"
    else
        log "WARNING: Autonomous agents may not be functioning properly"
    fi
}

# Function to check database connections
check_databases() {
    # Check if verification includes database checks
    local db_check
    db_check=$(curl -s "http://localhost:3000/api/verification?check=database" 2>/dev/null | grep -o '"database":"ok"' || echo "")
    
    if [ -n "$db_check" ]; then
        log "OK: Database connections working"
    else
        log "WARNING: Database connections may have issues"
    fi
}

# Function to check SSL certificate
check_ssl_certificate() {
    if [ -f "/etc/letsencrypt/live/$(hostname)/fullchain.pem" ]; then
        local expiry
        expiry=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/$(hostname)/fullchain.pem" | cut -d= -f2)
        local expiry_epoch
        expiry_epoch=$(date -d "$expiry" +%s)
        local current_epoch
        current_epoch=$(date +%s)
        local days_left
        days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
        
        if [ "$days_left" -lt 7 ]; then
            log "WARNING: SSL certificate expires in $days_left days"
        else
            log "OK: SSL certificate valid for $days_left days"
        fi
    else
        log "INFO: No SSL certificate found (HTTP only)"
    fi
}

# Function to log system metrics
log_system_metrics() {
    # Record key metrics for monitoring
    local cpu_load
    cpu_load=$(uptime | cut -d' ' -f12 | cut -d',' -f1)
    local mem_usage
    mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    local disk_usage
    disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    
    log "METRICS: CPU=$cpu_load, MEM=${mem_usage}%, DISK=${disk_usage}%"
}

# Main monitoring logic
main() {
    # Skip if already running
    if pgrep -f "rfp-monitor" | grep -v $$ > /dev/null; then
        exit 0
    fi
    
    log "=== Starting system monitoring check ==="
    
    check_pm2
    check_disk_space
    check_memory
    check_application_health
    check_autonomous_agents
    check_databases
    check_ssl_certificate
    log_system_metrics
    
    log "=== System monitoring check completed ==="
}

# Run main function
main "$@"