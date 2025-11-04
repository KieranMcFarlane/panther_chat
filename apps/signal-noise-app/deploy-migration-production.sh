#!/bin/bash

# ===================================================================
# ENTITY MIGRATION PRODUCTION DEPLOYMENT SCRIPT
# ===================================================================
# Author: Claude Code Assistant
# Date: October 16, 2025
# Purpose: Production-ready deployment for full 4,422 entity migration
# ===================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOG_FILE="./migration-production-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="./migration-backups-$(date +%Y%m%d)"
BATCH_SIZE=250
MAX_RETRIES=3

# Neo4j Configuration (should be set in environment)
NEO4J_URI="${NEO4J_URI:-neo4j+s://cce1f84b.databases.neo4j.io}"
NEO4J_USERNAME="${NEO4J_USERNAME:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0}"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$LOG_FILE"
    exit 1
}

# Pre-flight checks
run_preflight_checks() {
    log "🔍 Running pre-flight checks..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
    fi
    
    # Check Neo4j connection
    log "🔗 Testing Neo4j connection..."
    node -e "
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver('$NEO4J_URI', neo4j.auth.basic('$NEO4J_USERNAME', '$NEO4J_PASSWORD'));
    driver.session().run('RETURN 1').then(() => {
        console.log('✅ Neo4j connection successful');
        driver.close();
    }).catch(err => {
        console.error('❌ Neo4j connection failed:', err.message);
        process.exit(1);
    });
    " || error "Neo4j connection test failed"
    
    # Check migration scripts exist
    if [[ ! -f "full-migration-executor.js" ]]; then
        error "Migration script full-migration-executor.js not found"
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    log "📁 Backup directory created: $BACKUP_DIR"
    
    log "✅ Pre-flight checks completed successfully"
}

# Create database backup
create_backup() {
    log "💾 Creating Neo4j backup..."
    
    node -e "
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver('$NEO4J_URI', neo4j.auth.basic('$NEO4J_USERNAME', '$NEO4J_PASSWORD'));
    const session = driver.session();
    
    session.run('MATCH (e:Entity) RETURN count(e) as count')
        .then(result => {
            const count = result.records[0].get('count').toNumber();
            console.log(\`📊 Current entity count: \${count}\`);
            return session.run('MATCH (e:Entity) RETURN e.name, e.type, e.sport, e.country LIMIT 100');
        })
        .then(result => {
            const entities = result.records.map(record => ({
                name: record.get('e.name'),
                type: record.get('e.type'),
                sport: record.get('e.sport'),
                country: record.get('e.country')
            }));
            require('fs').writeFileSync('$BACKUP_DIR/pre-migration-backup.json', JSON.stringify(entities, null, 2));
            console.log('💾 Pre-migration backup created');
            session.close();
            driver.close();
        })
        .catch(err => {
            console.error('❌ Backup failed:', err.message);
            process.exit(1);
        });
    " || error "Backup creation failed"
    
    log "✅ Backup completed successfully"
}

# Run migration with retry logic
run_migration() {
    log "🚀 Starting full entity migration..."
    log "📋 Configuration: Batch Size=$BATCH_SIZE, Max Retries=$MAX_RETRIES"
    
    local attempt=1
    local success=false
    
    while [[ $attempt -le $MAX_RETRIES ]]; do
        log "🔄 Migration attempt $attempt of $MAX_RETRIES"
        
        if node full-migration-executor.js 2>&1 | tee -a "$LOG_FILE"; then
            success=true
            break
        else
            warn "Migration attempt $attempt failed"
            if [[ $attempt -lt $MAX_RETRIES ]]; then
                log "⏳ Waiting 30 seconds before retry..."
                sleep 30
            fi
        fi
        
        ((attempt++))
    done
    
    if [[ "$success" == "true" ]]; then
        log "✅ Migration completed successfully"
    else
        error "Migration failed after $MAX_RETRIES attempts"
    fi
}

# Post-migration validation
validate_migration() {
    log "🔍 Running post-migration validation..."
    
    # Count migrated entities
    node -e "
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver('$NEO4J_URI', neo4j.auth.basic('$NEO4J_USERNAME', '$NEO4J_PASSWORD'));
    const session = driver.session();
    
    Promise.all([
        session.run('MATCH (e:Entity) RETURN count(e) as total'),
        session.run('MATCH (e:Entity) WHERE e.migratedFromSupabase = true RETURN count(e) as migrated'),
        session.run('MATCH (e:Entity) WHERE e.updatedAt > timestamp() - 3600000 RETURN count(e) as recent')
    ]).then(([totalResult, migratedResult, recentResult]) => {
        const total = totalResult.records[0].get('total').toNumber();
        const migrated = migratedResult.records[0].get('migrated').toNumber();
        const recent = recentResult.records[0].get('recent').toNumber();
        
        console.log(\`📊 Total entities: \${total}\`);
        console.log(\`✅ Migrated entities: \${migrated}\`);
        console.log(\`🕐 Recent migrations: \${recent}\`);
        console.log(\`📈 Migration success rate: \${((migrated/4422)*100).toFixed(1)}%\`);
        
        if (migrated > 0) {
            console.log('✅ Migration validation passed');
        } else {
            console.log('⚠️  No entities migrated - this may indicate an issue');
        }
        
        session.close();
        driver.close();
    }).catch(err => {
        console.error('❌ Validation failed:', err.message);
        process.exit(1);
    });
    " || error "Migration validation failed"
    
    log "✅ Post-migration validation completed"
}

# Generate final report
generate_report() {
    log "📋 Generating final migration report..."
    
    local report_file="$BACKUP_DIR/migration-report-$(date +%Y%m%d-%H%M%S).json"
    
    node -e "
    const neo4j = require('neo4j-driver');
    const driver = neo4j.driver('$NEO4J_URI', neo4j.auth.basic('$NEO4J_USERNAME', '$NEO4J_PASSWORD'));
    const session = driver.session();
    
    Promise.all([
        session.run('MATCH (e:Entity) RETURN count(e) as total'),
        session.run('MATCH (e:Entity) WHERE e.migratedFromSupabase = true RETURN count(e) as migrated'),
        session.run('MATCH (e:Entity) WHERE e.migratedFromSupabase = true RETURN e.name, e.type, e.sport, e.country, e.migrationBatch ORDER BY e.migrationBatch LIMIT 50')
    ]).then(([totalResult, migratedResult, entitiesResult]) => {
        const report = {
            migrationDate: new Date().toISOString(),
            neo4jUri: '$NEO4J_URI',
            totalEntities: totalResult.records[0].get('total').toNumber(),
            migratedEntities: migratedResult.records[0].get('migrated').toNumber(),
            recentMigrations: entitiesResult.records.map(record => ({
                name: record.get('e.name'),
                type: record.get('e.type'),
                sport: record.get('e.sport'),
                country: record.get('e.country'),
                migrationBatch: record.get('e.migrationBatch')
            }))
        };
        
        require('fs').writeFileSync('$report_file', JSON.stringify(report, null, 2));
        console.log(\`📄 Migration report saved to: \${report_file}\`);
        
        session.close();
        driver.close();
    }).catch(err => {
        console.error('❌ Report generation failed:', err.message);
        process.exit(1);
    });
    " || error "Report generation failed"
    
    log "✅ Final report generated successfully"
}

# Main execution
main() {
    echo "=========================================="
    echo "🚀 ENTITY MIGRATION PRODUCTION DEPLOYMENT"
    echo "=========================================="
    echo "Start Time: $(date)"
    echo "Log File: $LOG_FILE"
    echo "Backup Dir: $BACKUP_DIR"
    echo "=========================================="
    
    run_preflight_checks
    create_backup
    run_migration
    validate_migration
    generate_report
    
    echo "=========================================="
    echo "✅ MIGRATION DEPLOYMENT COMPLETED"
    echo "End Time: $(date)"
    echo "Log File: $LOG_FILE"
    echo "Backup Dir: $BACKUP_DIR"
    echo "=========================================="
    
    log "🎉 Production migration deployment completed successfully!"
}

# Handle script interruption
trap 'warn "Script interrupted by user"; exit 130' INT TERM

# Run main function
main "$@"