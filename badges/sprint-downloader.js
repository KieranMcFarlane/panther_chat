#!/usr/bin/env node

/**
 * Quick Sprint Downloader - Final push toward 200+ milestone
 * Short, focused run to reach the goal
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Quick sprint list - highest priority remaining clubs
const SPRINT_CLUB_LIST = [
    'Molde', 'Viking', 'Valerenga', 'HJK Helsinki', 'KuPS', 'Honka', 'Mariehamn',
    'Red Star Belgrade', 'Partizan Belgrade', 'Dinamo Zagreb', 'Hajduk Split',
    'Sparta Prague', 'Slavia Prague', 'Viktoria Plzen', 'Wisla Krakow', 'Legia Warsaw',
    'Lech Poznan', 'Ferencvaros', 'MTK Budapest', 'Debrecen', 'Steaua Bucuresti',
    'Dinamo Bucuresti', 'CFR Cluj', 'Shakhtar Donetsk', 'Dynamo Kyiv', 'Fenerbahce',
    'Galatasaray', 'Besiktas', 'Trabzonspor', 'Zenit St Petersburg', 'CSKA Moscow',
    'Spartak Moscow', 'Lokomotiv Moscow', 'Krasnodar', 'Urawa Red Diamonds', 'Kashima Antlers',
    'Kawasaki Frontale', 'Yokohama F Marinos', 'Nagoya Grampus', 'Cerezo Osaka', 'Gamba Osaka',
    'Consadole Sapporo', 'Jeonbuk Hyundai Motors', 'Seoul FC', 'Suwon Samsung Bluewings', 'Ulsan Hyundai',
    'Shanghai SIPG', 'Guangzhou FC', 'Beijing Guoan', 'Shandong Taishan', 'Santos', 'Gremio',
    'Internacional', 'Athletico Paranaense', 'Fortaleza', 'Bahia', 'Vasco da Gama', 'San Lorenzo',
    'Huracan', 'Estudiantes', 'Velez Sarsfield', 'Lanus', 'Banfield', 'Talleres',
    'Defensa y Justicia', 'Rosario Central', 'Al Ahly', 'Zamalek', 'Pyramids FC', 'Raja Casablanca',
    'Wydad Casablanca', 'TP Mazembe', 'ES Tunis', 'Esperance', 'Etoile du Sahel'
];

class QuickSprintDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'sprint-download.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.rateLimitDelay = 1500; // 1.5 seconds between API calls
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
            if (this.successCount % 3 === 0) {
                this.log(`🔍 ${teamName}... (${this.successCount} downloaded so far)`);
            } else {
                this.log(`🔍 ${teamName}...`);
            }
            
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited for ${teamName}, waiting 10s...`);
                await this.sleep(10000);
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
        this.log('🚀 SPRINT download started - Final push toward 200+ milestone!');
        
        const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        this.log(`📊 Starting with ${currentFiles.length} badges`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process in rapid succession
        const batchSize = 2;
        const totalBatches = Math.ceil(SPRINT_CLUB_LIST.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, SPRINT_CLUB_LIST.length);
            const batch = SPRINT_CLUB_LIST.slice(start, end);
            
            this.log(`🚀 Sprint ${i + 1}/${totalBatches} (${start + 1}-${end} of ${SPRINT_CLUB_LIST.length})`);
            
            for (const clubName of batch) {
                const badgeUrl = await this.getTeamBadgeUrl(clubName);
                if (badgeUrl) {
                    const filename = `${clubName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '').replace(/'/g, '').replace(/&/g, 'and')}-badge.png`;
                    await this.downloadBadge(badgeUrl, filename);
                } else {
                    this.log(`❌ ${clubName}`);
                }
                
                await this.sleep(this.rateLimitDelay);
            }
            
            // Check progress frequently
            const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
            if (currentFiles.length >= 200) {
                this.log(`🎉 MILESTONE REACHED: ${currentFiles.length}+ badges!`);
                break;
            }
            
            // Progress report every 5 batches
            if ((i + 1) % 5 === 0) {
                this.log(`📊 Progress: ${currentFiles.length} badges downloaded`);
            }
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
        
        this.log(`\n🎉 SPRINT DOWNLOAD COMPLETE!`);
        this.log(`===============================`);
        this.log(`✅ New downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🎯 Total badges: ${finalFiles.length}`);
        this.log(`📦 Total size: ${Math.round(totalSize / 1024 / 1024)}MB`);
        
        if (finalFiles.length >= 200) {
            this.log(`🏆 200+ MILESTONE ACHIEVED! Amazing work!`);
        } else {
            this.log(`🎯 Need ${200 - finalFiles.length} more for 200 milestone`);
        }
    }
}

// Run the sprint downloader
if (require.main === module) {
    const downloader = new QuickSprintDownloader();
    downloader.run().catch(console.error);
}