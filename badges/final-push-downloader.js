#!/usr/bin/env node

/**
 * Final Push Downloader - Reach 200+ milestone
 * Optimized for remaining clubs with extended rate limiting
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Final push clubs - highest success rate, lower API competition
const FINAL_PUSH_CLUBS = [
    'Kawasaki Frontale', 'Yokohama F Marinos', 'Nagoya Grampus', 'Cerezo Osaka', 'Gamba Osaka',
    'Consadole Sapporo', 'Jeonbuk Hyundai Motors', 'Seoul FC', 'Suwon Samsung Bluewings', 'Ulsan Hyundai',
    'Shanghai SIPG', 'Guangzhou FC', 'Beijing Guoan', 'Shandong Taishan', 'Santos', 'Gremio',
    'Internacional', 'Athletico Paranaense', 'Fortaleza', 'Bahia', 'Vasco da Gama', 'San Lorenzo',
    'Huracan', 'Estudiantes', 'Velez Sarsfield', 'Lanus', 'Banfield', 'Talleres',
    'Defensa y Justicia', 'Rosario Central', 'Al Ahly', 'Zamalek', 'Pyramids FC', 'Raja Casablanca',
    'Wydad Casablanca', 'TP Mazembe', 'ES Tunis', 'Esperance', 'Etoile du Sahel', 'Simba SC', 'Gor Mahia'
];

class FinalPushDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'final-push.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.rateLimitDelay = 4000; // 4 seconds between API calls
        this.rateLimitPenalty = 15000; // 15 seconds for rate limits
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

    async getTeamBadgeUrl(teamName) {
        try {
            if (this.successCount % 2 === 0) {
                this.log(`🔍 ${teamName}... (${this.successCount} downloaded so far)`);
            } else {
                this.log(`🔍 ${teamName}...`);
            }
            
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited for ${teamName}, waiting 15s...`);
                await this.sleep(this.rateLimitPenalty);
                return null;
            }
            
            const data = JSON.parse(response);
            
            if (data.teams && data.teams.length > 0) {
                const badgeUrl = data.teams[0].strBadge;
                if (badgeUrl && badgeUrl.startsWith('http')) {
                    return badgeUrl;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    }

    async downloadBadge(url, filename) {
        try {
            const filePath = path.join(this.baseDir, filename);
            
            // Skip if exists
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) {
                    this.skippedCount++;
                    return true;
                } else {
                    fs.unlinkSync(filePath);
                }
            }

            execSync(`curl -s "${url}" -o "${filePath}"`, { stdio: 'pipe' });
            
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) {
                    this.successCount++;
                    this.log(`✅ ${filename} (${stats.size}b)`);
                    return true;
                } else {
                    fs.unlinkSync(filePath);
                }
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    async run() {
        this.log('🎯 FINAL PUSH started - Almost at 200+ milestone!');
        
        const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        this.log(`📊 Starting with ${currentFiles.length} badges`);
        this.log(`🎯 Need ${200 - currentFiles.length} more for 200 milestone`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process one by one with extended delays
        for (let i = 0; i < FINAL_PUSH_CLUBS.length; i++) {
            const clubName = FINAL_PUSH_CLUBS[i];
            
            this.log(`🚀 Final push ${i + 1}/${FINAL_PUSH_CLUBS.length}: ${clubName}`);
            
            const badgeUrl = await this.getTeamBadgeUrl(clubName);
            if (badgeUrl) {
                const filename = `${clubName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '').replace(/'/g, '').replace(/&/g, 'and')}-badge.png`;
                await this.downloadBadge(badgeUrl, filename);
            } else {
                this.log(`❌ ${clubName}`);
            }
            
            // Check progress after each download
            const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
            if (currentFiles.length >= 200) {
                this.log(`🎉 MILESTONE REACHED: ${currentFiles.length}+ badges!`);
                break;
            }
            
            // Extended delay between requests
            await this.sleep(this.rateLimitDelay);
        }
        
        // Final count
        const finalFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        const totalSize = finalFiles.reduce((sum, file) => {
            try {
                return sum + fs.statSync(path.join(this.baseDir, file)).size;
            } catch {
                return sum;
            }
        }, 0);
        
        this.log(`\n🎉 FINAL PUSH COMPLETE!`);
        this.log(`===============================`);
        this.log(`✅ New downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🎯 Total badges: ${finalFiles.length}`);
        this.log(`📦 Total size: ${Math.round(totalSize / 1024 / 1024)}MB`);
        
        if (finalFiles.length >= 200) {
            this.log(`🏆 200+ MILESTONE ACHIEVED! Incredible achievement!`);
            this.log(`🚀 Growth: From 128 to ${finalFiles.length} badges (${Math.round((finalFiles.length - 128) / 128 * 100)}% growth)`);
        } else {
            this.log(`🎯 Need ${200 - finalFiles.length} more for 200 milestone`);
            this.log(`🚀 Still made amazing progress: +${finalFiles.length - 128} badges!`);
        }
    }
}

// Run the final push downloader
if (require.main === module) {
    const downloader = new FinalPushDownloader();
    downloader.run().catch(console.error);
}