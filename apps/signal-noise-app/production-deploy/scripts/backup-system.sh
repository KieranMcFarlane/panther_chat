#!/bin/bash

# 💾 RFP Autonomous System Backup
# ===============================
# 
# Creates automated backups of application, data, and configuration
# Runs daily at 2 AM via cron

BACKUP_DIR="/opt/backups/rfp-autonomous"
APP_DIR="/opt/rfp-autonomous"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="backup_${DATE}.tar.gz"
RETENTION_DAYS=7

# Function to log with timestamp
log() {
    echo "[$DATE] $1"
}

# Function to create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    log "Created backup directory: $BACKUP_DIR"
}

# Function to backup application files
backup_application() {
    log "Starting application backup..."
    
    tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
        -C /opt \
        rfp-autonomous \
        --exclude=rfp-autonomous/node_modules \
        --exclude=rfp-autonomous/.next \
        --exclude=rfp-autonomous/*.log \
        --exclude=rfp-autonomous/.git \
        --exclude=rfp-autonomous/tmp \
        2>/dev/null
    
    if [ $? -eq 0 ]; then
        log "Application backup completed: ${BACKUP_DIR}/${BACKUP_FILE}"
        
        # Get backup size
        local backup_size
        backup_size=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
        log "Backup size: $backup_size"
    else
        log "ERROR: Application backup failed"
        return 1
    fi
}

# Function to backup environment configuration
backup_config() {
    log "Backing up environment configuration..."
    
    if [ -f "$APP_DIR/.env.production" ]; then
        cp "$APP_DIR/.env.production" "${BACKUP_DIR}/env-production_${DATE}.backup"
        log "Environment configuration backed up"
    fi
    
    if [ -f "$APP_DIR/ecosystem.config.js" ]; then
        cp "$APP_DIR/ecosystem.config.js" "${BACKUP_DIR}/ecosystem_${DATE}.backup"
        log "PM2 configuration backed up"
    fi
}

# Function to backup logs (last 24 hours)
backup_logs() {
    log "Backing up recent logs..."
    
    # Create log backup directory
    mkdir -p "${BACKUP_DIR}/logs_${DATE}"
    
    # Copy recent logs
    if [ -f "/var/log/rfp-autonomous.log" ]; then
        tail -n 1000 "/var/log/rfp-autonomous.log" > "${BACKUP_DIR}/logs_${DATE}/rfp-autonomous.log"
    fi
    
    if [ -f "/var/log/rfp-autonomous-monitor.log" ]; then
        tail -n 1000 "/var/log/rfp-autonomous-monitor.log" > "${BACKUP_DIR}/logs_${DATE}/rfp-autonomous-monitor.log"
    fi
    
    # Compress logs
    tar -czf "${BACKUP_DIR}/logs_${DATE}.tar.gz" -C "$BACKUP_DIR" "logs_${DATE}"
    rm -rf "${BACKUP_DIR}/logs_${DATE}"
    
    log "Log backup completed"
}

# Function to backup database schemas
backup_schemas() {
    log "Backing up database schemas..."
    
    if [ -f "$APP_DIR/supabase-schema-level3.sql" ]; then
        cp "$APP_DIR/supabase-schema-level3.sql" "${BACKUP_DIR}/supabase-schema_${DATE}.sql"
        log "Supabase schema backed up"
    fi
    
    if [ -f "$APP_DIR/neo4j-schema-level3.cypher" ]; then
        cp "$APP_DIR/neo4j-schema-level3.cypher" "${BACKUP_DIR}/neo4j-schema_${DATE}.cypher"
        log "Neo4j schema backed up"
    fi
}

# Function to create backup manifest
create_manifest() {
    log "Creating backup manifest..."
    
    cat > "${BACKUP_DIR}/manifest_${DATE}.json" << MANIFESTEOF
{
    "backup_date": "$DATE",
    "backup_file": "$BACKUP_FILE",
    "backup_type": "automated_daily",
    "system_info": {
        "hostname": "$(hostname)",
        "kernel": "$(uname -r)",
        "uptime": "$(uptime -p)",
        "disk_usage": "$(df -h / | tail -1 | awk '{print $4 " / " $2}')",
        "memory_usage": "$(free -h | grep '^Mem:' | awk '{print $3 " / " $2}')"
    },
    "application_info": {
        "node_version": "$(node --version)",
        "npm_version": "$(npm --version)",
        "pm2_version": "$(pm2 --version)",
        "pm2_status": "$(pm2 list | grep 'rfp-autonomous' | awk '{print $10}' | tr '\n' ' ' | sed 's/ $//')"
    },
    "backup_components": {
        "application_files": true,
        "configuration": true,
        "recent_logs": true,
        "database_schemas": true
    },
    "retention_policy": {
        "days_kept": $RETENTION_DAYS,
        "cleanup_date": "$(date -d "+${RETENTION_DAYS} days" '+%Y-%m-%d')"
    }
}
MANIFESTEOF
    
    log "Backup manifest created"
}

# Function to cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups (older than $RETENTION_DAYS days)..."
    
    local removed_count
    removed_count=$(find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
    
    # Remove associated files
    find "$BACKUP_DIR" -name "env-production_*.backup" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "ecosystem_*.backup" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "logs_*.tar.gz" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "supabase-schema_*.sql" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "neo4j-schema_*.cypher" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "manifest_*.json" -mtime +$RETENTION_DAYS -delete
    
    log "Removed $removed_count old backup files"
}

# Function to verify backup integrity
verify_backup() {
    if [ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
        if tar -tzf "${BACKUP_DIR}/${BACKUP_FILE}" >/dev/null 2>&1; then
            log "Backup integrity verified"
            return 0
        else
            log "ERROR: Backup integrity check failed"
            return 1
        fi
    else
        log "ERROR: Backup file not found"
        return 1
    fi
}

# Function to send backup notification (optional)
send_notification() {
    # This is a placeholder for backup notifications
    # You could integrate with Slack, email, or other notification systems
    
    local backup_size
    backup_size=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    
    log "Backup notification: Successfully created backup ${BACKUP_FILE} (${backup_size})"
}

# Main backup logic
main() {
    # Skip if already running
    if pgrep -f "rfp-backup" | grep -v $$ > /dev/null; then
        log "Backup already running, exiting"
        exit 0
    fi
    
    log "=== Starting automated backup ==="
    
    create_backup_dir
    backup_application || exit 1
    backup_config
    backup_logs
    backup_schemas
    create_manifest
    
    if verify_backup; then
        cleanup_old_backups
        send_notification
        log "=== Backup completed successfully ==="
    else
        log "=== Backup completed with errors ==="
        exit 1
    fi
}

# Run main function
main "$@"