#!/usr/bin/env node

/**
 * Simple Spanish Club Badge Downloader
 * Direct API approach without MCP server dependency
 */

const fs = require('fs-extra');
const path = require('path');

// Import node-fetch dynamically
let fetch;
try {
    fetch = require('node-fetch');
} catch (e) {
    console.log('Installing node-fetch...');
    const { execSync } = require('child_process');
    execSync('npm install node-fetch@2', { stdio: 'inherit' });
    fetch = require('node-fetch');
}

// Configuration
const BADGES_DIR = path.join(__dirname, '..', '..', 'badges');
const API_BASE = 'https://www.thesportsdb.com/api/v2/json/3';

// Spanish clubs to download
const SPANISH_CLUBS = [
    'Atletico Madrid',
    'Valencia', 
    'Sevilla',
    'Villarreal',
    'Real Betis',
    'Athletic Bilbao',
    'Real Sociedad',
    'Celta Vigo',
    'Getafe',
    'Granada',
    'Osasuna',
    'Mallorca',
    'Alaves',
    'Espanyol',
    'Elche'
];

/**
 * Download badge for a single club
 */
async function downloadClubBadge(clubName) {
    try {
        console.log(`🔍 Searching for: ${clubName}`);
        
        // Search for the club
        const searchUrl = `${API_BASE}/searchteams.php?t=${encodeURIComponent(clubName)}`;
        console.log(`📡 Querying: ${searchUrl}`);
        
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (!data.teams || data.teams.length === 0) {
            throw new Error('Club not found in TheSportsDB');
        }
        
        const club = data.teams[0];
        console.log(`✅ Found club: ${club.strTeam} (${club.strLeague})`);
        
        const badgeUrl = club.strTeamBadge;
        
        if (!badgeUrl || badgeUrl === '' || badgeUrl === null) {
            throw new Error('No badge available for this club');
        }
        
        console.log(`📥 Downloading badge from: ${badgeUrl}`);
        
        // Download the badge image
        const imageResponse = await fetch(badgeUrl);
        
        if (!imageResponse.ok) {
            throw new Error(`Badge download failed: HTTP ${imageResponse.status}`);
        }
        
        const imageBuffer = await imageResponse.buffer();
        
        // Generate filename
        const safeName = clubName.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        
        const filename = `${safeName}-badge.png`;
        const badgePath = path.join(BADGES_DIR, filename);
        
        // Ensure badges directory exists
        await fs.ensureDir(BADGES_DIR);
        
        // Save the badge
        await fs.writeFile(badgePath, imageBuffer);
        
        console.log(`✅ Downloaded: ${filename}`);
        
        return {
            clubName,
            success: true,
            filename,
            localPath: badgePath,
            badgeUrl,
            teamInfo: {
                name: club.strTeam,
                league: club.strLeague,
                country: club.strCountry,
                formedYear: club.intFormedYear
            }
        };
        
    } catch (error) {
        console.log(`❌ Error with ${clubName}: ${error.message}`);
        return {
            clubName,
            success: false,
            error: error.message
        };
    }
}

/**
 * Process all clubs with delay between requests
 */
async function downloadAllClubs() {
    console.log('🚀 Starting Spanish Club Badge Download');
    console.log(`📋 Processing ${SPANISH_CLUBS.length} clubs\n`);
    
    const results = [];
    let successful = 0;
    let failed = 0;
    
    // Ensure badges directory exists
    await fs.ensureDir(BADGES_DIR);
    
    for (let i = 0; i < SPANISH_CLUBS.length; i++) {
        const clubName = SPANISH_CLUBS[i];
        const progress = `${i + 1}/${SPANISH_CLUBS.length}`;
        
        console.log(`\n📊 Progress: ${progress} - ${clubName}`);
        console.log('━'.repeat(50));
        
        const result = await downloadClubBadge(clubName);
        results.push(result);
        
        if (result.success) {
            successful++;
        } else {
            failed++;
        }
        
        // Show current stats
        const successRate = ((successful / (i + 1)) * 100).toFixed(1);
        console.log(`📈 Current success rate: ${successRate}% (${successful}/${i + 1})`);
        
        // Delay between requests (1.5 seconds to be respectful)
        if (i < SPANISH_CLUBS.length - 1) {
            console.log('⏳ Waiting 1.5 seconds before next request...\n');
            await new Promise(resolve => setTimeout(resolve, 1500));
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
                console.log(`   • ${r.clubName}: ${r.filename}`);
                if (r.teamInfo) {
                    console.log(`     League: ${r.teamInfo.league}`);
                    console.log(`     Country: ${r.teamInfo.country}`);
                }
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
    const reportPath = path.join(BADGES_DIR, 'spanish-clubs-download-report.json');
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

/**
 * Test API connectivity first
 */
async function testAPI() {
    console.log('🔧 Testing TheSportsDB API connectivity...');
    
    try {
        // Test with a known club (Real Madrid)
        const testUrl = `${API_BASE}/searchteams.php?t=Real%20Madrid`;
        const response = await fetch(testUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.teams && data.teams.length > 0) {
            console.log('✅ API connectivity test passed');
            console.log(`   Found: ${data.teams[0].strTeam}`);
            return true;
        } else {
            console.log('⚠️ API returned empty results');
            return false;
        }
        
    } catch (error) {
        console.log(`❌ API connectivity test failed: ${error.message}`);
        return false;
    }
}

// Main execution
async function main() {
    try {
        console.log('🎯 Spanish Club Badge Downloader');
        console.log('================================\n');
        
        // Test API first
        const apiWorking = await testAPI();
        
        if (!apiWorking) {
            console.log('\n❌ Cannot proceed - API is not working');
            process.exit(1);
        }
        
        console.log('\n🚀 Starting download process...\n');
        
        const results = await downloadAllClubs();
        
        if (results.successful > 0) {
            console.log('\n✅ Process completed with some successes!');
        } else {
            console.log('\n❌ All downloads failed - check API or network connectivity');
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

module.exports = { downloadClubBadge, downloadAllClubs, testAPI };