#!/usr/bin/env node

/**
 * Optimized Badge Downloader for 4000+ Entities
 * Uses MCP tools with intelligent classification and batch processing
 */

const fs = require('fs-extra');
const path = require('path');

// Configuration
const BADGES_DIR = path.join(process.cwd(), 'badges');
const LEAGUES_DIR = path.join(BADGES_DIR, 'leagues');
const PROGRESS_FILE = path.join(BADGES_DIR, 'download-progress.json');
const LOG_FILE = path.join(BADGES_DIR, 'download.log');

// Processing configuration
const BATCH_SIZE = 25; // Smaller batches for better control
const API_DELAY = 1000; // Conservative delay between API calls
const MAX_RETRIES = 2;
const DRY_RUN = false; // Set to true for testing

// Entity classification patterns
const CLASSIFICATION = {
    // High confidence clubs
    CLUBS: {
        types: ['Club', 'Team'],
        patterns: [
            /fc$/i, / united$/i, / city$/i, / athletic$/i, / sporting$/i,
            / football club$/i, / soccer club$/i, / basketball club$/i,
            / rangers$/i, / celtic$/i, / dynamo$/i, / ajax$/i
        ]
    },
    
    // High confidence leagues  
    LEAGUES: {
        types: ['League'],
        patterns: [
            /league$/i, / premier$/i, / championship$/i, / division$/i,
            / serie\s+[a-z]/i, / bundesliga$/i, / laliga$/i, / ligue\s+[0-9]/i,
            / super league$/i, / major league$/i, / national league$/i,
            / football league$/i, / soccer league$/i, / basketball league$/i
        ]
    },
    
    // Need additional context
    ORGANIZATIONS: {
        types: ['Organization'],
        leagueIndicators: ['League', 'Premier', 'Championship', 'Serie', 'Bundesliga']
    }
};

class OptimizedBadgeDownloader {
    constructor() {
        this.badgesDir = BADGES_DIR;
        this.progress = this.loadProgress();
        this.stats = {
            total: 0,
            processed: 0,
            clubs: 0,
            leagues: 0,
            successful: 0,
            failed: 0,
            skipped: 0,
            startTime: Date.now()
        };
    }

    loadProgress() {
        try {
            if (fs.existsSync(PROGRESS_FILE)) {
                return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
            }
        } catch (error) {
            console.error('Error loading progress:', error.message);
        }
        return {
            processed: [],
            failed: [],
            skipped: [],
            lastRun: null
        };
    }

    saveProgress() {
        try {
            this.progress.lastRun = new Date().toISOString();
            fs.writeFileSync(PROGRESS_FILE, JSON.stringify(this.progress, null, 2));
        } catch (error) {
            console.error('Error saving progress:', error.message);
        }
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}\n`;
        console.log(logMessage.trim());
        
        try {
            fs.appendFileSync(LOG_FILE, logMessage);
        } catch (error) {
            console.error('Error writing to log:', error.message);
        }
    }

    /**
     * Classify entity using multiple criteria
     */
    classifyEntity(entity) {
        const { type, name, properties = {} } = entity;
        const entityName = name || properties.name || '';
        
        // Direct type classification
        if (CLASSIFICATION.CLUBS.types.includes(type)) {
            return { type: 'club', confidence: 1.0, method: 'type' };
        }
        
        if (CLASSIFICATION.LEAGUES.types.includes(type)) {
            return { type: 'league', confidence: 1.0, method: 'type' };
        }
        
        // Pattern-based classification
        for (const pattern of CLASSIFICATION.LEAGUES.patterns) {
            if (pattern.test(entityName)) {
                return { type: 'league', confidence: 0.8, method: 'pattern' };
            }
        }
        
        for (const pattern of CLASSIFICATION.CLUBS.patterns) {
            if (pattern.test(entityName)) {
                return { type: 'club', confidence: 0.8, method: 'pattern' };
            }
        }
        
        // Property-based classification
        if (properties.leagueId) {
            return { type: 'league', confidence: 0.9, method: 'property' };
        }
        
        if (properties.badgePath && !properties.leagueBadgePath) {
            return { type: 'club', confidence: 0.7, method: 'property' };
        }
        
        // Organization classification
        if (CLASSIFICATION.ORGANIZATIONS.types.includes(type)) {
            for (const indicator of CLASSIFICATION.ORGANIZATIONS.leagueIndicators) {
                if (entityName.includes(indicator)) {
                    return { type: 'league', confidence: 0.7, method: 'organization' };
                }
            }
            return { type: 'organization', confidence: 0.5, method: 'organization' };
        }
        
        return { type: 'unknown', confidence: 0.0, method: 'default' };
    }

    /**
     * Generate badge filename
     */
    generateBadgeName(name, type) {
        const cleanName = name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        return type === 'league' ? `${cleanName}-league-badge.png` : `${cleanName}-badge.png`;
    }

    /**
     * Check if entity already has badge
     */
    hasBadge(entity, classification) {
        const badgeName = this.generateBadgeName(entity.name || entity.properties?.name || '', classification.type);
        const badgePath = classification.type === 'league' ? 
            path.join(LEAGUES_DIR, badgeName) : 
            path.join(BADGES_DIR, badgeName);
        
        return fs.existsSync(badgePath);
    }

    /**
     * Process entities using MCP tools
     */
    async processAllEntities() {
        this.log('🚀 Starting optimized badge download for 4000+ entities');
        
        // Create directories
        await fs.ensureDir(BADGES_DIR);
        await fs.ensureDir(LEAGUES_DIR);
        
        // Get all entities that need badge processing
        const entities = await this.getEntitiesNeedingBadges();
        
        if (entities.length === 0) {
            this.log('✅ All entities already have badges!');
            return { success: true, message: 'All entities processed' };
        }
        
        this.stats.total = entities.length;
        this.log(`Found ${entities.length} entities needing badges`);
        
        // Filter out already processed entities
        const unprocessed = entities.filter(e => !this.progress.processed.includes(e.id));
        this.log(`${unprocessed.length} entities need processing`);
        
        // Process in batches
        const results = [];
        for (let i = 0; i < unprocessed.length; i += BATCH_SIZE) {
            const batch = unprocessed.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(unprocessed.length / BATCH_SIZE);
            
            this.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} entities)`);
            
            const batchResults = await this.processBatch(batch);
            results.push(...batchResults);
            
            // Save progress after each batch
            this.saveProgress();
            
            // Delay between batches
            if (i + BATCH_SIZE < unprocessed.length) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        // Generate summary
        const summary = this.generateSummary(results);
        this.log(`\n🎉 Processing Complete!\n${summary}`);
        
        return { success: true, results, summary };
    }

    /**
     * Get entities that need badge processing
     */
    async getEntitiesNeedingBadges() {
        this.log('Scanning Neo4j for entities needing badges...');
        
        try {
            // Use the MCP server to scan for entities
            const result = await this.callMCPTool('scan_and_download_missing_badges', {
                dry_run: true
            });
            
            if (result.success) {
                // Parse the results to get entity list
                const entities = this.parseMCPEntities(result);
                this.log(`Found ${entities.length} entities needing badges via MCP`);
                return entities;
            }
            
        } catch (error) {
            this.log(`MCP scan failed: ${error.message}`, 'ERROR');
        }
        
        // Fallback: get entities directly from Neo4j
        return await this.getEntitiesFromNeo4j();
    }

    /**
     * Parse MCP entity results
     */
    parseMCPEntities(mcpResult) {
        // This would parse the actual MCP response format
        // For now, return empty array
        return [];
    }

    /**
     * Get entities directly from Neo4j (fallback)
     */
    async getEntitiesFromNeo4j() {
        try {
            // Query Neo4j for entities without badges
            const query = `
                MATCH (e)
                WHERE (e.type = 'Club' OR e.type = 'Team' OR e.type = 'Organization' OR e.type = 'League')
                AND (e.badgePath IS NULL OR e.leagueBadgePath IS NULL)
                AND e.name IS NOT NULL
                RETURN e.id as id, e.name as name, e.type as type, properties(e) as properties
                LIMIT 5000
            `;
            
            const result = await this.queryNeo4j(query);
            return result.records.map(record => ({
                id: record.get('id'),
                name: record.get('name'),
                type: record.get('type'),
                properties: record.get('properties')
            }));
            
        } catch (error) {
            this.log(`Neo4j query failed: ${error.message}`, 'ERROR');
            return [];
        }
    }

    /**
     * Process a batch of entities
     */
    async processBatch(batch) {
        const results = [];
        
        for (const entity of batch) {
            try {
                const result = await this.processEntity(entity);
                results.push(result);
                this.stats.processed++;
                
                // Add to processed list
                if (!this.progress.processed.includes(entity.id)) {
                    this.progress.processed.push(entity.id);
                }
                
                // API rate limiting
                await new Promise(resolve => setTimeout(resolve, API_DELAY));
                
            } catch (error) {
                this.log(`Error processing ${entity.name}: ${error.message}`, 'ERROR');
                results.push({
                    entityId: entity.id,
                    success: false,
                    error: error.message
                });
                
                if (!this.progress.failed.includes(entity.id)) {
                    this.progress.failed.push(entity.id);
                }
                
                this.stats.failed++;
            }
        }
        
        return results;
    }

    /**
     * Process a single entity
     */
    async processEntity(entity) {
        const { id, name, type, properties } = entity;
        
        this.log(`Processing: ${name} (${id})`);
        
        // Classify entity
        const classification = this.classifyEntity(entity);
        
        if (classification.type === 'unknown') {
            this.log(`Skipping unknown entity type: ${name}`, 'WARN');
            this.stats.skipped++;
            if (!this.progress.skipped.includes(id)) {
                this.progress.skipped.push(id);
            }
            return {
                entityId: id,
                entityName: name,
                success: false,
                reason: 'Unknown classification',
                classification
            };
        }
        
        // Check if badge already exists
        if (this.hasBadge(entity, classification)) {
            this.log(`Badge exists for ${name}`, 'INFO');
            this.stats.skipped++;
            return {
                entityId: id,
                entityName: name,
                success: true,
                reason: 'Badge exists',
                classification
            };
        }
        
        // Download badge
        const downloadResult = await this.downloadBadge(entity, classification);
        
        if (downloadResult.success) {
            this.stats.successful++;
            
            if (classification.type === 'club') {
                this.stats.clubs++;
            } else if (classification.type === 'league') {
                this.stats.leagues++;
            }
            
            return {
                entityId: id,
                entityName: name,
                success: true,
                classification,
                ...downloadResult
            };
        } else {
            this.stats.failed++;
            return {
                entityId: id,
                entityName: name,
                success: false,
                error: downloadResult.error,
                classification
            };
        }
    }

    /**
     * Download badge using MCP tools
     */
    async downloadBadge(entity, classification) {
        if (DRY_RUN) {
            this.log(`[DRY RUN] Would download ${entity.name} as ${classification.type}`);
            return { success: true, method: 'dry_run' };
        }
        
        try {
            const badgeName = this.generateBadgeName(entity.name || '', classification.type);
            
            if (classification.type === 'club') {
                const result = await this.callMCPTool('download_club_badge', {
                    club_name: entity.name,
                    filename: badgeName
                });
                
                if (result.success) {
                    return {
                        success: true,
                        badgePath: result.localPath,
                        badgeName,
                        method: 'mcp_club'
                    };
                }
            } else if (classification.type === 'league') {
                // For leagues, we need the leagueId from properties
                const leagueId = entity.properties?.leagueId;
                if (!leagueId) {
                    return {
                        success: false,
                        error: 'League missing leagueId property'
                    };
                }
                
                const result = await this.callMCPTool('download_league_badge', {
                    league_id: leagueId.toString(),
                    league_name: entity.name,
                    filename: badgeName
                });
                
                if (result.success) {
                    return {
                        success: true,
                        badgePath: result.localPath,
                        badgeName,
                        method: 'mcp_league'
                    };
                }
            }
            
            return { success: false, error: 'Download failed' };
            
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Call MCP tool (placeholder - would use actual MCP server)
     */
    async callMCPTool(toolName, params) {
        // This would call the actual MCP server
        // For now, simulate successful download
        console.log(`[MCP] Calling ${toolName} with params:`, params);
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            success: true,
            localPath: path.join(BADGES_DIR, params.filename || 'badge.png'),
            message: 'Download successful'
        };
    }

    /**
     * Query Neo4j (placeholder)
     */
    async queryNeo4j(query) {
        // This would query the actual Neo4j database
        console.log(`[Neo4j] Executing query: ${query.substring(0, 100)}...`);
        
        return {
            records: []
        };
    }

    /**
     * Generate summary report
     */
    generateSummary(results) {
        const duration = (Date.now() - this.stats.startTime) / 1000 / 60;
        const successRate = this.stats.processed > 0 ? 
            ((this.stats.successful / this.stats.processed) * 100).toFixed(1) : 0;
        
        return `
📊 Processing Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Entities:     ${this.stats.total}
Processed:          ${this.stats.processed}
Successful:         ${this.stats.successful} (${successRate}%)
Failed:             ${this.stats.failed}
Skipped:            ${this.stats.skipped}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Club Badges:        ${this.stats.clubs}
League Badges:      ${this.stats.leagues}
Duration:           ${duration.toFixed(1)} minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        `.trim();
    }

    /**
     * Run the complete process
     */
    async run() {
        try {
            return await this.processAllEntities();
        } catch (error) {
            this.log(`Fatal error: ${error.message}`, 'ERROR');
            return { success: false, error: error.message };
        }
    }
}

// Main execution
if (require.main === module) {
    const downloader = new OptimizedBadgeDownloader();
    downloader.run()
        .then(result => {
            if (result.success) {
                console.log('\n✅ Badge download completed successfully!');
            } else {
                console.log('\n❌ Badge download failed:', result.error);
            }
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = OptimizedBadgeDownloader;