#!/usr/bin/env node

const neo4j = require('neo4j-driver');

// Configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';

class SimpleEntityMonitor {
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
            const result = await session.run('MATCH (e:Entity) RETURN count(e) as total');
            const total = result.records[0].get('total').toNumber();
            
            const migratedResult = await session.run('MATCH (e:Entity) WHERE e.migratedFromSupabase = true RETURN count(e) as migrated');
            const migrated = migratedResult.records[0].get('migrated').toNumber();
            
            return {
                total,
                migrated,
                migrationRate: ((migrated / total) * 100).toFixed(1)
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
                LIMIT 10
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
    async getEntitiesBySport() {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WHERE e.sport IS NOT NULL AND e.sport <> ''
                RETURN e.sport as sport, count(e) as count
                ORDER BY count DESC
                LIMIT 10
            `);
            
            return result.records.map(record => ({
                sport: record.get('sport'),
                count: record.get('count').toNumber()
            }));
        } finally {
            await session.close();
        }
    }

    // Get recent migration activity
    async getRecentMigrationActivity() {
        const session = await this.getSession();
        try {
            const result = await session.run(`
                MATCH (e:Entity)
                WHERE e.migratedFromSupabase = true 
                  AND e.updatedAt > timestamp() - 86400000
                RETURN 
                    e.migrationBatch as batch,
                    count(e) as migrated_in_batch
                ORDER BY batch DESC
                LIMIT 5
            `);
            
            return result.records.map(record => {
                const batch = record.get('batch');
                const count = record.get('migrated_in_batch');
                return {
                    batch: (batch && batch.toNumber) ? batch.toNumber() : (parseInt(batch) || 0),
                    count: (count && count.toNumber) ? count.toNumber() : (parseInt(count) || 0)
                };
            });
        } finally {
            await session.close();
        }
    }

    // Get data quality issues
    async getDataQualityIssues() {
        const session = await this.getSession();
        try {
            const queries = [
                { name: 'Entities without names', query: 'MATCH (e:Entity) WHERE e.name IS NULL OR e.name = "" RETURN count(e) as count' },
                { name: 'Entities without types', query: 'MATCH (e:Entity) WHERE e.type IS NULL OR e.type = "" RETURN count(e) as count' },
                { name: 'Entities without sports', query: 'MATCH (e:Entity) WHERE e.sport IS NULL OR e.sport = "" RETURN count(e) as count' },
                { name: 'Entities without countries', query: 'MATCH (e:Entity) WHERE e.country IS NULL OR e.country = "" RETURN count(e) as count' }
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

    // Generate simplified dashboard report
    async generateDashboardReport() {
        console.log('🔍 Generating Entity Management Dashboard...\n');
        
        const [
            stats,
            byType,
            bySport,
            recentActivity,
            qualityIssues
        ] = await Promise.all([
            this.getEntityStats(),
            this.getEntitiesByType(),
            this.getEntitiesBySport(),
            this.getRecentMigrationActivity(),
            this.getDataQualityIssues()
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
        console.log(`Migrated from Supabase: ${stats.migrated} (${stats.migrationRate}%)`);
        console.log('');

        // Entity Types
        console.log('🏷️  TOP ENTITY TYPES');
        console.log('-'.repeat(30));
        byType.forEach(item => {
            console.log(`${item.type.padEnd(20)} ${item.count.toLocaleString()}`);
        });
        console.log('');

        // Top Sports
        console.log('⚽ TOP SPORTS');
        console.log('-'.repeat(30));
        bySport.forEach(item => {
            console.log(`${item.sport.padEnd(25)} ${item.count.toLocaleString()}`);
        });
        console.log('');

        // Recent Migration Activity
        if (recentActivity.length > 0) {
            console.log('🔄 RECENT MIGRATION ACTIVITY');
            console.log('-'.repeat(30));
            recentActivity.forEach(activity => {
                console.log(`Batch ${activity.batch}: ${activity.count} entities`);
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

        // System Health
        console.log('🏥 SYSTEM HEALTH');
        console.log('-'.repeat(30));
        const healthScore = Math.round(
            ((stats.total - Object.values(qualityIssues).reduce((a, b) => a + b, 0)) / stats.total) * 100
        );
        console.log(`Data Quality Score:    ${healthScore}%`);
        console.log(`Migration Status:      ${stats.migrated > 0 ? '✅ Active' : '⚠️  Inactive'}`);
        console.log('');

        return {
            timestamp: new Date().toISOString(),
            stats,
            byType,
            bySport,
            recentActivity,
            qualityIssues,
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
    const monitor = new SimpleEntityMonitor();
    
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

module.exports = SimpleEntityMonitor;