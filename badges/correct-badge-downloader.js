#!/usr/bin/env node

/**
 * CORRECT Badge Downloader - Uses TheSportsDB API to get proper badge URLs
 * This script downloads badges using the correct URL patterns to avoid 404 errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Popular clubs to download badges for
const POPULAR_CLUBS = [
    'Arsenal', 'Chelsea', 'Liverpool', 'Manchester United', 'Manchester City',
    'Tottenham Hotspur', 'West Ham United', 'Leicester City', 'Everton', 'Newcastle United',
    'Aston Villa', 'Crystal Palace', 'Brighton', 'Burnley', 'Sheffield United',
    'Real Madrid', 'Barcelona', 'Atletico Madrid', 'Valencia', 'Sevilla',
    'Bayern Munich', 'Borussia Dortmund', 'RB Leipzig', 'Bayer Leverkusen',
    'Juventus', 'AC Milan', 'Inter Milan', 'Napoli', 'AS Roma', 'Lazio',
    'PSG', 'Marseille', 'Monaco', 'Lyon', 'Lille',
    'Ajax', 'Feyenoord', 'PSV Eindhoven',
    'Benfica', 'FC Porto',
    'Celtic', 'Rangers',
    'Galatasaray', 'Fenerbahce',
    'Flamengo', 'Palmeiras', 'Sao Paulo', 'Botafogo',
    'Boca Juniors', 'River Plate'
];

// Popular leagues to download badges for
const POPULAR_LEAGUES = [
    'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
    'Champions League', 'Europa League', 'UEFA Nations League',
    'FA Cup', 'EFL Cup', 'Copa del Rey', 'Coppa Italia', 'DFB Pokal',
    'Eredivisie', 'Primeira Liga', 'Scottish Premiership',
    'Turkish Super Lig', 'Russian Premier League',
    'Brazilian Serie A', 'Argentine Primera Division',
    'MLS', 'Liga MX', 'J1 League', 'K League 1'
];

class CorrectBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'correct-download.log');
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

    async getTeamBadgeUrl(teamName) {
        try {
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            const data = JSON.parse(response);
            
            if (data.teams && data.teams.length > 0) {
                const badgeUrl = data.teams[0].strBadge;
                if (badgeUrl && badgeUrl.startsWith('http')) {
                    return badgeUrl;
                }
            }
            return null;
        } catch (error) {
            this.log(`❌ Error getting badge URL for ${teamName}: ${error.message}`);
            return null;
        }
    }

    async getLeagueBadgeUrl(leagueName) {
        try {
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/search_all_leagues.php?l=${encodeURIComponent(leagueName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            const data = JSON.parse(response);
            
            if (data.leagues && data.leagues.length > 0) {
                const league = data.leagues.find(l => l.strLeague === leagueName);
                if (league && league.strBadge && league.strBadge.startsWith('http')) {
                    return league.strBadge;
                }
            }
            return null;
        } catch (error) {
            this.log(`❌ Error getting league badge URL for ${leagueName}: ${error.message}`);
            return null;
        }
    }

    async downloadBadge(url, filename) {
        try {
            const filePath = path.join(this.baseDir, filename);
            
            // Check if file already exists and is valid
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) { // Valid badge file
                    this.skippedCount++;
                    this.log(`⏭️  ${filename} already exists (${stats.size} bytes)`);
                    return true;
                } else {
                    // Remove invalid small files
                    fs.unlinkSync(filePath);
                    this.log(`🗑️  Removed invalid ${filename} (${stats.size} bytes)`);
                }
            }

            // Download the badge
            execSync(`curl -s "${url}" -o "${filePath}"`, { stdio: 'pipe' });
            
            // Verify the download
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) { // Valid PNG file
                    this.successCount++;
                    this.log(`✅ Downloaded ${filename} (${stats.size} bytes)`);
                    return true;
                } else {
                    // Remove invalid file
                    fs.unlinkSync(filePath);
                    this.errorCount++;
                    this.log(`❌ Invalid file size for ${filename}: ${stats.size} bytes`);
                    return false;
                }
            } else {
                this.errorCount++;
                this.log(`❌ Failed to download ${filename}`);
                return false;
            }
        } catch (error) {
            this.errorCount++;
            this.log(`❌ Error downloading ${filename}: ${error.message}`);
            return false;
        }
    }

    async downloadTeamBadges() {
        this.log('🚀 Starting team badge downloads...');
        
        for (const teamName of POPULAR_CLUBS) {
            this.log(`🔍 Searching for ${teamName}...`);
            
            const badgeUrl = await this.getTeamBadgeUrl(teamName);
            if (badgeUrl) {
                const filename = `${teamName.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
                await this.downloadBadge(badgeUrl, filename);
            } else {
                this.errorCount++;
                this.log(`❌ No badge URL found for ${teamName}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async downloadLeagueBadges() {
        this.log('🏆 Starting league badge downloads...');
        
        // Create leagues directory if it doesn't exist
        const leaguesDir = path.join(this.baseDir, 'leagues');
        if (!fs.existsSync(leaguesDir)) {
            fs.mkdirSync(leaguesDir, { recursive: true });
        }
        
        for (const leagueName of POPULAR_LEAGUES) {
            this.log(`🔍 Searching for ${leagueName}...`);
            
            const badgeUrl = await this.getLeagueBadgeUrl(leagueName);
            if (badgeUrl) {
                const filename = `${leagueName.toLowerCase().replace(/\s+/g, '-')}-badge.png`;
                const filePath = path.join(leaguesDir, filename);
                
                try {
                    // Check if file already exists
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        if (stats.size > 5000) {
                            this.skippedCount++;
                            this.log(`⏭️  ${filename} already exists (${stats.size} bytes)`);
                            continue;
                        } else {
                            fs.unlinkSync(filePath);
                            this.log(`🗑️  Removed invalid ${filename} (${stats.size} bytes)`);
                        }
                    }
                    
                    execSync(`curl -s "${badgeUrl}" -o "${filePath}"`, { stdio: 'pipe' });
                    
                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        if (stats.size > 5000) {
                            this.successCount++;
                            this.log(`✅ Downloaded ${filename} (${stats.size} bytes)`);
                        } else {
                            fs.unlinkSync(filePath);
                            this.errorCount++;
                            this.log(`❌ Invalid file size for ${filename}: ${stats.size} bytes`);
                        }
                    }
                } catch (error) {
                    this.errorCount++;
                    this.log(`❌ Error downloading ${filename}: ${error.message}`);
                }
            } else {
                this.errorCount++;
                this.log(`❌ No badge URL found for ${leagueName}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async validateAllBadges() {
        this.log('🔍 Validating all badge files...');
        
        const files = fs.readdirSync(this.baseDir);
        const pngFiles = files.filter(f => f.endsWith('.png') && !f.includes('corrected'));
        
        let validCount = 0;
        let invalidCount = 0;
        
        for (const file of pngFiles) {
            const filePath = path.join(this.baseDir, file);
            try {
                const stats = fs.statSync(filePath);
                if (stats.size > 5000) {
                    validCount++;
                } else {
                    invalidCount++;
                    this.log(`❌ Invalid file: ${file} (${stats.size} bytes)`);
                }
            } catch (error) {
                invalidCount++;
                this.log(`❌ Error checking ${file}: ${error.message}`);
            }
        }
        
        this.log(`📊 Validation results: ${validCount} valid, ${invalidCount} invalid badges`);
        return { validCount, invalidCount };
    }

    printSummary() {
        const total = this.successCount + this.errorCount + this.skippedCount;
        this.log('\n📊 DOWNLOAD SUMMARY');
        this.log('========================');
        this.log(`✅ Successfully downloaded: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped (already exist): ${this.skippedCount}`);
        this.log(`📈 Total processed: ${total}`);
        this.log(`🎯 Success rate: ${total > 0 ? Math.round((this.successCount / total) * 100) : 0}%`);
    }

    async run() {
        this.log('🚀 Starting CORRECT badge download process');
        this.log('=====================================');
        
        // Clear log file
        fs.writeFileSync(this.logFile, '');
        
        // Download team badges
        await this.downloadTeamBadges();
        
        // Download league badges
        await this.downloadLeagueBadges();
        
        // Validate all badges
        await this.validateAllBadges();
        
        // Print summary
        this.printSummary();
        
        this.log('✅ Correct badge download process completed!');
    }
}

// Run the downloader
if (require.main === module) {
    const downloader = new CorrectBadgeDownloader();
    downloader.run().catch(console.error);
}

module.exports = CorrectBadgeDownloader;