#!/usr/bin/env node

/**
 * League Badge Downloader - Downloads league badges
 * Focuses on major football leagues and competitions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Major leagues and competitions
const MAJOR_LEAGUES = [
    'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
    'Champions League', 'Europa League', 'UEFA Europa Conference League',
    'FA Cup', 'EFL Cup', 'Community Shield',
    'Copa del Rey', 'Supercopa de Espana',
    'Coppa Italia', 'Supercoppa Italiana',
    'DFB Pokal', 'DFL Supercup',
    'Coupe de France', 'Trophee des Champions',
    'Eredivisie', 'KNVB Cup', 'Johan Cruijff Schaal',
    'Primeira Liga', 'Taca da Liga', 'Supertaca Candido de Oliveira',
    'Scottish Premiership', 'Scottish Cup', 'Scottish League Cup',
    'Turkish Super Lig', 'Turkish Cup',
    'Brazilian Serie A', 'Copa do Brasil',
    'Argentine Primera Division', 'Copa Argentina',
    'MLS', 'MLS Cup', 'Supporters Shield',
    'Liga MX', 'Copa MX',
    'J1 League', 'J League Cup', 'Emperor Cup',
    'K League 1', 'Korean FA Cup',
    'Chinese Super League', 'Chinese FA Cup',
    'Russian Premier League', 'Russian Cup',
    'Ukrainian Premier League', 'Ukrainian Cup',
    'Dutch Eerste Divisie', 'English Championship',
    'English League One', 'English League Two',
    'Spanish Segunda Division', 'Italian Serie B',
    'German 2. Bundesliga', 'French Ligue 2'
];

class LeagueBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.leaguesDir = path.join(this.baseDir, 'leagues');
        this.logFile = path.join(this.baseDir, 'league-download.log');
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

    async getLeagueBadgeUrl(leagueName) {
        try {
            this.log(`🏆 ${leagueName}...`);
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?l=${encodeURIComponent(leagueName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited, waiting...`);
                await this.sleep(3000);
                return null;
            }
            
            const data = JSON.parse(response);
            
            if (data.leagues && data.leagues.length > 0) {
                const league = data.leagues.find(l => l.strLeague === leagueName);
                if (league && league.strBadge && league.strBadge.startsWith('http')) {
                    return league.strBadge;
                }
            }
            return null;
        } catch (error) {
            // Silent fail for league mode
            return null;
        }
    }

    async downloadBadge(url, filename) {
        try {
            const filePath = path.join(this.leaguesDir, filename);
            
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
        this.log('🏆 League badge download started');
        fs.writeFileSync(this.logFile, '');
        
        // Ensure leagues directory exists
        if (!fs.existsSync(this.leaguesDir)) {
            fs.mkdirSync(this.leaguesDir, { recursive: true });
        }
        
        for (const leagueName of MAJOR_LEAGUES) {
            const badgeUrl = await this.getLeagueBadgeUrl(leagueName);
            if (badgeUrl) {
                const filename = `${leagueName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')}-badge.png`;
                await this.downloadBadge(badgeUrl, filename);
            } else {
                this.log(`❌ ${leagueName}`);
            }
            
            await this.sleep(1500); // 1.5 second delay
        }
        
        // Final count
        const allFiles = fs.readdirSync(this.baseDir);
        const clubBadges = allFiles.filter(f => f.endsWith('.png') && !f.includes('corrected'));
        const leagueFiles = fs.readdirSync(this.leaguesDir);
        const leagueBadges = leagueFiles.filter(f => f.endsWith('.png'));
        
        this.log(`\n📊 League Download Summary`);
        this.log(`========================`);
        this.log(`✅ New league downloads: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped: ${this.skippedCount}`);
        this.log(`🏆 Total league badges: ${leagueBadges.length}`);
        this.log(`⚽ Total club badges: ${clubBadges.length}`);
        this.log(`🎯 Grand total: ${clubBadges.length + leagueBadges.length}`);
        this.log(`✅ League download completed!`);
    }
}

// Run the league downloader
if (require.main === module) {
    const downloader = new LeagueBadgeDownloader();
    downloader.run().catch(console.error);
}