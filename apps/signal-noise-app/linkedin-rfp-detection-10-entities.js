#!/usr/bin/env node

/**
 * 3-Phase LinkedIn RFP Detection for 10 Sports Entities
 * 
 * Phase 1: LinkedIn posts search for RFP keywords
 * Phase 2: LinkedIn jobs search for PM/digital roles
 * Phase 3: LinkedIn company search for partnerships
 */

const fs = require('fs');

// Target entities
const entities = [
    'Universitario de Deportes',
    'Cienciano', 
    'Melgar',
    'Alianza Atlético',
    'Binational',
    'Barcelona SC',
    'Liga Deportiva Universitaria',
    'Emelec',
    'CSD Macara',
    'Universidad San Martín'
];

// RFP keywords for Phase 1
const rfpKeywords = [
    'RFP', 'Request for Proposal', 'tender', 'licitación', 'convocatoria',
    'software development', 'mobile app', 'digital transformation', 'app development',
    'web development', 'software project', 'digital services', 'technology procurement',
    'IT services', 'application development', 'platform development', 'digital solutions'
];

// Digital role keywords for Phase 2
const digitalRoleKeywords = [
    'Digital Project Manager', 'Product Manager', 'Software Development Manager',
    'Technology Manager', 'Digital Services Manager', 'IT Manager', 'Digital Transformation',
    'Application Development', 'Mobile Development', 'Web Development', 'Software Engineer'
];

// Partnership keywords for Phase 3
const partnershipKeywords = [
    'partnership', 'collaboration', 'strategic alliance', 'technology partnership',
    'digital collaboration', 'software partnership', 'technology integration',
    'mobile partnership', 'app partnership', 'web partnership'
];

// Search queries for each phase
function generateSearchQueries(entity) {
    return {
        phase1_posts: rfpKeywords.map(keyword => `${entity} ${keyword}`),
        phase2_jobs: digitalRoleKeywords.map(keyword => `${entity} ${keyword}`),
        phase3_partnerships: partnershipKeywords.map(keyword => `${entity} ${keyword}`)
    };
}

// Exclusion rules
function shouldExcludeResult(title, description, entity) {
    const excludeTerms = [
        'stadium', 'infrastructure', 'construction', 'hospitality', 'catering',
        'merchandise', 'apparel', 'kit', 'sponsorship only', 'naming rights',
        'ticketing only', 'event management', 'security', 'cleaning', 'maintenance',
        'facilities', 'real estate', 'architecture', 'engineering'
    ];
    
    const content = (title + ' ' + description).toLowerCase();
    return excludeTerms.some(term => content.includes(term));
}

// Classification logic
function classifyRFPResult(result, phase) {
    const { title, description, url } = result;
    
    // Strong RFP indicators
    const strongRFPIndicators = [
        'request for proposal', 'rfp', 'tender', 'licitación', 'convocatoria',
        'bid submission', 'proposal submission', 'vendor selection'
    ];
    
    // Early signal indicators  
    const earlySignalIndicators = [
        'hiring', 'recruiting', 'looking for', 'seeking', 'digital transformation',
        'digital manager', 'technology lead', 'software project', 'app development'
    ];
    
    const content = (title + ' ' + description).toLowerCase();
    
    // Check for strong RFP signals
    if (strongRFPIndicators.some(indicator => content.includes(indicator))) {
        return 'ACTIVE_RFP';
    }
    
    // Check for early signals
    if (earlySignalIndicators.some(indicator => content.includes(indicator))) {
        return 'SIGNAL';
    }
    
    // Check if it's a partnership opportunity
    if (content.includes('partnership') || content.includes('collaboration')) {
        return 'SIGNAL';
    }
    
    return 'EXCLUDE';
}

// Main processing function
async function processEntity(entity) {
    console.log(`\n🔍 Processing: ${entity}`);
    console.log('='.repeat(60));
    
    const queries = generateSearchQueries(entity);
    const results = {
        entity,
        processed_at: new Date().toISOString(),
        phase1_posts: [],
        phase2_jobs: [],
        phase3_partnerships: [],
        summary: {
            active_rfps: 0,
            signals: 0,
            excluded: 0,
            total_searches: 0
        }
    };
    
    try {
        // Phase 1: LinkedIn Posts Search
        console.log(`\n📋 Phase 1: LinkedIn Posts Search for ${entity}`);
        console.log('-'.repeat(40));
        
        for (const query of queries.phase1_posts.slice(0, 3)) { // Limit to first 3 keywords
            console.log(`🔎 Searching: "${query}"`);
            
            try {
                const searchResults = await BrightDataSearchEngine({
                    query: query,
                    engine: 'google'
                });
                
                if (searchResults && searchResults.results) {
                    const filteredResults = searchResults.results
                        .filter(result => !shouldExcludeResult(result.title, result.description || '', entity))
                        .map(result => ({
                            ...result,
                            classification: classifyRFPResult(result, 'phase1'),
                            query: query,
                            phase: 'phase1_posts'
                        }));
                    
                    results.phase1_posts.push(...filteredResults);
                    results.summary.total_searches++;
                    
                    // Log findings
                    const activeRfps = filteredResults.filter(r => r.classification === 'ACTIVE_RFP');
                    const signals = filteredResults.filter(r => r.classification === 'SIGNAL');
                    
                    if (activeRfps.length > 0) {
                        console.log(`🎯 Found ${activeRfps.length} ACTIVE RFPs`);
                        activeRfps.forEach(rfp => {
                            console.log(`   - ${rfp.title}`);
                            console.log(`     ${rfp.url}`);
                        });
                    }
                    
                    if (signals.length > 0) {
                        console.log(`📶 Found ${signals.length} SIGNALS`);
                        signals.forEach(signal => {
                            console.log(`   - ${signal.title}`);
                            console.log(`     ${signal.url}`);
                        });
                    }
                    
                    if (activeRfps.length === 0 && signals.length === 0) {
                        console.log(`❌ No relevant RFP content found`);
                    }
                }
            } catch (error) {
                console.log(`❌ Error searching "${query}": ${error.message}`);
            }
        }
        
        // Phase 2: LinkedIn Jobs Search
        console.log(`\n💼 Phase 2: LinkedIn Jobs Search for ${entity}`);
        console.log('-'.repeat(40));
        
        for (const query of queries.phase2_jobs.slice(0, 2)) { // Limit to first 2 keywords
            console.log(`🔎 Searching: "${query}"`);
            
            try {
                const searchResults = await BrightDataSearchEngine({
                    query: `${query} site:linkedin.com/jobs`,
                    engine: 'google'
                });
                
                if (searchResults && searchResults.results) {
                    const filteredResults = searchResults.results
                        .filter(result => !shouldExcludeResult(result.title, result.description || '', entity))
                        .map(result => ({
                            ...result,
                            classification: classifyRFPResult(result, 'phase2'),
                            query: query,
                            phase: 'phase2_jobs'
                        }));
                    
                    results.phase2_jobs.push(...filteredResults);
                    results.summary.total_searches++;
                    
                    // Log findings
                    const signals = filteredResults.filter(r => r.classification === 'SIGNAL');
                    
                    if (signals.length > 0) {
                        console.log(`📶 Found ${signals.length} HIRING SIGNALS`);
                        signals.forEach(signal => {
                            console.log(`   - ${signal.title}`);
                            console.log(`     ${signal.url}`);
                        });
                    }
                    
                    if (signals.length === 0) {
                        console.log(`❌ No relevant hiring content found`);
                    }
                }
            } catch (error) {
                console.log(`❌ Error searching "${query}": ${error.message}`);
            }
        }
        
        // Phase 3: LinkedIn Company/Partnership Search
        console.log(`\n🤝 Phase 3: LinkedIn Partnership Search for ${entity}`);
        console.log('-'.repeat(40));
        
        for (const query of queries.phase3_partnerships.slice(0, 2)) { // Limit to first 2 keywords
            console.log(`🔎 Searching: "${query}"`);
            
            try {
                const searchResults = await BrightDataSearchEngine({
                    query: `${query} site:linkedin.com/company OR site:linkedin.com/posts`,
                    engine: 'google'
                });
                
                if (searchResults && searchResults.results) {
                    const filteredResults = searchResults.results
                        .filter(result => !shouldExcludeResult(result.title, result.description || '', entity))
                        .map(result => ({
                            ...result,
                            classification: classifyRFPResult(result, 'phase3'),
                            query: query,
                            phase: 'phase3_partnerships'
                        }));
                    
                    results.phase3_partnerships.push(...filteredResults);
                    results.summary.total_searches++;
                    
                    // Log findings
                    const signals = filteredResults.filter(r => r.classification === 'SIGNAL');
                    
                    if (signals.length > 0) {
                        console.log(`📶 Found ${signals.length} PARTNERSHIP SIGNALS`);
                        signals.forEach(signal => {
                            console.log(`   - ${signal.title}`);
                            console.log(`     ${signal.url}`);
                        });
                    }
                    
                    if (signals.length === 0) {
                        console.log(`❌ No relevant partnership content found`);
                    }
                }
            } catch (error) {
                console.log(`❌ Error searching "${query}": ${error.message}`);
            }
        }
        
        // Calculate summary
        const allResults = [
            ...results.phase1_posts,
            ...results.phase2_jobs,
            ...results.phase3_partnerships
        ];
        
        results.summary.active_rfps = allResults.filter(r => r.classification === 'ACTIVE_RFP').length;
        results.summary.signals = allResults.filter(r => r.classification === 'SIGNAL').length;
        results.summary.excluded = allResults.filter(r => r.classification === 'EXCLUDE').length;
        
        console.log(`\n📊 SUMMARY for ${entity}:`);
        console.log(`   Active RFPs: ${results.summary.active_rfps}`);
        console.log(`   Early Signals: ${results.summary.signals}`);
        console.log(`   Excluded: ${results.summary.excluded}`);
        console.log(`   Total Searches: ${results.summary.total_searches}`);
        
        return results;
        
    } catch (error) {
        console.error(`Error processing ${entity}:`, error);
        return {
            entity,
            error: error.message,
            processed_at: new Date().toISOString()
        };
    }
}

// Process all entities
async function processAllEntities() {
    console.log('🚀 Starting 3-Phase LinkedIn RFP Detection for 10 Sports Entities');
    console.log('='.repeat(80));
    
    const allResults = [];
    
    for (const entity of entities) {
        const result = await processEntity(entity);
        allResults.push(result);
        
        // Add delay between entities to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Save results
    const finalReport = {
        processed_at: new Date().toISOString(),
        total_entities: entities.length,
        entities_processed: allResults.length,
        strategy: '3-phase LinkedIn RFP detection',
        phases: [
            'Phase 1: LinkedIn posts search for RFP keywords',
            'Phase 2: LinkedIn jobs search for PM/digital roles',
            'Phase 3: LinkedIn company search for partnerships'
        ],
        results: allResults,
        global_summary: {
            total_active_rfps: allResults.reduce((sum, r) => sum + (r.summary?.active_rfps || 0), 0),
            total_signals: allResults.reduce((sum, r) => sum + (r.summary?.signals || 0), 0),
            total_excluded: allResults.reduce((sum, r) => sum + (r.summary?.excluded || 0), 0),
            total_searches: allResults.reduce((sum, r) => sum + (r.summary?.total_searches || 0), 0)
        }
    };
    
    // Save to file
    const filename = `linkedin-rfp-detection-10-entities-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(finalReport, null, 2));
    
    console.log('\n' + '='.repeat(80));
    console.log('🏁 FINAL RESULTS SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Entities Processed: ${finalReport.entities_processed}`);
    console.log(`Total Active RFPs Found: ${finalReport.global_summary.total_active_rfps}`);
    console.log(`Total Early Signals Found: ${finalReport.global_summary.total_signals}`);
    console.log(`Total Excluded: ${finalReport.global_summary.total_excluded}`);
    console.log(`Total Searches Conducted: ${finalReport.global_summary.total_searches}`);
    console.log(`Results saved to: ${filename}`);
    
    // Show entities with findings
    const entitiesWithFindings = allResults.filter(r => 
        (r.summary?.active_rfps > 0) || (r.summary?.signals > 0)
    );
    
    if (entitiesWithFindings.length > 0) {
        console.log('\n🎯 ENTITIES WITH RFP OPPORTUNITIES:');
        entitiesWithFindings.forEach(result => {
            console.log(`\n${result.entity}:`);
            if (result.summary.active_rfps > 0) {
                console.log(`  🚨 ${result.summary.active_rfps} ACTIVE RFPs`);
            }
            if (result.summary.signals > 0) {
                console.log(`  📶 ${result.summary.signals} EARLY SIGNALS`);
            }
        });
    } else {
        console.log('\n❌ No RFP opportunities found for any entities');
    }
    
    return finalReport;
}

// BrightData Search Engine function using MCP call
async function BrightDataSearchEngine(params) {
    try {
        // Use the BrightData MCP tool
        const results = await mcp__brightdata__search_engine({
            query: params.query,
            engine: params.engine || 'google'
        });
        
        return results;
    } catch (error) {
        console.error(`BrightData search error for "${params.query}":`, error);
        return null;
    }
}

// Run the main function
if (require.main === module) {
    processAllEntities()
        .then(results => {
            console.log('\n✅ 3-Phase LinkedIn RFP Detection completed successfully');
        })
        .catch(error => {
            console.error('❌ Error in 3-Phase LinkedIn RFP Detection:', error);
            process.exit(1);
        });
}

module.exports = { processAllEntities, processEntity };