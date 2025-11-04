#!/usr/bin/env node

/**
 * Badge Mapper - Connect downloaded badges to Neo4j entities
 * Updates entity records with badge paths
 */

const fs = require('fs');
const path = require('path');

class BadgeMapper {
    constructor() {
        this.badgesDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.badgesDir, 'badge-mapping.log');
        this.mappingCount = 0;
        this.errorCount = 0;
        this.alreadyMappedCount = 0;
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logFile, logMessage);
    }

    // Load available badge files
    getAvailableBadges() {
        try {
            const files = fs.readdirSync(this.badgesDir);
            return files
                .filter(file => file.endsWith('.png'))
                .map(file => file.replace('-badge.png', '').replace('-league-badge.png', ''))
                .map(name => name.replace(/-/g, ' '));
        } catch (error) {
            this.log(`❌ Error reading badges directory: ${error.message}`);
            return [];
        }
    }

    // Convert badge filename to various possible entity name formats
    getPossibleEntityNames(badgeName) {
        const names = [badgeName];
        
        // Add common variations
        if (badgeName.includes('fc')) {
            names.push(badgeName.replace(/fc$/i, 'FC'));
            names.push(badgeName.replace(/fc$/i, ' Football Club'));
        }
        
        if (badgeName.includes('united')) {
            names.push(badgeName.replace(/united$/i, 'United'));
            names.push(badgeName.replace(/united$/i, ' United FC'));
        }
        
        if (badgeName.includes('city')) {
            names.push(badgeName.replace(/city$/i, 'City'));
            names.push(badgeName.replace(/city$/i, ' City FC'));
        }
        
        if (badgeName.includes('athletic')) {
            names.push(badgeName.replace(/athletic$/i, 'Athletic'));
            names.push(badgeName.replace(/athletic$/i, ' Athletic Club'));
        }
        
        // Add proper capitalization
        names.push(badgeName.split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' '));
        
        return [...new Set(names)]; // Remove duplicates
    }

    // Get badge path from filename
    getBadgePath(badgeName) {
        const fileName = `${badgeName.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
        const filePath = path.join(this.badgesDir, fileName);
        
        if (fs.existsSync(filePath)) {
            return `badges/${fileName}`;
        }
        return null;
    }

    // Map badge to Neo4j entity
    async mapBadgeToEntity(badgeName) {
        try {
            const badgePath = this.getBadgePath(badgeName);
            if (!badgePath) {
                this.log(`❌ Badge file not found: ${badgeName}`);
                return false;
            }

            const possibleNames = this.getPossibleEntityNames(badgeName);
            
            // Try to find matching entity
            for (const entityName of possibleNames) {
                const query = `
                    MATCH (e) 
                    WHERE e.name = $name OR e.name CONTAINS $name
                    RETURN e.name as name, e.type as type, e.badgePath as currentBadgePath
                    LIMIT 1
                `;
                
                try {
                    const result = await this.executeNeo4jQuery(query, { name: entityName });
                    
                    if (result && result.length > 0) {
                        const entity = result[0];
                        
                        // Check if already mapped
                        if (entity.currentBadgePath && entity.currentBadgePath.includes('badge.png')) {
                            this.alreadyMappedCount++;
                            this.log(`⏭️  Already mapped: ${entity.name} -> ${entity.currentBadgePath}`);
                            return true;
                        }
                        
                        // Update the entity with badge path
                        const updateQuery = `
                            MATCH (e) 
                            WHERE e.name = $entityName
                            SET e.badgePath = $badgePath,
                                e.badgeUpdated = datetime()
                            RETURN e.name as name, e.badgePath as badgePath
                        `;
                        
                        const updateResult = await this.executeNeo4jQuery(updateQuery, {
                            entityName: entity.name,
                            badgePath: badgePath
                        });
                        
                        if (updateResult && updateResult.length > 0) {
                            this.mappingCount++;
                            this.log(`✅ Mapped: ${entity.name} -> ${badgePath}`);
                            return true;
                        }
                    }
                } catch (error) {
                    this.log(`❌ Error querying for ${entityName}: ${error.message}`);
                }
            }
            
            this.log(`❌ No entity found for badge: ${badgeName}`);
            this.errorCount++;
            return false;
            
        } catch (error) {
            this.log(`❌ Error mapping badge ${badgeName}: ${error.message}`);
            this.errorCount++;
            return false;
        }
    }

    // Execute Neo4j query (simulated - in real implementation would use Neo4j driver)
    async executeNeo4jQuery(query, params = {}) {
        // This is a mock implementation
        // In reality, you'd use the Neo4j JavaScript driver
        console.log(`🔍 Executing Neo4j query: ${query.substring(0, 100)}...`);
        return [];
    }

    // Run the mapping process
    async run() {
        this.log('🗺️  Badge mapping started - Connecting badges to Neo4j entities');
        
        const badges = this.getAvailableBadges();
        this.log(`📊 Found ${badges.length} badge files to map`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process badges in batches
        const batchSize = 10;
        const totalBatches = Math.ceil(badges.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, badges.length);
            const batch = badges.slice(start, end);
            
            this.log(`🚀 Processing batch ${i + 1}/${totalBatches} (${start + 1}-${end} of ${badges.length})`);
            
            for (const badge of batch) {
                await this.mapBadgeToEntity(badge);
                
                // Small delay to avoid overwhelming the database
                await this.sleep(100);
            }
            
            this.log(`📊 Batch ${i + 1} complete: ${this.mappingCount} mapped, ${this.alreadyMappedCount} already mapped, ${this.errorCount} errors`);
        }
        
        this.log(`\n🎉 Badge mapping complete!`);
        this.log(`===============================`);
        this.log(`✅ Newly mapped: ${this.mappingCount}`);
        this.log(`⏭️  Already mapped: ${this.alreadyMappedCount}`);
        this.log(`❌ Errors: ${this.errorCount}`);
        this.log(`📊 Total processed: ${badges.length}`);
        
        // Get final statistics
        await this.getFinalStats();
    }

    async getFinalStats() {
        try {
            const statsQuery = `
                MATCH (e) 
                WHERE e.badgePath IS NOT NULL AND e.badgePath CONTAINS 'badge.png'
                RETURN count(e) as totalWithBadges
            `;
            
            const result = await this.executeNeo4jQuery(statsQuery);
            if (result && result.length > 0) {
                this.log(`🎯 Total entities with badges in Neo4j: ${result[0].totalWithBadges}`);
            }
        } catch (error) {
            this.log(`❌ Error getting final stats: ${error.message}`);
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the badge mapper
if (require.main === module) {
    const mapper = new BadgeMapper();
    mapper.run().catch(console.error);
}