#!/usr/bin/env node

/**
 * Extended Badge Downloader - Downloads more badges with better rate limiting
 * Handles API rate limits and focuses on additional clubs and leagues
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Extended list of clubs to download
const EXTENDED_CLUBS = [
    // More Premier League clubs
    'Wolverhampton Wanderers', 'Fulham', 'Brentford', 'Bournemouth', 'Nottingham Forest',
    'Luton Town', 'Sheffield United', 'Burnley', 'Coventry City', 'Middlesbrough',
    'West Bromwich Albion', 'Sunderland', 'Hull City', 'Stoke City', 'Queens Park Rangers',
    
    // More La Liga clubs
    'Athletic Bilbao', 'Villarreal', 'Real Sociedad', 'Real Betis', 'Real Valladolid',
    'Celta Vigo', 'Getafe', 'Granada', 'Cadiz', 'Alaves', 'Elche', 'Espanyol',
    
    // More Bundesliga clubs
    'Borussia Monchengladbach', 'Eintracht Frankfurt', 'VfL Wolfsburg', 'FC Augsburg',
    'VfB Stuttgart', 'FC Schalke 04', '1. FC Koln', 'Werder Bremen', 'Union Berlin',
    'Arminia Bielefeld', 'Greuther Furth',
    
    // More Serie A clubs
    'Atalanta', 'AS Roma', 'Lazio', 'Fiorentina', 'Torino', 'Hellas Verona',
    'Sassuolo', 'Udinese', 'Bologna', 'Empoli', 'Sampdoria', 'Spezia',
    
    // More Ligue 1 clubs
    'Nice', 'Saint-Etienne', 'Marseille', 'Monaco', 'Lyon', 'Lille', 'Lens',
    'Strasbourg', 'Nantes', 'Montpellier', 'Reims', 'Rennes',
    
    // More European clubs
    'Ajax', 'Feyenoord', 'PSV Eindhoven', 'AZ Alkmaar', 'FC Utrecht',
    'Benfica', 'FC Porto', 'Sporting CP', 'SC Braga',
    'Celtic', 'Rangers', 'Aberdeen', 'Hibernian',
    'Galatasaray', 'Fenerbahce', 'Besiktas', 'Basaksehir',
    'Anderlecht', 'Club Brugge', 'Standard Liege', 'Genk',
    'Olympiacos', 'Panathinaikos', 'PAOK', 'AEK Athens',
    'Salzburg', 'Rapid Wien', 'LASK', 'Sturm Graz',
    
    // More Brazilian clubs
    'Flamengo', 'Palmeiras', 'Sao Paulo', 'Santos', 'Gremio', 'Internacional',
    'Fluminense', 'Corinthians', 'Atletico Mineiro', 'Atletico Paranaense',
    'Botafogo', 'Fortaleza', 'Bahia', 'Ceara', 'Sport Recife',
    
    // More Argentine clubs
    'Boca Juniors', 'River Plate', 'Independiente', 'Racing Club', 'San Lorenzo',
    'Huracan', 'Velez Sarsfield', 'Estudiantes', 'Lanus', 'Banfield', 'Argentinos Juniors',
    
    // More international clubs
    'America', 'Guadalajara', 'Cruz Azul', 'Toluca', 'UNAM', 'Monterrey', 'Tigres',
    'Seattle Sounders', 'LA Galaxy', 'LAFC', 'Atlanta United', 'Toronto FC', 'NYCFC',
    'Yokohama F. Marinos', 'Kashima Antlers', 'Urawa Red Diamonds', 'Gamba Osaka',
    'Al Hilal', 'Al Nassr', 'Al Ittihad', 'Al Ahli', 'Al Sadd', 'Persepolis'
];

class ExtendedBadgeDownloader {
    constructor() {
        this.baseDir = '/Users/kieranmcfarlane/Downloads/panther_chat/badges';
        this.logFile = path.join(this.baseDir, 'extended-download.log');
        this.successCount = 0;
        this.errorCount = 0;
        this.skippedCount = 0;
        this.rateLimitDelay = 2000; // 2 seconds between API calls to avoid rate limiting
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
            this.log(`🔍 Searching for ${teamName}...`);
            const apiUrl = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(teamName)}`;
            const response = execSync(`curl -s "${apiUrl}"`, { encoding: 'utf8' });
            
            // Check for rate limiting error
            if (response.includes('error code: 1015')) {
                this.log(`⚠️  Rate limited for ${teamName}, waiting longer...`);
                await this.sleep(5000); // Wait 5 seconds if rate limited
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
            this.log(`❌ Error getting badge URL for ${teamName}: ${error.message}`);
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

    async downloadBadgesInBatches(clubs, batchSize = 10) {
        const totalBatches = Math.ceil(clubs.length / batchSize);
        
        for (let i = 0; i < totalBatches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, clubs.length);
            const batch = clubs.slice(start, end);
            
            this.log(`🚀 Processing batch ${i + 1}/${totalBatches} (${start + 1}-${end} of ${clubs.length})`);
            
            for (const clubName of batch) {
                const badgeUrl = await this.getTeamBadgeUrl(clubName);
                if (badgeUrl) {
                    const filename = `${clubName.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')}-badge.png`;
                    await this.downloadBadge(badgeUrl, filename);
                } else {
                    this.errorCount++;
                    this.log(`❌ No badge URL found for ${clubName}`);
                }
                
                // Rate limiting delay
                await this.sleep(this.rateLimitDelay);
            }
            
            // Extra delay between batches
            if (i < totalBatches - 1) {
                this.log(`⏳ Taking a break between batches...`);
                await this.sleep(3000);
            }
        }
    }

    async validateAllBadges() {
        this.log('🔍 Validating all badge files...');
        
        const files = fs.readdirSync(this.baseDir);
        const pngFiles = files.filter(f => f.endsWith('.png') && !f.includes('corrected') && !f.includes('test'));
        
        let validCount = 0;
        let invalidCount = 0;
        let totalSize = 0;
        
        for (const file of pngFiles) {
            const filePath = path.join(this.baseDir, file);
            try {
                const stats = fs.statSync(filePath);
                totalSize += stats.size;
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
        
        const avgSize = validCount > 0 ? Math.round(totalSize / validCount) : 0;
        this.log(`📊 Validation results: ${validCount} valid, ${invalidCount} invalid badges`);
        this.log(`📦 Total size: ${Math.round(totalSize / 1024 / 1024)}MB, Average: ${avgSize} bytes`);
        return { validCount, invalidCount, totalSize };
    }

    printSummary() {
        const total = this.successCount + this.errorCount + this.skippedCount;
        this.log('\n📊 EXTENDED DOWNLOAD SUMMARY');
        this.log('================================');
        this.log(`✅ Successfully downloaded: ${this.successCount}`);
        this.log(`❌ Failed: ${this.errorCount}`);
        this.log(`⏭️  Skipped (already exist): ${this.skippedCount}`);
        this.log(`📈 Total processed: ${total}`);
        this.log(`🎯 Success rate: ${total > 0 ? Math.round((this.successCount / total) * 100) : 0}%`);
    }

    async run() {
        this.log('🚀 Starting EXTENDED badge download process');
        this.log('=======================================');
        
        // Clear log file
        fs.writeFileSync(this.logFile, '');
        
        // Download badges in batches to avoid rate limiting
        await this.downloadBadgesInBatches(EXTENDED_CLUBS, 8); // Smaller batches to be safer
        
        // Validate all badges
        const validation = await this.validateAllBadges();
        
        // Print summary
        this.printSummary();
        
        this.log('✅ Extended badge download process completed!');
        this.log(`🎉 Now have ${validation.validCount} total valid badges!`);
    }
}

// Run the downloader
if (require.main === module) {
    const downloader = new ExtendedBadgeDownloader();
    downloader.run().catch(console.error);
}

module.exports = ExtendedBadgeDownloader;