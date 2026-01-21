#!/usr/bin/env node
/**
 * High-Priority Entity Dossier Test with BrightData MCP Integration
 *
 * This script tests the enhanced dossier generation system using:
 * 1. BrightData MCP for real-time web scraping
 * 2. Neo4j knowledge graph for entity relationships
 * 3. Supabase for caching and storage
 * 4. Enhanced intelligence scoring
 *
 * Usage: node test-brightdata-dossiers.js [--entity-id=ID] [--limit=N]
 */

const { spawn } = require('child_process');
const http = require('http');
const https = require('https');

// Configuration
const HIGH_PRIORITY_ENTITIES = [
    { id: '126', name: 'Arsenal FC', type: 'Premier League', priority: 'critical' },
    { id: '139', name: 'Manchester United', type: 'Premier League', priority: 'critical' },
    { id: '283', name: 'FC Barcelona', type: 'La Liga', priority: 'critical' },
    { id: '181', name: 'Bayern München', type: 'Bundesliga', priority: 'critical' },
    { id: '201', name: 'AC Milan', type: 'Serie A', priority: 'critical' },
    { id: '284', name: 'Atlético de Madrid', type: 'La Liga', priority: 'high' },
    { id: '184', name: 'Bayer 04 Leverkusen', type: 'Bundesliga', priority: 'high' },
    { id: '205', name: 'Atalanta', type: 'Serie A', priority: 'high' },
    { id: '167', name: 'AS Monaco', type: 'Ligue 1', priority: 'high' },
    { id: '127', name: 'Aston Villa', type: 'Premier League', priority: 'high' }
];

class BrightDataDossierTester {
    constructor() {
        this.results = [];
        this.mcpProcess = null;
        this.testStartTime = Date.now();
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : '📋';
        console.log(`${prefix} [${timestamp}] ${message}`);
    }

    async checkServerHealth() {
        this.log('Checking development server health...');

        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3005,
                path: '/api/health',
                method: 'GET',
                timeout: 5000
            }, (res) => {
                const data = [];
                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        this.log('✅ Development server is healthy');
                        resolve(true);
                    } else {
                        this.log(`Server responded with status: ${res.statusCode}`, 'error');
                        resolve(false);
                    }
                });
            });

            req.on('error', () => {
                this.log('❌ Development server not running at http://localhost:3005', 'error');
                this.log('💡 Please start server with: npm run dev');
                resolve(false);
            });

            req.on('timeout', () => {
                this.log('❌ Server health check timed out', 'error');
                resolve(false);
            });

            req.end();
        });
    }

    async startBrightDataMCP() {
        this.log('Starting BrightData MCP server...');

        return new Promise((resolve, reject) => {
            const brightDataToken = process.env.BRIGHTDATA_API_TOKEN;
            if (!brightDataToken) {
                reject(new Error('BRIGHTDATA_API_TOKEN environment variable required'));
                return;
            }

            this.mcpProcess = spawn('npx', ['@brightdata/mcp-server'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                env: {
                    ...process.env,
                    BRIGHTDATA_TOKEN: brightDataToken,
                    BRIGHTDATA_ZONE: 'linkedin_posts_monitor',
                    PORT: '8014',
                    HOST: 'localhost'
                }
            });

            this.mcpProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    this.log(`📤 MCP: ${output}`);
                }
            });

            this.mcpProcess.stderr.on('data', (data) => {
                const output = data.toString().trim();
                if (output) {
                    this.log(`❌ MCP Error: ${output}`, 'error');
                }
            });

            this.mcpProcess.on('error', (error) => {
                this.log(`MCP Process Error: ${error.message}`, 'error');
                reject(error);
            });

            // Wait for MCP server to be ready
            setTimeout(async () => {
                const isReady = await this.checkMCPServer();
                if (isReady) {
                    this.log('✅ BrightData MCP server is ready');
                    resolve();
                } else {
                    this.log('⚠️  MCP server may still be starting...', 'error');
                    resolve();
                }
            }, 3000);
        });
    }

    async checkMCPServer() {
        return new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8014,
                path: '/',
                method: 'GET',
                timeout: 3000
            }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => resolve(false));
            req.end();
        });
    }

    async generateDossierWithBrightData(entity) {
        this.log(`\n🎯 Generating dossier for: ${entity.name} (ID: ${entity.id})`);
        this.log(`   Priority: ${entity.priority} | Type: ${entity.type}`);

        const startTime = Date.now();

        try {
            // Test both standard dossier and BrightData-enhanced version
            const [standardResponse, brightDataResponse] = await Promise.allSettled([
                this.callDossierAPI(entity.id, false),
                this.callDossierAPI(entity.id, true)
            ]);

            const processingTime = Math.round((Date.now() - startTime) / 1000);

            // Analyze results
            const result = {
                entity: entity,
                processingTime,
                standard: standardResponse.status === 'fulfilled' ? standardResponse.value : null,
                brightData: brightDataResponse.status === 'fulfilled' ? brightDataResponse.value : null,
                comparison: null
            };

            if (result.standard && result.brightData) {
                result.comparison = this.compareResults(result.standard, result.brightData);
            }

            this.results.push(result);
            this.displayResults(result);

        } catch (error) {
            this.log(`Failed to generate dossier for ${entity.name}: ${error.message}`, 'error');
            this.results.push({
                entity,
                processingTime: Math.round((Date.now() - startTime) / 1000),
                error: error.message
            });
        }
    }

    async callDossierAPI(entityId, useBrightData = false) {
        const params = new URLSearchParams({
            includeSignals: 'true',
            includeConnections: 'true',
            includePOIs: 'true',
            deepResearch: useBrightData ? 'true' : 'false',
            useBrightData: useBrightData ? 'true' : 'false'
        });

        const url = `http://localhost:3005/api/entities/${entityId}/dossier?${params}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Use-BrightData': useBrightData ? 'true' : 'false'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    }

    compareResults(standard, brightData) {
        const comparison = {
            hasStandard: !!standard.dossier,
            hasBrightData: !!brightData.dossier,
            brightDataEnhanced: false,
            intelligenceDiff: null,
            processingTimeDiff: brightData.processingTime - standard.processingTime
        };

        if (standard.dossier && brightData.dossier) {
            // Compare intelligence sources
            const standardSources = standard.dossier.rawEvidence?.length || 0;
            const brightDataSources = brightData.dossier.rawEvidence?.length || 0;

            comparison.brightDataEnhanced = brightDataSources > standardSources;
            comparison.intelligenceDiff = brightDataSources - standardSources;
        }

        return comparison;
    }

    displayResults(result) {
        console.log('\n' + '='.repeat(80));
        console.log(`📊 DOSSIER RESULTS: ${result.entity.name}`);
        console.log('='.repeat(80));

        if (result.error) {
            console.log(`❌ Error: ${result.error}`);
            return;
        }

        console.log(`⏱️  Processing Time: ${result.processingTime}s`);

        if (result.standard) {
            const std = result.standard;
            console.log(`📋 Standard Dossier: ${std.dossier ? '✅ Generated' : '❌ Failed'}`);
            if (std.dossier) {
                console.log(`   • Status: ${std.dossier.status || 'Unknown'}`);
                console.log(`   • Final Score: ${std.dossier.scores?.finalScore || 'N/A'}/100`);
                console.log(`   • Signals: ${std.dossier.signals?.length || 0}`);
                console.log(`   • POIs: ${std.dossier.topPOIs?.length || 0}`);
            }
        }

        if (result.brightData) {
            const bd = result.brightData;
            console.log(`🔆 BrightData Dossier: ${bd.dossier ? '✅ Generated' : '❌ Failed'}`);
            if (bd.dossier) {
                console.log(`   • Status: ${bd.dossier.status || 'Unknown'}`);
                console.log(`   • Final Score: ${bd.dossier.scores?.finalScore || 'N/A'}/100`);
                console.log(`   • Signals: ${bd.dossier.signals?.length || 0}`);
                console.log(`   • POIs: ${bd.dossier.topPOIs?.length || 0}`);
                console.log(`   • Sources: ${bd.dossier.rawEvidence?.length || 0}`);
            }
        }

        if (result.comparison) {
            const comp = result.comparison;
            console.log(`🔍 Comparison:`);
            console.log(`   • BrightData Enhanced: ${comp.brightDataEnhanced ? '✅ Yes' : '❌ No'}`);
            console.log(`   • Additional Sources: ${comp.intelligenceDiff || 0}`);
            console.log(`   • Time Difference: ${comp.processingTimeDiff}s`);
        }

        // Access links
        if (result.standard?.dossier) {
            console.log(`   🔗 Standard: http://localhost:3005/entity-browser/${result.entity.id}/dossier`);
        }
        if (result.brightData?.dossier) {
            console.log(`   🔗 Enhanced: http://localhost:3005/entity-browser/${result.entity.id}/dossier?useBrightData=true`);
        }
    }

    async runTests(limit = 5) {
        this.log('🚀 STARTING HIGH-PRIORITY BRIGHTDATA DOSSIER TESTS');
        this.log('=' .repeat(60));

        // Check server health
        const serverHealthy = await this.checkServerHealth();
        if (!serverHealthy) {
            this.log('Exiting due to server health issues', 'error');
            return;
        }

        // Start BrightData MCP
        try {
            await this.startBrightDataMCP();
        } catch (error) {
            this.log(`Failed to start BrightData MCP: ${error.message}`, 'error');
            this.log('Continuing with standard dossier generation...', 'error');
        }

        // Test high-priority entities
        const entitiesToTest = HIGH_PRIORITY_ENTITIES.slice(0, limit);
        this.log(`\n🎯 Testing ${entitiesToTest.length} high-priority entities...`);

        for (let i = 0; i < entitiesToTest.length; i++) {
            const entity = entitiesToTest[i];
            console.log(`\n${i + 1}/${entitiesToTest.length} Processing: ${entity.name}`);

            await this.generateDossierWithBrightData(entity);

            // Brief pause between entities to avoid overwhelming the system
            if (i < entitiesToTest.length - 1) {
                console.log('⏳ Waiting 3 seconds before next entity...');
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // Display final results
        this.displaySummary();
    }

    displaySummary() {
        const totalTime = Math.round((Date.now() - this.testStartTime) / 1000);
        const successful = this.results.filter(r => !r.error);
        const withStandard = successful.filter(r => r.standard?.dossier);
        const withBrightData = successful.filter(r => r.brightData?.dossier);
        const brightDataEnhanced = successful.filter(r => r.comparison?.brightDataEnhanced);

        console.log('\n' + '='.repeat(80));
        console.log('🎉 BRIGHTDATA DOSSIER TEST SUMMARY');
        console.log('='.repeat(80));
        console.log(`⏱️  Total Time: ${totalTime}s`);
        console.log(`📊 Entities Tested: ${this.results.length}`);
        console.log(`✅ Successful: ${successful.length} (${Math.round(successful.length/this.results.length*100)}%)`);
        console.log(`📋 Standard Dossiers: ${withStandard.length}`);
        console.log(`🔆 BrightData Dossiers: ${withBrightData.length}`);
        console.log(`🚀 Enhanced by BrightData: ${brightDataEnhanced.length}`);

        if (brightDataEnhanced.length > 0) {
            console.log('\n🎯 BRIGHTDATA ENHANCEMENT RESULTS:');
            brightDataEnhanced.forEach(result => {
                console.log(`   ✅ ${result.entity.name}: +${result.comparison.intelligenceDiff} sources`);
            });
        }

        // Performance analysis
        const avgProcessingTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length;
        console.log(`\n⚡ PERFORMANCE:`);
        console.log(`   • Average Processing Time: ${Math.round(avgProcessingTime)}s`);
        console.log(`   • Success Rate: ${Math.round(successful.length/this.results.length*100)}%`);

        if (brightDataEnhanced.length > 0) {
            const avgTimeDiff = brightDataEnhanced.reduce((sum, r) => sum + (result.comparison?.processingTimeDiff || 0), 0) / brightDataEnhanced.length;
            console.log(`   • BrightData Time Overhead: ${Math.round(avgTimeDiff)}s`);
        }

        console.log('\n💡 NEXT STEPS:');
        if (brightDataEnhanced.length === successful.length) {
            console.log('✅ BrightData MCP successfully enhanced all dossiers!');
            console.log('🚀 Ready for full-scale deployment across all entities');
            console.log('📈 Recommend proceeding with batch generation');
        } else if (brightDataEnhanced.length > 0) {
            console.log(`✅ BrightData enhanced ${brightDataEnhanced.length}/${successful.length} dossiers`);
            console.log('🔧 Partial success - investigate non-enhanced cases');
        } else {
            console.log('❌ No BrightData enhancements detected');
            console.log('🔧 Check MCP server integration and API connections');
        }

        console.log('\n🔗 Access generated dossiers:');
        successful.forEach(result => {
            if (result.brightData?.dossier) {
                console.log(`   • ${result.entity.name}: http://localhost:3005/entity-browser/${result.entity.id}/dossier?useBrightData=true`);
            }
        });
    }

    async cleanup() {
        if (this.mcpProcess) {
            this.log('🛑 Stopping BrightData MCP server...');
            this.mcpProcess.kill('SIGTERM');

            // Wait for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (this.mcpProcess.connected) {
                this.mcpProcess.kill('SIGKILL');
            }
        }
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);
    let entityId = null;
    let limit = 5;

    // Parse command line arguments
    args.forEach(arg => {
        if (arg.startsWith('--entity-id=')) {
            entityId = arg.split('=')[1];
        } else if (arg.startsWith('--limit=')) {
            limit = parseInt(arg.split('=')[1]) || 5;
        } else if (arg === '--help') {
            console.log(`
High-Priority BrightData Dossier Tester

Usage: node test-brightdata-dossiers.js [options]

Options:
  --entity-id=ID    Test specific entity ID only
  --limit=N          Number of entities to test (default: 5)
  --help             Show this help message

Environment:
  BRIGHTDATA_API_TOKEN    Your BrightData API token (required)

Examples:
  node test-brightdata-dossiers.js --limit=3
  node test-brightdata-dossiers.js --entity-id=126
            `);
            process.exit(0);
        }
    });

    const tester = new BrightDataDossierTester();

    // Handle cleanup on exit
    process.on('SIGINT', async () => {
        console.log('\n🛑 Received SIGINT, cleaning up...');
        await tester.cleanup();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.log('\n🛑 Received SIGTERM, cleaning up...');
        await tester.cleanup();
        process.exit(0);
    });

    // Run tests
    if (entityId) {
        // Test single entity
        const entity = { id: entityId, name: `Entity ${entityId}`, type: 'Unknown', priority: 'test' };
        await tester.generateDossierWithBrightData(entity);
    } else {
        // Run batch test
        await tester.runTests(limit);
    }

    await tester.cleanup();
}

// Error handling
process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = BrightDataDossierTester;