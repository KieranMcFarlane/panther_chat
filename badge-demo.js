#!/usr/bin/env node

/**
 * Practical Example: Batch Badge Download
 * Run this to see how the system works with your actual entities
 */

const fs = require('fs-extra');
const path = require('path');

// Configuration
const BADGES_DIR = path.join(process.cwd(), 'badges');
const LEAGUES_DIR = path.join(BADGES_DIR, 'leagues');

// Simple entity classification
function classifyEntity(entity) {
    const { type, name = '', properties = {} } = entity;
    const entityName = name.toLowerCase();
    
    // Clear classifications
    if (type === 'Club' || type === 'Team') return 'club';
    if (type === 'League') return 'league';
    
    // Name pattern classification
    if (entityName.includes('league') || 
        entityName.includes('premier') || 
        entityName.includes('championship') ||
        entityName.includes('serie') || 
        entityName.includes('bundesliga') ||
        entityName.includes('laliga')) {
        return 'league';
    }
    
    if (entityName.endsWith('fc') || 
        entityName.includes('united') || 
        entityName.includes('city') ||
        entityName.includes('athletic') ||
        entityName.includes('sporting')) {
        return 'club';
    }
    
    // Property-based classification
    if (properties.leagueId) return 'league';
    if (properties.badgePath && !properties.leagueBadgePath) return 'club';
    
    // Default
    return type === 'Organization' ? 'organization' : 'unknown';
}

// Generate badge filename
function generateBadgeName(name, type) {
    const cleanName = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    
    return type === 'league' ? `${cleanName}-league-badge.png` : `${cleanName}-badge.png`;
}

// Mock entity data (in reality, this comes from Neo4j)
const sampleEntities = [
    // Clubs
    { id: '133602', name: 'Manchester United', type: 'Club' },
    { id: 'chelsea', name: 'Chelsea', type: 'Club' },
    { id: 'arsenal', name: 'Arsenal', type: 'Club' },
    { id: 'liverpool', name: 'Liverpool', type: 'Club' },
    { id: '6603', name: 'São Paulo FC', type: 'Club' },
    { id: 'barcelona', name: 'FC Barcelona', type: 'Club' },
    { id: 'realmadrid', name: 'Real Madrid', type: 'Club' },
    { id: 'bayern', name: 'Bayern Munich', type: 'Club' },
    { id: 'juventus', name: 'Juventus', type: 'Club' },
    { id: 'acmilan', name: 'AC Milan', type: 'Club' },
    
    // Leagues
    { id: '4328', name: 'Premier League', type: 'League', properties: { leagueId: '4328' } },
    { id: 'la-liga', name: 'La Liga', type: 'League', properties: { leagueId: '4335' } },
    { id: 'serie-a', name: 'Serie A', type: 'League', properties: { leagueId: '4332' } },
    { id: 'bundesliga', name: 'Bundesliga', type: 'League', properties: { leagueId: '4331' } },
    { id: 'ligue-1', name: 'Ligue 1', type: 'League', properties: { leagueId: '4334' } },
    
    // Organizations (need classification)
    { id: 'afl', name: 'Australian Football League', type: 'Organization' },
    { id: 'ipl', name: 'Indian Premier League', type: 'Organization' },
    { id: 'mls', name: 'Major League Soccer', type: 'Organization' },
    
    // Unknown (will be classified)
    { id: 'mystery1', name: 'Something United FC', type: 'Organization' },
    { id: 'mystery2', name: 'Premier Something League', type: 'Organization' }
];

async function demonstrateClassification() {
    console.log('🔍 Entity Classification Demo');
    console.log('='.repeat(50));
    
    let clubs = 0;
    let leagues = 0;
    let organizations = 0;
    let unknown = 0;
    
    for (const entity of sampleEntities) {
        const classification = classifyEntity(entity);
        const badgeName = generateBadgeName(entity.name, classification);
        
        console.log(`${entity.name.padEnd(25)} -> ${classification.padEnd(12)} -> ${badgeName}`);
        
        // Count classifications
        switch (classification) {
            case 'club': clubs++; break;
            case 'league': leagues++; break;
            case 'organization': organizations++; break;
            default: unknown++; break;
        }
    }
    
    console.log('\n📊 Classification Summary:');
    console.log(`Clubs:         ${clubs}`);
    console.log(`Leagues:       ${leagues}`);
    console.log(`Organizations: ${organizations}`);
    console.log(`Unknown:       ${unknown}`);
    console.log(`Total:         ${sampleEntities.length}`);
}

async function demonstrateBadgeStructure() {
    console.log('\n📁 Badge File Structure Demo');
    console.log('='.repeat(50));
    
    // Ensure directories exist
    await fs.ensureDir(BADGES_DIR);
    await fs.ensureDir(LEAGUES_DIR);
    
    // Show where badges would be saved
    for (const entity of sampleEntities) {
        const classification = classifyEntity(entity);
        const badgeName = generateBadgeName(entity.name, classification);
        
        if (classification === 'league') {
            console.log(`📁 leagues/${badgeName} (League Badge)`);
        } else {
            console.log(`📁 ${badgeName} (${classification})`);
        }
    }
}

async function simulateBadgeDownload() {
    console.log('\n⬇️  Badge Download Simulation');
    console.log('='.repeat(50));
    
    let successCount = 0;
    let failCount = 0;
    let skipCount = 0;
    
    for (const entity of sampleEntities) {
        const classification = classifyEntity(entity);
        const badgeName = generateBadgeName(entity.name, classification);
        
        // Simulate checking if badge exists
        const badgePath = classification === 'league' ? 
            path.join(LEAGUES_DIR, badgeName) : 
            path.join(BADGES_DIR, badgeName);
        
        const badgeExists = await fs.pathExists(badgePath);
        
        if (badgeExists) {
            console.log(`⏭️  ${entity.name} - Badge already exists`);
            skipCount++;
        } else {
            // Simulate download success/failure
            const success = Math.random() > 0.2; // 80% success rate
            
            if (success) {
                console.log(`✅ ${entity.name} - Badge downloaded successfully`);
                successCount++;
            } else {
                console.log(`❌ ${entity.name} - Download failed`);
                failCount++;
            }
        }
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n📈 Download Summary:');
    console.log(`Successful: ${successCount}`);
    console.log(`Failed:     ${failCount}`);
    console.log(`Skipped:    ${skipCount}`);
    console.log(`Total:      ${sampleEntities.length}`);
    console.log(`Success Rate: ${((successCount / sampleEntities.length) * 100).toFixed(1)}%`);
}

async function showNextSteps() {
    console.log('\n🚀 Next Steps - Full Implementation');
    console.log('='.repeat(50));
    
    console.log('\n1. To run the full badge download:');
    console.log('   node optimized-badge-downloader.js');
    
    console.log('\n2. To test with dry run (no downloads):');
    console.log('   DRY_RUN=true node optimized-badge-downloader.js');
    
    console.log('\n3. To process with custom batch size:');
    console.log('   BATCH_SIZE=10 node optimized-badge-downloader.js');
    
    console.log('\n4. Expected for 4000+ entities:');
    console.log('   - Processing time: 2-4 hours');
    console.log('   - Success rate: 80-90%');
    console.log('   - Storage: ~50-100MB');
    console.log('   - API calls: ~4,000-5,000');
    
    console.log('\n5. Monitor progress:');
    console.log('   tail -f badges/download.log');
    console.log('   cat badges/download-progress.json');
    
    console.log('\n6. Files created:');
    console.log('   - badges/*.png (club badges)');
    console.log('   - badges/leagues/*.png (league badges)');
    console.log('   - badges/download-progress.json (progress)');
    console.log('   - badges/download.log (logs)');
    console.log('   - badges/badge-download-report.json (summary)');
}

async function main() {
    console.log('🎯 4000+ Entity Badge Management System');
    console.log('Practical Example & Demonstration');
    console.log('='.repeat(60));
    
    await demonstrateClassification();
    await demonstrateBadgeStructure();
    await simulateBadgeDownload();
    await showNextSteps();
    
    console.log('\n✨ Demo Complete! Ready for full implementation.');
    console.log('\n💡 Pro Tip: Start with a small batch to test the system:');
    console.log('   node optimized-badge-downloader.js --batch-size 5');
}

// Run the demo
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { classifyEntity, generateBadgeName };