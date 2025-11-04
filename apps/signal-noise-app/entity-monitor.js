#!/usr/bin/env node

const neo4j = require('neo4j-driver');

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

class EntityMonitor {
    constructor() {
        this.driver = neo4j.driver(
            NEO4J_URI,
            neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
        );
    }

    async close() {
        await this.driver.close();
    }

    async getSession() {
        return this.driver.session();
    }

    // Get overall entity statistics
    async getEntityStats() {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WITH 
                    count(e) as total,
                    count(DISTINCT e.sport) as sports,
                    count(DISTINCT e.country) as countries,
                    count(DISTINCT e.type) as types,
                    count(e) as all_entities
                OPTIONAL MATCH (m:Entity) WHERE m.migratedFromSupabase = true
                OPTIONAL MATCH (en:Entity) WHERE en.enrichedAt IS NOT NULL
                RETURN 
                    total,
                    sports,
                    countries,
                    types,
                    count(DISTINCT m) as migrated,
                    count(DISTINCT en) as enriched
            `);
            
            const stats = result.records[0];
            return {
                total: stats.get('total').toNumber(),
                sports: stats.get('sports').toNumber(),
                countries: stats.get('countries').toNumber(),
                types: stats.get('types').toNumber(),
                migrated: stats.get('migrated').toNumber(),
                enriched: stats.get('enriched').toNumber(),
                migrationRate: ((stats.get('migrated').toNumber() / stats.get('total').toNumber()) * 100).toFixed(1),
                enrichmentRate: ((stats.get('enriched').toNumber() / stats.get('total').toNumber()) * 100).toFixed(1)
            };
        } finally {
            await session.close();
        }
    }

    // Get entities by type
    async getEntitiesByType() {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WHERE e.type IS NOT NULL
                RETURN e.type as type, count(e) as count
                ORDER BY count DESC
            `);
            
            return result.records.map(record => ({
                type: record.get('type'),
                count: record.get('count').toNumber()
            }));
        } finally {
            await session.close();
        }
    }

    // Get entities by sport
    async getEntitiesBySport(limit = 20) {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WHERE e.sport IS NOT NULL AND e.sport <> ''
                RETURN e.sport as sport, count(e) as count
                ORDER BY count DESC
                LIMIT $limit
            `, { limit: parseInt(limit) });
            
            return result.records.map(record => ({
                sport: record.get('sport'),
                count: record.get('count').toNumber()
            }));
        } finally {
            await session.close();
        }
    }

    // Get recent migration activity
    async getRecentMigrationActivity(hours = 24) {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WHERE e.migratedFromSupabase = true 
                  AND e.updatedAt > timestamp() - $timeThreshold
                RETURN 
                    e.migrationBatch as batch,
                    count(e) as migrated_in_batch,
                    min(e.updatedAt) as batch_start,
                    max(e.updatedAt) as batch_end
                ORDER BY batch DESC
            `, { timeThreshold: hours * 3600 * 1000 });
            
            return result.records.map(record => {
                const batch = record.get('batch');
                const count = record.get('migrated_in_batch');
                const startTime = record.get('batch_start');
                const endTime = record.get('batch_end');
                
                return {
                    batch: (batch && batch.toNumber) ? batch.toNumber() : (parseInt(batch) || 0),
                    count: (count && count.toNumber) ? count.toNumber() : (parseInt(count) || 0),
                    startTime: (startTime && startTime.toNumber) ? new Date(startTime.toNumber()) : new Date(),
                    endTime: (endTime && endTime.toNumber) ? new Date(endTime.toNumber()) : new Date()
                };
            });
        } finally {
            await session.close();
        }
    }

    // Identify data quality issues
    async getDataQualityIssues() {
        const session = await this.getSession();
        try {
            const queries = [
                {
                    name: 'Entities without names',
                    query: 'MATCH (e:Entity) WHERE e.name IS NULL OR e.name = "" RETURN count(e) as count'
                },
                {
                    name: 'Entities without types',
                    query: 'MATCH (e:Entity) WHERE e.type IS NULL OR e.type = "" RETURN count(e) as count'
                },
                {
                    name: 'Entities without sports',
                    query: 'MATCH (e:Entity) WHERE e.sport IS NULL OR e.sport = "" RETURN count(e) as count'
                },
                {
                    name: 'Entities without countries',
                    query: 'MATCH (e:Entity) WHERE e.country IS NULL OR e.country = "" RETURN count(e) as count'
                },
                {
                    name: 'Potential duplicate names',
                    query: 'MATCH (e:Entity) WITH e.name as name, collect(e) as entities WHERE size(entities) > 1 RETURN count(name) as duplicate_groups'
                }
            ];

            const issues = {};
            for (const { name, query } of queries) {
                const result = await session.run(query);
                issues[name] = result.records[0].get('count').toNumber();
            }

            return issues;
        } finally {
            await session.close();
        }
    }

    // Get enrichment statistics
    async getEnrichmentStats() {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WITH count(e) as total
                OPTIONAL MATCH (en:Entity) WHERE en.enrichedAt IS NOT NULL
                OPTIONAL MATCH (dp:Entity) WHERE dp.digitalPresence IS NOT NULL
                OPTIONAL MATCH (ws:Entity) WHERE ws.website <> ""
                OPTIONAL MATCH (li:Entity) WHERE li.linkedin <> ""
                RETURN 
                    total,
                    count(DISTINCT en) as enriched,
                    count(DISTINCT dp) as has_digital_presence,
                    count(DISTINCT ws) as has_website,
                    count(DISTINCT li) as has_linkedin
            `);
            
            const stats = result.records[0];
            return {
                total: stats.get('total').toNumber(),
                enriched: stats.get('enriched').toNumber(),
                hasDigitalPresence: stats.get('has_digital_presence').toNumber(),
                hasWebsite: stats.get('has_website').toNumber(),
                hasLinkedin: stats.get('has_linkedin').toNumber(),
                enrichmentRate: ((stats.get('enriched').toNumber() / stats.get('total').toNumber()) * 100).toFixed(1)
            };
        } finally {
            await session.close();
        }
    }

    // Generate comprehensive dashboard report
    async generateDashboardReport() {
        console.log('🔍 Generating Entity Management Dashboard...\n');
        
        const [
            stats,
            byType,
            bySport,
            recentActivity,
            qualityIssues,
            enrichmentStats
        ] = await Promise.all([
            this.getEntityStats(),
            this.getEntitiesByType(),
            this.getEntitiesBySport(),
            this.getRecentMigrationActivity(),
            this.getDataQualityIssues(),
            this.getEnrichmentStats()
        ]);

        // Header
        console.log('='.repeat(60));
        console.log('📊 ENTITY MANAGEMENT DASHBOARD');
        console.log('='.repeat(60));
        console.log(`Generated: ${new Date().toLocaleString()}`);
        console.log('');

        // Overall Statistics
        console.log('📈 OVERALL STATISTICS');
        console.log('-'.repeat(30));
        console.log(`Total Entities:        ${stats.total.toLocaleString()}`);
        console.log(`Sports:                ${stats.sports}`);
        console.log(`Countries:             ${stats.countries}`);
        console.log(`Entity Types:          ${stats.types}`);
        console.log(`Migrated from Supabase: ${stats.migrated} (${stats.migrationRate}%)`);
        console.log(`Enriched Entities:     ${stats.enriched} (${stats.enrichmentRate}%)`);
        console.log('');

        // Entity Types
        console.log('🏷️  TOP ENTITY TYPES');
        console.log('-'.repeat(30));
        byType.slice(0, 10).forEach(item => {
            console.log(`${item.type.padEnd(20)} ${item.count.toLocaleString()}`);
        });
        console.log('');

        // Top Sports
        console.log('⚽ TOP SPORTS');
        console.log('-'.repeat(30));
        bySport.slice(0, 10).forEach(item => {
            console.log(`${item.sport.padEnd(25)} ${item.count.toLocaleString()}`);
        });
        console.log('');

        // Recent Migration Activity
        if (recentActivity.length > 0) {
            console.log('🔄 RECENT MIGRATION ACTIVITY');
            console.log('-'.repeat(30));
            recentActivity.forEach(activity => {
                const duration = Math.round((activity.endTime - activity.startTime) / 1000);
                console.log(`Batch ${activity.batch}: ${activity.count} entities (${duration}s)`);
            });
            console.log('');
        }

        // Data Quality Issues
        console.log('⚠️  DATA QUALITY ISSUES');
        console.log('-'.repeat(30));
        let hasIssues = false;
        Object.entries(qualityIssues).forEach(([issue, count]) => {
            if (count > 0) {
                console.log(`${issue}: ${count}`);
                hasIssues = true;
            }
        });
        if (!hasIssues) {
            console.log('✅ No data quality issues detected');
        }
        console.log('');

        // Enrichment Statistics
        console.log('🎯 ENRICHMENT STATISTICS');
        console.log('-'.repeat(30));
        console.log(`Total Enriched:        ${enrichmentStats.enriched.toLocaleString()} (${enrichmentStats.enrichmentRate}%)`);
        console.log(`Digital Presence Data:  ${enrichmentStats.hasDigitalPresence.toLocaleString()}`);
        console.log(`Has Website:           ${enrichmentStats.hasWebsite.toLocaleString()}`);
        console.log(`Has LinkedIn:           ${enrichmentStats.hasLinkedin.toLocaleString()}`);
        console.log('');

        // System Health
        console.log('🏥 SYSTEM HEALTH');
        console.log('-'.repeat(30));
        const healthScore = Math.round(
            ((stats.total - Object.values(qualityIssues).reduce((a, b) => a + b, 0)) / stats.total) * 100
        );
        console.log(`Data Quality Score:    ${healthScore}%`);
        console.log(`Migration Status:      ${stats.migrated > 0 ? '✅ Active' : '⚠️  Inactive'}`);
        console.log(`Enrichment Status:     ${enrichmentStats.enrichmentRate > 50 ? '✅ Good' : '⚠️  Needs attention'}`);
        console.log('');

        return {
            timestamp: new Date().toISOString(),
            stats,
            byType,
            bySport,
            recentActivity,
            qualityIssues,
            enrichmentStats,
            healthScore
        };
    }

    // Export dashboard data to JSON
    async exportDashboardData(filePath = './entity-dashboard-data.json') {
        const data = await this.generateDashboardReport();
        require('fs').writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`📄 Dashboard data exported to: ${filePath}`);
        return data;
    }
}

// Command line interface
if (require.main === module) {
    const monitor = new EntityMonitor();
    
    const command = process.argv[2] || 'dashboard';
    
    switch (command) {
        case 'dashboard':
            monitor.generateDashboardReport()
                .then(() => monitor.close())
                .catch(err => {
                    console.error('❌ Dashboard generation failed:', err);
                    monitor.close();
                    process.exit(1);
                });
            break;
            
        case 'export':
            const filePath = process.argv[3] || './entity-dashboard-data.json';
            monitor.exportDashboardData(filePath)
                .then(() => monitor.close())
                .catch(err => {
                    console.error('❌ Export failed:', err);
                    monitor.close();
                    process.exit(1);
                });
            break;
            
        case 'stats':
            monitor.getEntityStats()
                .then(stats => {
                    console.log(JSON.stringify(stats, null, 2));
                    return monitor.close();
                })
                .catch(err => {
                    console.error('❌ Stats fetch failed:', err);
                    monitor.close();
                    process.exit(1);
                });
            break;
            
        case 'quality':
            monitor.getDataQualityIssues()
                .then(issues => {
                    console.log('Data Quality Issues:');
                    console.log(JSON.stringify(issues, null, 2));
                    return monitor.close();
                })
                .catch(err => {
                    console.error('❌ Quality check failed:', err);
                    monitor.close();
                    process.exit(1);
                });
            break;
            
        default:
            console.log('Available commands:');
            console.log('  dashboard    - Generate full dashboard report');
            console.log('  export       - Export dashboard data to JSON');
            console.log('  stats        - Get basic statistics');
            console.log('  quality      - Check data quality issues');
            monitor.close();
    }
}

module.exports = EntityMonitor;