#!/usr/bin/env node

/**
 * Spanish Club Badge Downloader
 * Downloads badges for specified Spanish clubs using the artificial-intelligence-mcp server
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Spanish clubs to download badges for
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
 * Call MCP server tool
 */
async function callMCPTool(toolName, params) {
    return new Promise((resolve, reject) => {
        const request = {
            jsonrpc: "2.0",
            id: Date.now(),
            method: "tools/call",
            params: {
                name: toolName,
                arguments: params
            }
        };

        console.log(`🔧 Calling MCP tool: ${toolName} with params:`, params);

        // Spawn the MCP server process
        const mcpProcess = spawn('node', ['dist/index.js'], {
            cwd: __dirname,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        let response = '';
        let error = '';
        let timeout;

        // Set timeout
        timeout = setTimeout(() => {
            mcpProcess.kill();
            reject(new Error(`MCP tool call timeout for ${toolName}`));
        }, 30000);

        mcpProcess.stdout.on('data', (data) => {
            response += data.toString();
        });

        mcpProcess.stderr.on('data', (data) => {
            error += data.toString();
        });

        mcpProcess.on('close', (code) => {
            clearTimeout(timeout);
            
            if (code === 0) {
                try {
                    // Parse JSON-RPC response
                    const lines = response.trim().split('\n');
                    const lastLine = lines[lines.length - 1];
                    const jsonResponse = JSON.parse(lastLine);
                    
                    if (jsonResponse.result && jsonResponse.result.content) {
                        const content = jsonResponse.result.content[0];
                        const text = JSON.parse(content.text);
                        resolve(text);
                    } else {
                        reject(new Error('Invalid MCP response format'));
                    }
                } catch (parseError) {
                    console.error('Response parsing error:', response);
                    reject(new Error(`Failed to parse MCP response: ${parseError.message}`));
                }
            } else {
                reject(new Error(`MCP server failed with code ${code}: ${error}`));
            }
        });

        mcpProcess.on('error', (err) => {
            clearTimeout(timeout);
            reject(new Error(`Failed to start MCP server: ${err.message}`));
        });

        // Send the request
        mcpProcess.stdin.write(JSON.stringify(request) + '\n');
        mcpProcess.stdin.end();
    });
}

/**
 * Download badge for a single club
 */
async function downloadClubBadge(clubName) {
    try {
        console.log(`📥 Downloading badge for: ${clubName}`);
        
        const result = await callMCPTool('download_club_badge', {
            club_name: clubName
        });

        if (result.success) {
            console.log(`✅ Successfully downloaded badge for ${clubName}`);
            console.log(`   Local path: ${result.localPath}`);
            console.log(`   Badge URL: ${result.badgeUrl}`);
            return {
                clubName,
                success: true,
                localPath: result.localPath,
                badgeUrl: result.badgeUrl,
                filename: result.filename
            };
        } else {
            console.log(`❌ Failed to download badge for ${clubName}: ${result.message}`);
            return {
                clubName,
                success: false,
                error: result.message
            };
        }
    } catch (error) {
        console.log(`❌ Error downloading badge for ${clubName}: ${error.message}`);
        return {
            clubName,
            success: false,
            error: error.message
        };
    }
}

/**
 * Download badges for all Spanish clubs
 */
async function downloadAllSpanishClubs() {
    console.log('🚀 Starting Spanish Club Badge Download Process');
    console.log(`📋 Downloading badges for ${SPANISH_CLUBS.length} Spanish clubs...\n`);

    const results = [];
    let successful = 0;
    let failed = 0;

    for (const clubName of SPANISH_CLUBS) {
        const result = await downloadClubBadge(clubName);
        results.push(result);

        if (result.success) {
            successful++;
        } else {
            failed++;
        }

        // Small delay between downloads to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 1000));

        console.log(''); // Empty line for readability
    }

    // Generate summary
    console.log('\n🎉 Spanish Club Badge Download Complete!');
    console.log('━'.repeat(60));
    console.log(`📊 Summary:`);
    console.log(`   Total clubs:     ${SPANISH_CLUBS.length}`);
    console.log(`   Successful:      ${successful}`);
    console.log(`   Failed:          ${failed}`);
    console.log(`   Success rate:    ${((successful / SPANISH_CLUBS.length) * 100).toFixed(1)}%`);
    console.log('━'.repeat(60));

    // Show failed downloads
    if (failed > 0) {
        console.log('\n❌ Failed downloads:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`   • ${result.clubName}: ${result.error}`);
        });
    }

    // Show successful downloads
    console.log('\n✅ Successful downloads:');
    results.filter(r => r.success).forEach(result => {
        console.log(`   • ${result.clubName}: ${result.filename}`);
    });

    return {
        total: SPANISH_CLUBS.length,
        successful,
        failed,
        results
    };
}

/**
 * Alternative: Try direct API approach
 */
async function directAPIDownload() {
    console.log('🔄 Trying direct API approach...');
    
    const fetch = (await import('node-fetch')).default;
    const fs = (await import('fs-extra')).default;
    const BADGES_DIR = path.join(__dirname, '..', '..', 'badges');
    
    await fs.ensureDir(BADGES_DIR);
    
    const results = [];
    
    for (const clubName of SPANISH_CLUBS) {
        try {
            console.log(`🔍 Searching for ${clubName}...`);
            
            // Search for the club
            const searchUrl = `https://www.thesportsdb.com/api/v2/json/3/searchteams.php?t=${encodeURIComponent(clubName)}`;
            const searchResponse = await fetch(searchUrl);
            const searchData = await searchResponse.json();
            
            if (!searchData?.teams || searchData.teams.length === 0) {
                console.log(`❌ Club not found: ${clubName}`);
                results.push({
                    clubName,
                    success: false,
                    error: 'Club not found in TheSportsDB'
                });
                continue;
            }
            
            const club = searchData.teams[0];
            const badgeUrl = club.strTeamBadge;
            
            if (!badgeUrl) {
                console.log(`❌ No badge available for: ${clubName}`);
                results.push({
                    clubName,
                    success: false,
                    error: 'No badge available'
                });
                continue;
            }
            
            // Download the badge
            console.log(`📥 Downloading badge for ${clubName}...`);
            const imageResponse = await fetch(badgeUrl);
            const imageBuffer = await imageResponse.buffer();
            
            // Save the badge
            const safeName = clubName.toLowerCase().replace(/[^a-z0-9]/g, '-');
            const filename = `${safeName}-badge.png`;
            const badgePath = path.join(BADGES_DIR, filename);
            
            await fs.writeFile(badgePath, imageBuffer);
            
            console.log(`✅ Downloaded badge for ${clubName}: ${filename}`);
            results.push({
                clubName,
                success: true,
                localPath: badgePath,
                badgeUrl,
                filename
            });
            
        } catch (error) {
            console.log(`❌ Error downloading ${clubName}: ${error.message}`);
            results.push({
                clubName,
                success: false,
                error: error.message
            });
        }
        
        // Delay between downloads
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
}

// Main execution
async function main() {
    try {
        console.log('🎯 Spanish Club Badge Downloader');
        console.log('================================\n');

        // Try MCP approach first
        console.log('📡 Attempting MCP server approach...\n');
        try {
            const mcpResults = await downloadAllSpanishClubs();
            
            if (mcpResults.successful > 0) {
                console.log('\n✅ MCP approach completed successfully!');
                return mcpResults;
            }
        } catch (mcpError) {
            console.log(`⚠️ MCP approach failed: ${mcpError.message}`);
            console.log('🔄 Falling back to direct API approach...\n');
        }

        // Fallback to direct API approach
        console.log('🌐 Using direct API approach...\n');
        const directResults = await directAPIDownload();
        
        const successful = directResults.filter(r => r.success).length;
        const failed = directResults.filter(r => !r.success).length;
        
        console.log('\n🎉 Direct API Download Complete!');
        console.log('━'.repeat(60));
        console.log(`📊 Summary:`);
        console.log(`   Total clubs:     ${SPANISH_CLUBS.length}`);
        console.log(`   Successful:      ${successful}`);
        console.log(`   Failed:          ${failed}`);
        console.log(`   Success rate:    ${((successful / SPANISH_CLUBS.length) * 100).toFixed(1)}%`);
        console.log('━'.repeat(60));
        
        return {
            total: SPANISH_CLUBS.length,
            successful,
            failed,
            results: directResults,
            method: 'direct-api'
        };
        
    } catch (error) {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
    main()
        .then(result => {
            console.log('\n🏁 Script completed successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Script failed:', error);
            process.exit(1);
        });
}

export { downloadAllSpanishClubs, directAPIDownload };