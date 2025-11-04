#!/usr/bin/env node

/**
 * Quick Badge Downloader - Focused download for high-priority clubs
 * Downloads badges for remaining top clubs efficiently
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// High-priority clubs that we definitely want
const PRIORITY_CLUBS = [
    // Top European clubs we might have missed
    'AS Roma', 'Ajax', 'Feyenoord', 'PSV Eindhoven', 'Benfica', 'FC Porto',
    'Marseille', 'Monaco', 'Lyon', 'Nice', 'Lens', 'Rennes',
    'Celtic', 'Rangers', 'Galatasaray', 'Fenerbahce', 'Besiktas',
    'Flamengo', 'Palmeiras', 'Sao Paulo', 'Botafogo', 'Fluminense',
    'Boca Juniors', 'River Plate', 'Independiente', 'Racing Club',
    'Seattle Sounders', 'LA Galaxy', 'LAFC', 'Atlanta United',
    'America', 'Guadalajara', 'Cruz Azul', 'Monterrey',
    'Al Hilal', 'Al Nassr', 'Al Ittihad', 'Persepolis',
    'Yokohama F. Marinos', 'Kashima Antlers', 'Urawa Red Diamonds'
];

class QuickBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'quick-download.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
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
            this.log(`🔍 ${teamName}...`);
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited, waiting...`);
                await this.sleep(3000);
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
            // Silent fail for quick mode
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
        this.log('⚡ Quick badge download started');
        fs.writeFileSync(this.logFile, '');
        
        for (const clubName of PRIORITY_CLUBS) {
            const badgeUrl = await this.getTeamBadgeUrl(clubName);
            if (badgeUrl) {
                const filename = `${clubName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')}-badge.png`;
                await this.downloadBadge(badgeUrl, filename);
            } else {
                this.log(`❌ ${clubName}`);
            }
            
            await this.sleep(1500); // 1.5 second delay
        }
        
        // Final count
        const files = fs.readdirSync(this.baseDir);
        const pngFiles = files.filter(f => f.endsWith('.png') && !f.includes('corrected'));
        
        this.log(`\n📊 Quick Download Summary`);
        this.log(`========================`);
        this.log(`✅ New downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🎯 Total badges: ${pngFiles.length}`);
        this.log(`✅ Quick download completed!`);
    }
}

// Quick run
if (require.main === module) {
    const downloader = new QuickBadgeDownloader();
    downloader.run().catch(console.error);
}