#!/usr/bin/env node

/**
 * Script to download badges for specific major international clubs
 * Uses available MCP tools and direct API calls
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');

// Configuration
const BADGES_DIR = path.join(process.cwd(), 'badges');
const LEAGUES_DIR = path.join(BADGES_DIR, 'leagues');
const SPORTSDB_API_KEY = process.env.SPORTSDB_API_KEY || '3'; // Free tier key

// Clubs to download badges for
const TARGET_CLUBS = [
    'Paris Saint Germain',
    'Marseille', 
    'Lyon',
    'Monaco',
    'Lille',
    'Napoli',
    'Inter Milan',
    'AC Milan',
    'Lazio',
    'Roma',
    'Atalanta',
    'Juventus'
];

class SpecificBadgeDownloader {
    constructor() {
        this.results = [];
        this.downloaded = 0;
        this.failed = 0;
    }

    log(message, level = 'INFO') {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * Generate safe filename from club name
     */
    generateFileName(clubName) {
        return clubName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + '-badge.png';
    }

    /**
     * Download badge from TheSportsDB API
     */
    async downloadBadge(clubName, fileName) {
        return new Promise((resolve, reject) => {
            const searchUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(clubName)}`;
            
            this.log(`Searching for ${clubName}...`);
            
            https.get(searchUrl, (response) => {
                let data = '';
                
                response.on('data', (chunk) => {
                    data += chunk;
                });
                
                response.on('end', () => {
                    try {
                        const result = JSON.parse(data);
                        
                        if (result.teams && result.teams.length > 0) {
                            const team = result.teams[0];
                            const badgeUrl = team.strTeamBadge;
                            
                            if (badgeUrl) {
                                this.downloadImage(badgeUrl, fileName)
                                    .then(() => resolve({ success: true, clubName, fileName, badgeUrl }))
                                    .catch(reject);
                            } else {
                                reject(new Error('No badge URL found for team'));
                            }
                        } else {
                            reject(new Error('No team found'));
                        }
                    } catch (error) {
                        reject(new Error(`JSON parse error: ${error.message}`));
                    }
                });
                
            }).on('error', (error) => {
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
        });
    }

    /**
     * Download image from URL
     */
    downloadImage(url, fileName) {
        return new Promise((resolve, reject) => {
            const filePath = path.join(BADGES_DIR, fileName);
            
            https.get(url, (response) => {
                if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(filePath);
                    response.pipe(fileStream);
                    
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve();
                    });
                    
                    fileStream.on('error', (error) => {
                        fs.unlink(filePath, () => {}); // Clean up failed download
                        reject(error);
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            }).on('error', reject);
        });
    }

    /**
     * Process all target clubs
     */
    async processAllClubs() {
        this.log('🚀 Starting badge download for major international clubs');
        this.log(`📋 Target clubs: ${TARGET_CLUBS.join(', ')}`);
        
        // Ensure badges directory exists
        await fs.ensureDir(BADGES_DIR);
        
        for (const clubName of TARGET_CLUBS) {
            try {
                const fileName = this.generateFileName(clubName);
                const filePath = path.join(BADGES_DIR, fileName);
                
                // Check if file already exists
                if (await fs.pathExists(filePath)) {
                    this.log(`✅ Badge already exists for ${clubName}`);
                    this.results.push({ clubName, fileName, success: true, reason: 'Already exists' });
                    continue;
                }
                
                this.log(`⬇️  Downloading badge for ${clubName}...`);
                
                const result = await this.downloadBadge(clubName, fileName);
                this.results.push(result);
                this.downloaded++;
                
                this.log(`✅ Successfully downloaded ${clubName} badge`);
                
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                this.log(`❌ Failed to download ${clubName}: ${error.message}`, 'ERROR');
                this.results.push({ clubName, success: false, error: error.message });
                this.failed++;
            }
        }
        
        this.generateReport();
    }

    /**
     * Generate final report
     */
    generateReport() {
        const total = TARGET_CLUBS.length;
        const successRate = ((this.downloaded / total) * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 BADGE DOWNLOAD COMPLETE');
        console.log('='.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   Total clubs:      ${total}`);
        console.log(`   Successfully downloaded: ${this.downloaded}`);
        console.log(`   Failed:           ${this.failed}`);
        console.log(`   Success rate:      ${successRate}%`);
        console.log('');
        
        console.log('✅ Successfully downloaded:');
        this.results
            .filter(r => r.success)
            .forEach(r => console.log(`   • ${r.clubName} -> ${r.fileName}`));
        
        if (this.failed > 0) {
            console.log('\n❌ Failed to download:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.clubName}: ${r.error}`));
        }
        
        console.log('\n📁 Badges saved to: ' + BADGES_DIR);
        console.log('='.repeat(60));
    }

    /**
     * Run the download process
     */
    async run() {
        try {
            await this.processAllClubs();
        } catch (error) {
            this.log(`❌ Fatal error: ${error.message}`, 'ERROR');
            process.exit(1);
        }
    }
}

// Main execution
if (require.main === module) {
    const downloader = new SpecificBadgeDownloader();
    downloader.run();
}

module.exports = SpecificBadgeDownloader;