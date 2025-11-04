#!/usr/bin/env node

/**
 * Focused Badge Downloader - Continue progress toward 200+ milestone
 * Processes remaining high-priority clubs efficiently
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Focused list of remaining high-priority clubs
const FOCUSED_CLUB_LIST = [
    // English Championship (continued)
    'Ipswich Town', 'Leicester City', 'Southampton', 'West Bromwich Albion',
    
    // Spanish La Liga (remaining)
    'Real Sociedad', 'Athletic Bilbao', 'Rayo Vallecano', 'Alaves', 'Valladolid',
    
    // German Bundesliga (remaining)
    'Borussia Monchengladbach', 'Mainz 05', 'Freiburg', 'Hoffenheim', 'Werder Bremen',
    
    // Italian Serie A (remaining)
    'Atalanta', 'Roma', 'Lazio', 'Napoli', 'Fiorentina', 'Torino', 'Sassuolo',
    
    // French Ligue 1 (remaining)
    'AS Monaco', 'Olympique Lyon', 'Marseille', 'Lille', 'Nice', 'Strasbourg',
    
    // Major European clubs
    'Anderlecht', 'Club Brugge', 'Genk', 'Standard Liege',
    'Red Bull Salzburg', 'Rapid Vienna', 'Sturm Graz',
    'Basel', 'Young Boys', 'Zurich', 'Lugano',
    'AEK Athens', 'Panathinaikos', 'PAOK', 'Olympiacos',
    
    // Scandinavian clubs
    'Malmo FF', 'AIK', 'Djurgarden', 'Hammarby', 'Elfsborg', 'Hacken',
    'Copenhagen', 'Brondby', 'Midtjylland', 'Aalborg', 'Nordsjaelland',
    'Rosenborg', 'Bodo Glimt', 'Molde', 'Viking', 'Valerenga',
    'HJK Helsinki', 'KuPS', 'Honka', 'Mariehamn',
    
    // Eastern European clubs
    'Red Star Belgrade', 'Partizan Belgrade',
    'Dinamo Zagreb', 'Hajduk Split',
    'Sparta Prague', 'Slavia Prague', 'Viktoria Plzen',
    'Wisla Krakow', 'Legia Warsaw', 'Lech Poznan',
    'Ferencvaros', 'MTK Budapest', 'Debrecen',
    'Steaua Bucuresti', 'Dinamo Bucuresti', 'CFR Cluj',
    'Shakhtar Donetsk', 'Dynamo Kyiv',
    'Slovan Bratislava', 'Spartak Trnava',
    'Levski Sofia', 'CSKA Sofia', 'Ludogorets',
    
    // Turkish clubs
    'Fenerbahce', 'Galatasaray', 'Besiktas', 'Trabzonspor', 'Basaksehir',
    
    // Russian clubs
    'Zenit St Petersburg', 'CSKA Moscow', 'Spartak Moscow', 'Lokomotiv Moscow', 'Krasnodar',
    
    // Asian clubs
    'Urawa Red Diamonds', 'Kashima Antlers', 'Kawasaki Frontale', 'Yokohama F Marinos',
    'Nagoya Grampus', 'Cerezo Osaka', 'Gamba Osaka', 'Consadole Sapporo',
    'Jeonbuk Hyundai Motors', 'Seoul FC', 'Suwon Samsung Bluewings', 'Ulsan Hyundai',
    'Shanghai SIPG', 'Guangzhou FC', 'Beijing Guoan', 'Shandong Taishan',
    
    // Brazilian clubs (more)
    'Santos', 'Gremio', 'Internacional', 'Athletico Paranaense', 'Fortaleza',
    'Bahia', 'Vasco da Gama', 'Goias', 'Coritiba', 'Cuiaba',
    
    // Argentine clubs (more)
    'San Lorenzo', 'Huracan', 'Estudiantes', 'Velez Sarsfield', 'Lanus',
    'Banfield', 'Talleres', 'Defensa y Justicia', 'Rosario Central', 'Boca Juniors',
    
    // African clubs
    'Al Ahly', 'Zamalek', 'Pyramids FC', 'Raja Casablanca', 'Wydad Casablanca',
    'TP Mazembe', 'ES Tunis', 'Esperance', 'Etoile du Sahel', 'Simba SC', 'Gor Mahia',
    
    // MLS clubs
    'Los Angeles FC', 'Seattle Sounders', 'Toronto FC', 'Montreal Impact', 'Vancouver Whitecaps',
    'Atlanta United', 'FC Dallas', 'Houston Dynamo', 'Sporting Kansas City', 'Real Salt Lake',
    
    // Mexican clubs (more)
    'America', 'Toluca', 'UNAM Pumas', 'Santos Laguna', 'Monterrey', 'Tigres'
];

class FocusedBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'focused-download.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.rateLimitDelay = 2000; // 2 seconds between API calls
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
            if (this.successCount % 5 === 0) {
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
        this.log('🎯 FOCUSED badge download started - Continuing toward 200+ milestone!');
        this.log('Current count before starting:');
        
        const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
        this.log(`📊 Starting with ${currentFiles.length} badges`);
        
        fs.writeFileSync(this.logFile, '');
        
        // Process in smaller batches for better progress tracking
        const batchSize = 3;
        const totalBatches = Math.ceil(FOCUSED_CLUB_LIST.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, FOCUSED_CLUB_LIST.length);
            const batch = FOCUSED_CLUB_LIST.slice(start, end);
            
            this.log(`🚀 Batch ${i + 1}/${totalBatches} (${start + 1}-${end} of ${FOCUSED_CLUB_LIST.length})`);
            
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
            
            // Progress check every 10 batches
            if ((i + 1) % 10 === 0) {
                const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
                this.log(`📊 Progress check: ${currentFiles.length} badges downloaded`);
            }
            
            // Break if we reach 200+ milestone
            const currentFiles = fs.readdirSync(this.baseDir).filter(f => f.endsWith('.png'));
            if (currentFiles.length >= 200) {
                this.log(`🎉 MILESTONE REACHED: ${currentFiles.length}+ badges!`);
                break;
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
        
        this.log(`\n🎯 FOCUSED DOWNLOAD COMPLETE!`);
        this.log(`===============================`);
        this.log(`✅ New downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🎯 Total badges: ${finalFiles.length}`);
        this.log(`📦 Total size: ${Math.round(totalSize / 1024 / 1024)}MB`);
        this.log(`🚀 Goal status: ${finalFiles.length >= 200 ? '200+ MILESTONE ACHIEVED!' : `Need ${200 - finalFiles.length} more for 200 milestone`}`);
    }
}

// Run the focused downloader
if (require.main === module) {
    const downloader = new FocusedBadgeDownloader();
    downloader.run().catch(console.error);
}