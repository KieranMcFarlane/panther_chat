#!/usr/bin/env node

/**
 * Alternative Spanish Club Badge Downloader
 * Uses multiple data sources and fallback methods
 */

const fs = require('fs-extra');
const path = require('path');

// Try to import node-fetch
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    console.log('Installing node-fetch...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit', cwd: __dirname });
    fetch = require('node-fetch');
}

// Configuration
const BADGES_DIR = path.join(__dirname, 'badges');

// Spanish clubs with their known badge URLs from various sources
const SPANISH_CLUBS = [
    {
        name: 'Atletico Madrid',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/xvowux1449892712.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/f/f4/Atl%C3%A9tico_Madrid_logo.svg/1200px-Atl%C3%A9tico_Madrid_logo.svg.png'
        ]
    },
    {
        name: 'Valencia',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/qxvxvq1449893218.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/6/6a/Valencia_CF_logo.svg/1200px-Valencia_CF_logo.svg.png'
        ]
    },
    {
        name: 'Sevilla',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/wyxwqu1449892993.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/6/65/Sevilla_FC_logo.svg/1200px-Sevilla_FC_logo.svg.png'
        ]
    },
    {
        name: 'Villarreal',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/vwtrtt1449893406.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/8/87/Villarreal_CF_logo.svg/1200px-Villarreal_CF_logo.svg.png'
        ]
    },
    {
        name: 'Real Betis',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/ythpsv1449893333.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/c/c5/Real_Betis_logo.svg/1200px-Real_Betis_logo.svg.png'
        ]
    },
    {
        name: 'Athletic Bilbao',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/urpxqr1449893470.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/8/83/Athletic_Bilbao_logo.svg/1200px-Athletic_Bilbao_logo.svg.png'
        ]
    },
    {
        name: 'Real Sociedad',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/vtqvty1449892860.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/4/45/Real_Sociedad_logo.svg/1200px-Real_Sociedad_logo.svg.png'
        ]
    },
    {
        name: 'Celta Vigo',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/uwxqty1449892668.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/2/2d/RC_Celta_de_Vigo_logo.svg/1200px-RC_Celta_de_Vigo_logo.svg.png'
        ]
    },
    {
        name: 'Getafe',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/tqwtty1449893078.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/1/11/Getafe_CF_logo.svg/1200px-Getafe_CF_logo.svg.png'
        ]
    },
    {
        name: 'Granada',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/sqqwru1449893148.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/7/72/Granada_CF_logo.svg/1200px-Granada_CF_logo.svg.png'
        ]
    },
    {
        name: 'Osasuna',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/uwtvwv1449893545.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/4/45/CA_Osasuna_logo.svg/1200px-CA_Osasuna_logo.svg.png'
        ]
    },
    {
        name: 'Mallorca',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/wtrrur1449893611.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/9/9a/RCD_Mallorca_logo.svg/1200px-RCD_Mallorca_logo.svg.png'
        ]
    },
    {
        name: 'Alaves',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/vxvwqw1449893740.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/7/76/Deportivo_Alav%C3%A9s_logo.svg/1200px-Deportivo_Alav%C3%A9s_logo.svg.png'
        ]
    },
    {
        name: 'Espanyol',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/wxtrtr1449893678.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/2/2a/RCD_Espanyol_logo.svg/1200px-RCD_Espanyol_logo.svg.png'
        ]
    },
    {
        name: 'Elche',
        possibleUrls: [
            'https://www.thesportsdb.com/images/media/team/badge/trtrut1449893815.png',
            'https://upload.wikimedia.org/wikipedia/en/thumb/f/fb/Elche_CF_logo.svg/1200px-Elche_CF_logo.svg.png'
        ]
    }
];

/**
 * Try to download badge from multiple sources
 */
async function downloadBadge(clubInfo) {
    const { name, possibleUrls } = clubInfo;
    
    console.log(`🔍 Trying to download badge for: ${name}`);
    
    // Generate filename
    const safeName = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    const filename = `${safeName}-badge.png`;
    const badgePath = path.join(BADGES_DIR, filename);
    
    // Check if file already exists
    if (await fs.pathExists(badgePath)) {
        console.log(`✅ Badge already exists: ${filename}`);
        return {
            clubName: name,
            success: true,
            filename,
            localPath: badgePath,
            method: 'existing'
        };
    }
    
    // Try each possible URL
    for (let i = 0; i < possibleUrls.length; i++) {
        const url = possibleUrls[i];
        console.log(`📡 Trying URL ${i + 1}/${possibleUrls.length}: ${url.substring(0, 60)}...`);
        
        try {
            const response = await fetch(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            if (response.ok) {
                const imageBuffer = await response.buffer();
                
                // Check if it's actually an image
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.startsWith('image/')) {
                    await fs.ensureDir(BADGES_DIR);
                    await fs.writeFile(badgePath, imageBuffer);
                    
                    console.log(`✅ Successfully downloaded: ${filename} (${contentType})`);
                    return {
                        clubName: name,
                        success: true,
                        filename,
                        localPath: badgePath,
                        url,
                        method: 'direct-url'
                    };
                } else {
                    console.log(`⚠️ Not an image: ${contentType}`);
                }
            } else {
                console.log(`⚠️ HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.log(`❌ URL failed: ${error.message}`);
        }
        
        // Small delay between attempts
        if (i < possibleUrls.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    
    // Try API approach as last resort
    console.log(`🔄 Trying API approach for: ${name}`);
    try {
        const result = await tryAPIDownload(name);
        if (result.success) {
            return result;
        }
    } catch (error) {
        console.log(`❌ API approach failed: ${error.message}`);
    }
    
    console.log(`❌ All methods failed for: ${name}`);
    return {
        clubName: name,
        success: false,
        error: 'All download methods failed'
    };
}

/**
 * Try API download as fallback
 */
async function tryAPIDownload(clubName) {
    const API_BASE = 'https://www.thesportsdb.com/api/v2/json/3';
    
    try {
        const searchUrl = `${API_BASE}/searchteams.php?t=${encodeURIComponent(clubName)}`;
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.teams && data.teams.length > 0) {
            const club = data.teams[0];
            const badgeUrl = club.strTeamBadge;
            
            if (badgeUrl) {
                console.log(`📥 Found via API: ${badgeUrl}`);
                
                const imageResponse = await fetch(badgeUrl);
                if (imageResponse.ok) {
                    const imageBuffer = await imageResponse.buffer();
                    
                    const safeName = clubName.toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')
                        .replace(/^-|-$/g, '');
                    
                    const filename = `${safeName}-badge.png`;
                    const badgePath = path.join(BADGES_DIR, filename);
                    
                    await fs.ensureDir(BADGES_DIR);
                    await fs.writeFile(badgePath, imageBuffer);
                    
                    return {
                        clubName,
                        success: true,
                        filename,
                        localPath: badgePath,
                        badgeUrl,
                        method: 'api'
                    };
                }
            }
        }
        
        throw new Error('No badge found in API response');
        
    } catch (error) {
        throw new Error(`API download failed: ${error.message}`);
    }
}

/**
 * Process all clubs
 */
async function downloadAllClubs() {
    console.log('🚀 Starting Alternative Spanish Club Badge Download');
    console.log(`📋 Processing ${SPANISH_CLUBS.length} clubs\n`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Ensure badges directory exists
    await fs.ensureDir(BADGES_DIR);
    
    for (let i = 0; i < SPANISH_CLUBS.length; i++) {
        const clubInfo = SPANISH_CLUBS[i];
        const progress = `${i + 1}/${SPANISH_CLUBS.length}`;
        
        console.log(`\n📊 Progress: ${progress} - ${clubInfo.name}`);
        console.log('━'.repeat(50));
        
        const result = await downloadBadge(clubInfo);
        results.push(result);
        
        if (result.success) {
            successful++;
        } else {
            failed++;
        }
        
        // Show current stats
        const successRate = ((successful / (i + 1)) * 100).toFixed(1);
        console.log(`📈 Current success rate: ${successRate}% (${successful}/${i + 1})`);
        
        // Delay between requests (1 second)
        if (i < SPANISH_CLUBS.length - 1) {
            console.log('⏳ Waiting 1 second before next request...\n');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Generate final report
    console.log('\n🎉 Download Complete!');
    console.log('═'.repeat(60));
    console.log('📊 FINAL RESULTS:');
    console.log(`   Total clubs processed: ${SPANISH_CLUBS.length}`);
    console.log(`   Successful downloads:  ${successful}`);
    console.log(`   Failed downloads:      ${failed}`);
    console.log(`   Overall success rate:  ${((successful / SPANISH_CLUBS.length) * 100).toFixed(1)}%`);
    console.log('═'.repeat(60));
    
    // Show successful downloads
    if (successful > 0) {
        console.log('\n✅ SUCCESSFUL DOWNLOADS:');
        results
            .filter(r => r.success)
            .forEach(r => {
                console.log(`   • ${r.clubName}: ${r.filename} (${r.method})`);
            });
    }
    
    // Show failed downloads
    if (failed > 0) {
        console.log('\n❌ FAILED DOWNLOADS:');
        results
            .filter(r => !r.success)
            .forEach(r => {
                console.log(`   • ${r.clubName}: ${r.error}`);
            });
    }
    
    // Save results to file
    const reportPath = path.join(BADGES_DIR, 'spanish-clubs-alternative-download-report.json');
    await fs.writeFile(reportPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        total: SPANISH_CLUBS.length,
        successful,
        failed,
        results
    }, null, 2));
    
    console.log(`\n💾 Report saved to: ${reportPath}`);
    
    return {
        total: SPANISH_CLUBS.length,
        successful,
        failed,
        results
    };
}

// Main execution
async function main() {
    try {
        console.log('🎯 Alternative Spanish Club Badge Downloader');
        console.log('========================================\n');
        
        const results = await downloadAllClubs();
        
        if (results.successful > 0) {
            console.log('\n✅ Process completed with some successes!');
        } else {
            console.log('\n❌ All downloads failed - check network connectivity');
        }
        
    } catch (error) {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main()
        .then(() => {
            console.log('\n🏁 Script finished');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Unhandled error:', error);
            process.exit(1);
        });
}

module.exports = { downloadBadge, downloadAllClubs };