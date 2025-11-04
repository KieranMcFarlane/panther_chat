#!/usr/bin/env node

/**
 * Improved script to download badges for major international clubs
 * Uses alternative names and better search strategies
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');

// Configuration
const BADGES_DIR = path.join(process.cwd(), 'badges');
const LEAGUES_DIR = path.join(BADGES_DIR, 'leagues');
const SPORTSDB_API_KEY = process.env.SPORTSDB_API_KEY || '3'; // Free tier key

// Clubs with multiple name variations for better search results
const TARGET_CLUBS = [
    { primary: 'Paris Saint Germain', alternatives: ['PSG', 'Paris Saint-Germain', 'Paris SG'] },
    { primary: 'Marseille', alternatives: ['Olympique Marseille', 'Olympique de Marseille', 'Marseille FC'] },
    { primary: 'Lyon', alternatives: ['Olympique Lyon', 'Olympique Lyonnais'] },
    { primary: 'Monaco', alternatives: ['AS Monaco', 'Monaco FC'] },
    { primary: 'Lille', alternatives: ['Lille OSC', 'LOSC Lille'] },
    { primary: 'Napoli', alternatives: ['SSC Napoli'] },
    { primary: 'Inter Milan', alternatives: ['Inter', 'Internazionale', 'FC Internazionale Milano'] },
    { primary: 'AC Milan', alternatives: ['Milan', 'AC Milan'] },
    { primary: 'Lazio', alternatives: ['SS Lazio', 'Lazio Roma'] },
    { primary: 'Roma', alternatives: ['AS Roma', 'Roma FC'] },
    { primary: 'Atalanta', alternatives: ['Atalanta BC', 'Atalanta Bergamo'] },
    { primary: 'Juventus', alternatives: ['Juventus FC', 'Juve'] }
];

class ImprovedBadgeDownloader {
    constructor() {
        this.results = [];
        this.downloaded = 0;
        this.failed = 0;
        this.skipped = 0;
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
     * Try to download badge with multiple name variations
     */
    async downloadBadgeWithAlternatives(clubData) {
        const fileName = this.generateFileName(clubData.primary);
        const filePath = path.join(BADGES_DIR, fileName);
        
        // Check if file already exists
        if (await fs.pathExists(filePath)) {
            this.log(`✅ Badge already exists for ${clubData.primary}`);
            return { clubName: clubData.primary, fileName, success: true, reason: 'Already exists' };
        }
        
        // Try primary name first, then alternatives
        const allNames = [clubData.primary, ...clubData.alternatives];
        
        for (const clubName of allNames) {
            try {
                this.log(`🔍 Searching for ${clubName} (primary: ${clubData.primary})...`);
                
                const result = await this.tryDownloadBadge(clubName, fileName);
                if (result.success) {
                    this.log(`✅ Successfully downloaded ${clubData.primary} badge (searched as: ${clubName})`);
                    return { ...result, clubName: clubData.primary, searchName: clubName };
                }
            } catch (error) {
                this.log(`⚠️  Search failed for ${clubName}: ${error.message}`, 'WARN');
                // Continue to next alternative
            }
            
            // Small delay between searches
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        throw new Error(`No valid search result found for ${clubData.primary}`);
    }

    /**
     * Try to download badge for a specific club name
     */
    async tryDownloadBadge(clubName, fileName) {
        return new Promise((resolve, reject) => {
            const searchUrl = `https://www.thesportsdb.com/api/v1/json/${SPORTSDB_API_KEY}/searchteams.php?t=${encodeURIComponent(clubName)}`;
            
            const req = https.get(searchUrl, (response) => {
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
                            
                            if (badgeUrl && badgeUrl.startsWith('http')) {
                                this.downloadImage(badgeUrl, fileName)
                                    .then(() => resolve({ success: true, fileName, badgeUrl, teamName: team.strTeam }))
                                    .catch(reject);
                            } else {
                                reject(new Error('No valid badge URL found'));
                            }
                        } else {
                            reject(new Error('No team found in search results'));
                        }
                    } catch (error) {
                        reject(new Error(`JSON parse error: ${error.message}`));
                    }
                });
                
            }).on('error', (error) => {
                reject(new Error(`HTTP request failed: ${error.message}`));
            });
            
            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
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
        this.log('🚀 Starting improved badge download for major international clubs');
        
        // Ensure badges directory exists
        await fs.ensureDir(BADGES_DIR);
        
        for (const clubData of TARGET_CLUBS) {
            try {
                const result = await this.downloadBadgeWithAlternatives(clubData);
                this.results.push(result);
                
                if (result.reason === 'Already exists') {
                    this.skipped++;
                } else {
                    this.downloaded++;
                }
                
                // Delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                this.log(`❌ Failed to download ${clubData.primary}: ${error.message}`, 'ERROR');
                this.results.push({ 
                    clubName: clubData.primary, 
                    success: false, 
                    error: error.message,
                    tried: clubData.alternatives 
                });
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
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 IMPROVED BADGE DOWNLOAD COMPLETE');
        console.log('='.repeat(70));
        console.log(`📊 Summary:`);
        console.log(`   Total clubs:      ${total}`);
        console.log(`   Successfully downloaded: ${this.downloaded}`);
        console.log(`   Already existed:   ${this.skipped}`);
        console.log(`   Failed:           ${this.failed}`);
        console.log(`   Success rate:      ${successRate}%`);
        console.log('');
        
        console.log('✅ Successfully downloaded:');
        this.results
            .filter(r => r.success && r.reason !== 'Already exists')
            .forEach(r => console.log(`   • ${r.clubName} -> ${r.fileName} (found as: ${r.searchName || r.teamName})`));
        
        if (this.skipped > 0) {
            console.log('\n✅ Already existed:');
            this.results
                .filter(r => r.success && r.reason === 'Already exists')
                .forEach(r => console.log(`   • ${r.clubName} -> ${r.fileName}`));
        }
        
        if (this.failed > 0) {
            console.log('\n❌ Failed to download:');
            this.results
                .filter(r => !r.success)
                .forEach(r => {
                    console.log(`   • ${r.clubName}: ${r.error}`);
                    if (r.tried && r.tried.length > 0) {
                        console.log(`     Tried alternatives: ${r.tried.join(', ')}`);
                    }
                });
        }
        
        console.log('\n📁 Badges saved to: ' + BADGES_DIR);
        console.log('='.repeat(70));
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
    const downloader = new ImprovedBadgeDownloader();
    downloader.run();
}

module.exports = ImprovedBadgeDownloader;