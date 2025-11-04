#!/usr/bin/env node

/**
 * Download actual SVG files and create proper badge files
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const BADGES_DIR = path.join(process.cwd(), 'badges');
const APP_BADGES_DIR = path.join(process.cwd(), 'apps/signal-noise-app/public/badges');

// SVG URLs for the clubs we want
const SVG_BADGE_URLS = {
    'Paris Saint Germain': 'https://upload.wikimedia.org/wikipedia/en/e/e9/Paris_Saint-Germain_F.C._logo.svg',
    'Marseille': 'https://upload.wikimedia.org/wikipedia/en/d/d8/Olympique_de_Marseille_logo.svg',
    'Lyon': 'https://upload.wikimedia.org/wikipedia/en/a/a4/Olympique_Lyonnais_logo.svg',
    'Monaco': 'https://upload.wikimedia.org/wikipedia/en/f/f3/AS_Monaco_FC_logo.svg',
    'Lille': 'https://upload.wikimedia.org/wikipedia/en/e/e8/LOSC_Lille_logo.svg',
    'Napoli': 'https://upload.wikimedia.org/wikipedia/en/f/f5/SSC_Napoli_logo.svg',
    'Inter Milan': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Inter_Milan_logo.svg',
    'AC Milan': 'https://upload.wikimedia.org/wikipedia/en/d/d2/AC_Milan_logo.svg',
    'Lazio': 'https://upload.wikimedia.org/wikipedia/en/2/2b/SS_Lazio_logo.svg',
    'Roma': 'https://upload.wikimedia.org/wikipedia/en/f/f7/AS_Roma_logo.svg',
    'Atalanta': 'https://upload.wikimedia.org/wikipedia/en/1/14/Atalanta_BC_logo.svg',
    'Juventus': 'https://upload.wikimedia.org/wikipedia/en/1/18/Juventus_F.C._logo.svg'
};

class SVGBadgeDownloader {
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
    generateFileName(clubName, extension = 'svg') {
        return clubName
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '') + `-badge.${extension}`;
    }

    /**
     * Download SVG file
     */
    async downloadSVG(clubName, svgUrl) {
        return new Promise((resolve, reject) => {
            const svgFileName = this.generateFileName(clubName, 'svg');
            const svgFilePath = path.join(BADGES_DIR, svgFileName);
            
            https.get(svgUrl, (response) => {
                if (response.statusCode === 200) {
                    const fileStream = fs.createWriteStream(svgFilePath);
                    response.pipe(fileStream);
                    
                    fileStream.on('finish', () => {
                        fileStream.close();
                        resolve({ success: true, svgFileName, svgFilePath });
                    });
                    
                    fileStream.on('error', (error) => {
                        reject(error);
                    });
                } else {
                    reject(new Error(`HTTP ${response.statusCode}`));
                }
            }).on('error', reject);
        });
    }

    /**
     * Convert SVG to PNG using ImageMagick if available
     */
    async convertSVGToPNG(svgFilePath, clubName) {
        try {
            const pngFileName = this.generateFileName(clubName, 'png');
            const pngFilePath = path.join(BADGES_DIR, pngFileName);
            
            // Try to convert using ImageMagick
            execSync(`convert "${svgFilePath}" "${pngFilePath}"`, { 
                stdio: 'ignore',
                timeout: 10000
            });
            
            return { success: true, pngFileName, pngFilePath };
        } catch (error) {
            this.log(`ImageMagick conversion failed for ${clubName}: ${error.message}`, 'WARN');
            return { success: false, error: error.message };
        }
    }

    /**
     * Process all clubs
     */
    async processAllClubs() {
        this.log('🚀 Starting SVG badge download and conversion');
        
        // Ensure directories exist
        await fs.ensureDir(BADGES_DIR);
        await fs.ensureDir(APP_BADGES_DIR);
        
        for (const [clubName, svgUrl] of Object.entries(SVG_BADGE_URLS)) {
            try {
                const pngFileName = this.generateFileName(clubName, 'png');
                const pngFilePath = path.join(BADGES_DIR, pngFileName);
                
                // Check if PNG already exists
                if (await fs.pathExists(pngFilePath)) {
                    this.log(`✅ PNG badge already exists for ${clubName}`);
                    this.results.push({ clubName, pngFileName, success: true, reason: 'Already exists' });
                    this.skipped++;
                    continue;
                }
                
                this.log(`⬇️  Downloading SVG for ${clubName}...`);
                
                // Download SVG
                const svgResult = await this.downloadSVG(clubName, svgUrl);
                
                this.log(`🔄 Converting SVG to PNG for ${clubName}...`);
                
                // Convert to PNG
                const convertResult = await this.convertSVGToPNG(svgResult.svgFilePath, clubName);
                
                if (convertResult.success) {
                    this.log(`✅ Successfully converted ${clubName} badge to PNG`);
                    this.results.push({ 
                        clubName, 
                        pngFileName: convertResult.pngFileName,
                        svgFileName: svgResult.svgFileName,
                        success: true 
                    });
                    this.downloaded++;
                } else {
                    // If conversion fails, copy SVG as PNG (fallback)
                    const fallbackFileName = this.generateFileName(clubName, 'png');
                    const fallbackPath = path.join(BADGES_DIR, fallbackFileName);
                    await fs.copy(svgResult.svgFilePath, fallbackPath);
                    
                    this.log(`⚠️  Using SVG fallback for ${clubName} (conversion failed)`);
                    this.results.push({ 
                        clubName, 
                        pngFileName: fallbackFileName,
                        svgFileName: svgResult.svgFileName,
                        success: true,
                        fallback: true
                    });
                    this.downloaded++;
                }
                
                // Copy to app directory
                const appPngPath = path.join(APP_BADGES_DIR, convertResult.success ? convertResult.pngFileName : fallbackFileName);
                await fs.copy(convertResult.success ? convertResult.pngFilePath : fallbackPath, appPngPath);
                
                // Small delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                this.log(`❌ Failed to process ${clubName}: ${error.message}`, 'ERROR');
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
        const total = Object.keys(SVG_BADGE_URLS).length;
        const successRate = ((this.downloaded / total) * 100).toFixed(1);
        
        console.log('\n' + '='.repeat(70));
        console.log('🎉 SVG BADGE DOWNLOAD COMPLETE');
        console.log('='.repeat(70));
        console.log(`📊 Summary:`);
        console.log(`   Total clubs:      ${total}`);
        console.log(`   Successfully processed: ${this.downloaded}`);
        console.log(`   Already existed:   ${this.skipped}`);
        console.log(`   Failed:           ${this.failed}`);
        console.log(`   Success rate:      ${successRate}%`);
        console.log('');
        
        console.log('✅ Successfully processed:');
        this.results
            .filter(r => r.success)
            .forEach(r => {
                if (r.fallback) {
                    console.log(`   • ${r.clubName} -> ${r.pngFileName} (SVG fallback)`);
                } else {
                    console.log(`   • ${r.clubName} -> ${r.pngFileName}`);
                }
                console.log(`     SVG: ${r.svgFileName}`);
            });
        
        if (this.skipped > 0) {
            console.log('\n✅ Already existed:');
            this.results
                .filter(r => r.success && r.reason === 'Already exists')
                .forEach(r => console.log(`   • ${r.clubName} -> ${r.pngFileName}`));
        }
        
        if (this.failed > 0) {
            console.log('\n❌ Failed to process:');
            this.results
                .filter(r => !r.success)
                .forEach(r => console.log(`   • ${r.clubName}: ${r.error}`));
        }
        
        console.log('\n📁 Files saved to:');
        console.log(`   Main: ${BADGES_DIR}`);
        console.log(`   App: ${APP_BADGES_DIR}`);
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
    const downloader = new SVGBadgeDownloader();
    downloader.run();
}

module.exports = SVGBadgeDownloader;