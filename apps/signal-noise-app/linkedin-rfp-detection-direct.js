#!/usr/bin/env node

/**
 * 3-Phase LinkedIn RFP Detection for 10 Sports Entities
 * Using BrightData MCP Tool
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

// Search queries optimized for each phase
const searchQueries = [
    // Phase 1: Direct RFP searches
    { phase: 'phase1', query: '"Universitario de Deportes" RFP software development', keywords: ['RFP', 'software', 'development'] },
    { phase: 'phase1', query: '"Universitario de Deportes" licitación tecnología', keywords: ['licitación', 'tecnología'] },
    { phase: 'phase1', query: '"Cienciano" software development tender', keywords: ['tender', 'software', 'development'] },
    { phase: 'phase1', query: '"Melgar" digital transformation RFP', keywords: ['digital', 'transformation', 'RFP'] },
    { phase: 'phase1', query: '"Alianza Atlético" mobile app development', keywords: ['mobile', 'app', 'development'] },
    { phase: 'phase1', query: '"Binational" software project proposal', keywords: ['software', 'project', 'proposal'] },
    { phase: 'phase1', query: '"Barcelona SC" web development RFP', keywords: ['web', 'development', 'RFP'] },
    { phase: 'phase1', query: '"Liga Deportiva Universitaria" app development tender', keywords: ['app', 'development', 'tender'] },
    { phase: 'phase1', query: '"Emelec" digital services procurement', keywords: ['digital', 'services', 'procurement'] },
    { phase: 'phase1', query: '"CSD Macara" software development contract', keywords: ['software', 'development', 'contract'] },
    { phase: 'phase1', query: '"Universidad San Martín" IT services tender', keywords: ['IT', 'services', 'tender'] },
    
    // Phase 2: Digital hiring signals
    { phase: 'phase2', query: '"Universitario de Deportes" Digital Project Manager site:linkedin.com/jobs', keywords: ['Digital', 'Project', 'Manager'] },
    { phase: 'phase2', query: '"Barcelona SC" Software Development Manager site:linkedin.com/jobs', keywords: ['Software', 'Development', 'Manager'] },
    { phase: 'phase2', query: '"Liga Deportiva Universitaria" Technology Manager site:linkedin.com/jobs', keywords: ['Technology', 'Manager'] },
    { phase: 'phase2', query: '"Emelec" Digital Transformation Manager site:linkedin.com/jobs', keywords: ['Digital', 'Transformation', 'Manager'] },
    { phase: 'phase2', query: '"CSD Macara" IT Manager site:linkedin.com/jobs', keywords: ['IT', 'Manager'] },
    
    // Phase 3: Partnership opportunities
    { phase: 'phase3', query: '"Universitario de Deportes" technology partnership site:linkedin.com', keywords: ['technology', 'partnership'] },
    { phase: 'phase3', query: '"Barcelona SC" digital collaboration site:linkedin.com', keywords: ['digital', 'collaboration'] },
    { phase: 'phase3', query: '"Liga Deportiva Universitaria" software partnership site:linkedin.com', keywords: ['software', 'partnership'] },
    { phase: 'phase3', query: '"Emelec" mobile app partnership site:linkedin.com', keywords: ['mobile', 'app', 'partnership'] }
];

// Exclusion rules
function shouldExcludeResult(title, description) {
    const excludeTerms = [
        'stadium', 'infrastructure', 'construction', 'hospitality', 'catering',
        'merchandise', 'apparel', 'kit', 'sponsorship only', 'naming rights',
        'ticketing only', 'event management', 'security', 'cleaning', 'maintenance',
        'facilities', 'real estate', 'architecture', 'engineering', 'player transfer',
        'sports equipment', 'uniforms', 'nutrition', 'fitness equipment'
    ];
    
    const content = (title + ' ' + (description || '')).toLowerCase();
    return excludeTerms.some(term => content.includes(term));
}

// Classification logic
function classifyRFPResult(result, phase) {
    const { title, description } = result;
    const content = (title + ' ' + (description || '')).toLowerCase();
    
    // Strong RFP indicators
    const strongRFPIndicators = [
        'request for proposal', 'rfp', 'tender', 'licitación', 'convocatoria',
        'bid submission', 'proposal submission', 'vendor selection', 'procurement',
        'contract bid', 'service contract', 'software contract'
    ];
    
    // Early signal indicators  
    const earlySignalIndicators = [
        'hiring', 'recruiting', 'looking for', 'seeking', 'digital transformation',
        'digital manager', 'technology lead', 'software project', 'app development',
        'we are hiring', 'job opening', 'vacancy', 'position available'
    ];
    
    // Partnership indicators
    const partnershipIndicators = [
        'partnership', 'collaboration', 'strategic alliance', 'technology partnership',
        'digital collaboration', 'software partnership', 'joint venture', 'technology integration'
    ];
    
    // Check for strong RFP signals
    if (strongRFPIndicators.some(indicator => content.includes(indicator))) {
        return 'ACTIVE_RFP';
    }
    
    // Check for early signals (hiring, digital transformation)
    if (earlySignalIndicators.some(indicator => content.includes(indicator))) {
        return 'SIGNAL';
    }
    
    // Check for partnership opportunities
    if (partnershipIndicators.some(indicator => content.includes(indicator))) {
        return 'SIGNAL';
    }
    
    return 'EXCLUDE';
}

// Process search results
function processSearchResults(results, queryInfo) {
    if (!results || !results.organic) {
        return [];
    }
    
    return results.organic
        .filter(result => {
            // Apply exclusion rules
            if (shouldExcludeResult(result.title, result.description)) {
                return false;
            }
            
            // Only include results from relevant sources
            const relevantDomains = [
                'linkedin.com', 'tendersinfo.com', 'procurement tender.com',
                'government tender', 'rfp database', 'software development'
            ];
            
            const content = (result.title + ' ' + (result.description || '')).toLowerCase();
            const hasRelevantKeywords = queryInfo.keywords.some(keyword => 
                content.includes(keyword.toLowerCase())
            );
            
            return hasRelevantKeywords;
        })
        .map(result => ({
            title: result.title,
            url: result.link,
            description: result.description,
            classification: classifyRFPResult(result, queryInfo.phase),
            phase: queryInfo.phase,
            query: queryInfo.query,
            keywords: queryInfo.keywords
        }));
}

// Main search function
async function performRFPDetection() {
    console.log('🚀 Starting 3-Phase LinkedIn RFP Detection for 10 Sports Entities');
    console.log('='.repeat(80));
    
    const allResults = {
        processed_at: new Date().toISOString(),
        strategy: '3-phase LinkedIn RFP detection using BrightData',
        entities_processed: entities.length,
        queries_executed: 0,
        results: {
            active_rfps: [],
            signals: [],
            excluded: []
        },
        summary: {
            total_active_rfps: 0,
            total_signals: 0,
            total_excluded: 0,
            total_queries: 0,
            entities_with_findings: 0
        }
    };
    
    // Execute all search queries
    for (const queryInfo of searchQueries) {
        console.log(`\n🔎 Searching: "${queryInfo.query}"`);
        console.log(`   Phase: ${queryInfo.phase} | Keywords: ${queryInfo.keywords.join(', ')}`);
        
        try {
            const searchResults = await mcp__brightData__search_engine({
                query: queryInfo.query,
                engine: 'google'
            });
            
            allResults.queries_executed++;
            
            if (searchResults && searchResults.organic) {
                const processedResults = processSearchResults(searchResults, queryInfo);
                
                // Categorize results
                processedResults.forEach(result => {
                    if (result.classification === 'ACTIVE_RFP') {
                        allResults.results.active_rfps.push(result);
                        console.log(`   🚨 ACTIVE RFP: ${result.title}`);
                        console.log(`      URL: ${result.url}`);
                    } else if (result.classification === 'SIGNAL') {
                        allResults.results.signals.push(result);
                        console.log(`   📶 SIGNAL: ${result.title}`);
                        console.log(`      URL: ${result.url}`);
                    }
                });
                
                if (processedResults.length > 0) {
                    console.log(`   ✅ Found ${processedResults.length} relevant results`);
                } else {
                    console.log(`   ❌ No relevant results found`);
                }
            } else {
                console.log(`   ❌ No search results returned`);
            }
            
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
        
        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Calculate final summary
    allResults.summary.total_active_rfps = allResults.results.active_rfps.length;
    allResults.summary.total_signals = allResults.results.signals.length;
    allResults.summary.total_excluded = allResults.results.excluded.length;
    allResults.summary.total_queries = allResults.queries_executed;
    
    // Count entities with findings
    const entitiesWithFindings = new Set();
    [...allResults.results.active_rfps, ...allResults.results.signals].forEach(result => {
        entities.forEach(entity => {
            if (result.title.toLowerCase().includes(entity.toLowerCase()) ||
                result.query.toLowerCase().includes(entity.toLowerCase())) {
                entitiesWithFindings.add(entity);
            }
        });
    });
    allResults.summary.entities_with_findings = entitiesWithFindings.size;
    
    // Save results
    const filename = `linkedin-rfp-detection-10-entities-${Date.now()}.json`;
    fs.writeFileSync(filename, JSON.stringify(allResults, null, 2));
    
    // Display final summary
    console.log('\n' + '='.repeat(80));
    console.log('🏁 FINAL RFP DETECTION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Queries Executed: ${allResults.summary.total_queries}`);
    console.log(`Total Active RFPs Found: ${allResults.summary.total_active_rfps}`);
    console.log(`Total Early Signals Found: ${allResults.summary.total_signals}`);
    console.log(`Entities with Opportunities: ${allResults.summary.entities_with_findings}`);
    console.log(`Results saved to: ${filename}`);
    
    // Display Active RFPs
    if (allResults.results.active_rfps.length > 0) {
        console.log('\n🚨 ACTIVE RFP OPPORTUNITIES:');
        allResults.results.active_rfp.forEach((rfp, index) => {
            console.log(`\n${index + 1}. ${rfp.title}`);
            console.log(`   URL: ${rfp.url}`);
            console.log(`   Phase: ${rfp.phase}`);
            console.log(`   Query: ${rfp.query}`);
        });
    }
    
    // Display Early Signals
    if (allResults.results.signals.length > 0) {
        console.log('\n📶 EARLY SIGNALS:');
        allResults.results.signals.forEach((signal, index) => {
            console.log(`\n${index + 1}. ${signal.title}`);
            console.log(`   URL: ${signal.url}`);
            console.log(`   Phase: ${signal.phase}`);
            console.log(`   Query: ${signal.query}`);
        });
    }
    
    if (allResults.summary.total_active_rfps === 0 && allResults.summary.total_signals === 0) {
        console.log('\n❌ No RFP opportunities found for the 10 entities');
        console.log('💡 This could indicate:');
        console.log('   - No current digital/software RFPs from these clubs');
        console.log('   - RFPs are posted on local procurement sites not indexed by Google');
        console.log('   - Digital transformation is handled internally or through existing partners');
        console.log('   - Opportunities may exist but require direct outreach');
    }
    
    return allResults;
}

// Run the detection
performRFPDetection()
    .then(results => {
        console.log('\n✅ 3-Phase LinkedIn RFP Detection completed successfully');
        console.log(`📊 Results: ${results.summary.total_active_rfps} Active RFPs, ${results.summary.total_signals} Early Signals`);
    })
    .catch(error => {
        console.error('❌ Error in RFP Detection:', error);
        process.exit(1);
    });