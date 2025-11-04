#!/usr/bin/env node

/**
 * S3 Badge Uploader and Neo4j Mapper
 * Uploads badge files to S3 and updates Neo4j entities with S3 URLs
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class S3BadgeUploader {
    constructor() {
        this.badgesDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.s3Bucket = 'sportsintelligence.s3.eu-north-1.amazonaws.com';
        this.s3Path = 'badges';
        this.logFile = path.join(this.badgesDir, 's3-upload.log');
        this.uploadCount = 0;
        this.errorCount = 0;
        this.mappingCount = 0;
        this.alreadyUploadedCount = 0;
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        console.log(logMessage.trim());
        fs.appendFileSync(this.logFile, logMessage);
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Get all badge files
    getBadgeFiles() {
        try {
            const files = fs.readdirSync(this.badgesDir);
            return files
                .filter(file => file.endsWith('.png') && file.includes('-badge.png'))
                .map(file => ({
                    fileName: file,
                    localPath: path.join(this.badgesDir, file),
                    s3Path: `${this.s3Path}/${file}`,
                    s3Url: `https://${this.s3Bucket}/${this.s3Path}/${file}`,
                    entityName: file.replace('-badge.png', '')
                        .split('-')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                        .join(' ')
                }));
        } catch (error) {
            this.log(`❌ Error reading badges directory: ${error.message}`);
            return [];
        }
    }

    // Check if file already exists in S3
    async checkS3FileExists(s3Path) {
        try {
            const command = `aws s3 ls s3://${this.s3Bucket}/${s3Path}`;
            const result = execSync(command, { encoding: 'utf8' });
            return result.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    // Upload file to S3
    async uploadToS3(localPath, s3Path) {
        try {
            // Check if already exists
            const exists = await this.checkS3FileExists(s3Path);
            if (exists) {
                this.alreadyUploadedCount++;
                return true;
            }

            const command = `aws s3 cp "${localPath}" "s3://${this.s3Bucket}/${s3Path}" --acl public-read`;
            const result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
            
            if (result.includes('upload:') || result.includes('copy:')) {
                this.uploadCount++;
                this.log(`✅ Uploaded: ${s3Path}`);
                return true;
            }
            
            return false;
        } catch (error) {
            this.log(`❌ Upload failed for ${s3Path}: ${error.message}`);
            this.errorCount++;
            return false;
        }
    }

    // Execute Neo4j query (simulated - replace with actual MCP tool calls)
    async executeNeo4jQuery(query, params = {}) {
        try {
            // This would use the actual MCP Neo4j tool in production
            this.log(`🔍 Neo4j Query: ${query.substring(0, 100)}...`);
            return [];
        } catch (error) {
            this.log(`❌ Neo4j query error: ${error.message}`);
            return [];
        }
    }

    // Find entity by name variations
    async findEntity(entityName) {
        const variations = [
            entityName,
            entityName.replace(' FC', ''),
            entityName.replace('Football Club', 'FC'),
            entityName.replace(' Club', ''),
            entityName.replace(' AC', ''),
            entityName.replace(' FK', ''),
            entityName + ' FC',
            entityName + ' Football Club'
        ];

        for (const variation of variations) {
            try {
                const query = `
                    MATCH (e) 
                    WHERE e.name = $name OR e.name CONTAINS $name
                    RETURN e.name as name, e.type as type, e.badgePath as currentBadgePath, id(e) as id
                    LIMIT 1
                `;
                
                const result = await this.executeNeo4jQuery(query, { name: variation });
                if (result && result.length > 0) {
                    return result[0];
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    }

    // Update entity with S3 badge URL
    async updateEntityBadge(entityId, entityName, s3Url) {
        try {
            const query = `
                MATCH (e) 
                WHERE id(e) = $entityId
                SET e.badgePath = $s3Url,
                    e.s3BadgeUrl = $s3Url,
                    e.badgeUpdated = datetime(),
                    e.badgeSynced = true
                RETURN e.name as name, e.badgePath as badgePath
            `;
            
            const result = await this.executeNeo4jQuery(query, { entityId, s3Url });
            return result && result.length > 0;
        } catch (error) {
            this.log(`❌ Failed to update entity ${entityName}: ${error.message}`);
            return false;
        }
    }

    // Process single badge: upload to S3 and map to Neo4j
    async processBadge(badgeInfo) {
        try {
            this.log(`🚀 Processing: ${badgeInfo.fileName}`);
            
            // Upload to S3
            const uploadSuccess = await this.uploadToS3(badgeInfo.localPath, badgeInfo.s3Path);
            if (!uploadSuccess) {
                return false;
            }
            
            // Find entity in Neo4j
            const entity = await this.findEntity(badgeInfo.entityName);
            if (!entity) {
                this.log(`⚠️  No entity found for: ${badgeInfo.entityName}`);
                return true; // Still count as success since upload worked
            }
            
            // Check if already has S3 URL
            if (entity.currentBadgePath && entity.currentBadgePath.startsWith('https://')) {
                this.log(`⏭️  Already has S3 URL: ${entity.name}`);
                return true;
            }
            
            // Update entity with S3 URL
            const updateSuccess = await this.updateEntityBadge(entity.id, entity.name, badgeInfo.s3Url);
            if (updateSuccess) {
                this.mappingCount++;
                this.log(`✅ Mapped: ${entity.name} -> ${badgeInfo.s3Url}`);
                return true;
            } else {
                this.log(`❌ Failed to map: ${entity.name}`);
                return false;
            }
            
        } catch (error) {
            this.log(`❌ Error processing ${badgeInfo.fileName}: ${error.message}`);
            this.errorCount++;
            return false;
        }
    }

    // Get Neo4j statistics
    async getNeo4jStats() {
        try {
            const query = `
                MATCH (e) 
                WHERE e.badgePath STARTS WITH 'https://'
                RETURN count(e) as withS3Badges
            `;
            
            const result = await this.executeNeo4jQuery(query);
            return result && result.length > 0 ? result[0].withS3Badges : 0;
        } catch (error) {
            return 0;
        }
    }

    // Run the complete process
    async run() {
        this.log('🚀 S3 Badge Upload and Neo4j Mapping Started');
        this.log('===============================================');
        
        const badgeFiles = this.getBadgeFiles();
        this.log(`📊 Found ${badgeFiles.length} badge files to process`);
        
        const initialStats = await this.getNeo4jStats();
        this.log(`📊 Starting with ${initialStats} entities with S3 badges`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process in batches to avoid overwhelming systems
        const batchSize = 10;
        const totalBatches = Math.ceil(badgeFiles.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, badgeFiles.length);
            const batch = badgeFiles.slice(start, end);
            
            this.log(`🚀 Batch ${i + 1}/${totalBatches} (${start + 1}-${end} of ${badgeFiles.length})`);
            
            for (const badgeInfo of batch) {
                await this.processBadge(badgeInfo);
                await this.sleep(500); // Small delay between operations
            }
            
            this.log(`📊 Batch ${i + 1} complete: ${this.uploadCount} uploaded, ${this.mappingCount} mapped, ${this.alreadyUploadedCount} already in S3, ${this.errorCount} errors`);
        }
        
        // Final statistics
        const finalStats = await this.getNeo4jStats();
        
        this.log(`\n🎉 S3 Upload and Mapping Complete!`);
        this.log(`====================================`);
        this.log(`✅ Uploaded to S3: ${this.uploadCount}`);
        this.log(`⏭️  Already in S3: ${this.alreadyUploadedCount}`);
        this.log(`✅ Mapped to Neo4j: ${this.mappingCount}`);
        this.log(`❌ Errors: ${this.errorCount}`);
        this.log(`📊 Total processed: ${badgeFiles.length}`);
        this.log(`📈 Entities with S3 badges: ${finalStats}`);
        this.log(`🚀 Growth: +${finalStats - initialStats} new S3 mappings`);
        
        if (this.uploadCount > 0) {
            this.log(`🎯 Upload success rate: ${Math.round((this.uploadCount / (this.uploadCount + this.errorCount)) * 100)}%`);
        }
        
        if (this.mappingCount > 0) {
            this.log(`🎯 Mapping success rate: ${Math.round((this.mappingCount / (this.mappingCount + this.errorCount)) * 100)}%`);
        }
        
        // Show sample S3 URLs
        this.log(`\n📋 Sample S3 URLs:`);
        const sampleBadges = badgeFiles.slice(0, 3);
        for (const badge of sampleBadges) {
            this.log(`   ${badge.entityName} -> ${badge.s3Url}`);
        }
    }
}

// Run the uploader
if (require.main === module) {
    const uploader = new S3BadgeUploader();
    uploader.run().catch(console.error);
}