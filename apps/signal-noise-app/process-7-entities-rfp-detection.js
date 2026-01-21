#!/usr/bin/env node

/**
 * RFP Detection for 7 Specific Sports Entities
 * 3-Phase LinkedIn Strategy: Posts → Jobs → Company Search
 * Focus: Digital/Software/Mobile App Opportunities Only
 */

const fs = require('fs');
const path = require('path');

// RFP keyword patterns for digital opportunities
const RFP_KEYWORDS = [
    'request for proposal', 'RFP', 'tender', 'procurement', 'bid invitation',
    'digital transformation', 'app development', 'software development',
    'mobile app', 'web application', 'digital platform', 'technology partner',
    'digital services', 'IT procurement', 'software solution', 'tech partnership',
    'digital innovation', 'app RFP', 'software tender', 'digital project'
];

// Digital role keywords for early signals
const DIGITAL_ROLE_KEYWORDS = [
    'project manager digital', 'digital project manager', 'product manager',
    'digital product manager', 'app development manager', 'software project manager',
    'digital transformation manager', 'technology project manager', 'IT project manager',
    'digital services manager', 'mobile app manager', 'web platform manager'
];

// Partnership keywords for company search
const PARTNERSHIP_KEYWORDS = [
    'technology partnership', 'digital partnership', 'software partnership',
    'app partnership', 'digital services partner', 'technology supplier',
    'digital vendor', 'software vendor', 'app development partner',
    'digital solutions partner', 'IT partnership', 'technology integration'
];

// Exclusion keywords (non-digital opportunities)
const EXCLUSION_KEYWORDS = [
    'stadium construction', 'hospitality', 'catering', 'merchandise', 'apparel',
    'event management', 'ticketing', 'security', 'cleaning', 'maintenance',
    'construction', 'infrastructure', 'retail', 'food & beverage', 'facilities',
    'sponsorship deal', 'broadcasting rights', 'media rights', 'kit supplier'
];

/**
 * RFP Detection with BrightData LinkedIn Integration
 */
async function detectRFPsForEntity(entityName, entityType = 'club') {
    console.log(`\n🔍 Processing ${entityName} (${entityType})`);
    console.log('=' .repeat(60));
    
    const results = {
        entity: entityName,
        entity_type: entityType,
        phases: {
            phase1_posts: { status: 'pending', results: [], url_count: 0 },
            phase2_jobs: { status: 'pending', results: [], url_count: 0 },
            phase3_company: { status: 'pending', results: [], url_count: 0 }
        },
        final_tag: 'UNKNOWN',
        confidence: 0,
        processing_time: 0,
        errors: []
    };
    
    const startTime = Date.now();
    
    try {
        // Phase 1: LinkedIn Posts Search for RFP Keywords
        console.log(`\n📋 Phase 1: LinkedIn Posts Search - RFP Keywords`);
        const postsResults = await searchLinkedInPosts(entityName, RFP_KEYWORDS);
        results.phases.phase1_posts = {
            status: 'completed',
            results: postsResults.results,
            url_count: postsResults.url_count,
            search_time: postsResults.search_time
        };
        
        // Phase 2: LinkedIn Jobs Search for Digital Roles
        console.log(`\n💼 Phase 2: LinkedIn Jobs Search - Digital Roles`);
        const jobsResults = await searchLinkedInJobs(entityName, DIGITAL_ROLE_KEYWORDS);
        results.phases.phase2_jobs = {
            status: 'completed',
            results: jobsResults.results,
            url_count: jobsResults.url_count,
            search_time: jobsResults.search_time
        };
        
        // Phase 3: LinkedIn Company Search for Partnerships
        console.log(`\n🤝 Phase 3: LinkedIn Company Search - Partnerships`);
        const companyResults = await searchLinkedInCompany(entityName, PARTNERSHIP_KEYWORDS);
        results.phases.phase3_company = {
            status: 'completed',
            results: companyResults.results,
            url_count: companyResults.url_count,
            search_time: companyResults.search_time
        };
        
        // Apply exclusion rules and determine final tag
        const finalAnalysis = analyzeAndTagResults(results);
        results.final_tag = finalAnalysis.tag;
        results.confidence = finalAnalysis.confidence;
        results.reasoning = finalAnalysis.reasoning;
        results.exclusions_applied = finalAnalysis.exclusions_applied;
        
        console.log(`\n✅ Final Result: ${results.final_tag} (Confidence: ${results.confidence}%)`);
        console.log(`📝 Reasoning: ${results.reasoning}`);
        
    } catch (error) {
        results.errors.push(error.message);
        console.error(`❌ Error processing ${entityName}:`, error.message);
    }
    
    results.processing_time = Date.now() - startTime;
    return results;
}

/**
 * Phase 1: LinkedIn Posts Search for RFP Keywords
 */
async function searchLinkedInPosts(entityName, keywords) {
    const startTime = Date.now();
    console.log(`   🔍 Searching posts for: ${entityName}`);
    
    try {
        // Create search query with entity name and RFP keywords
        const searchQuery = `${entityName} ${keywords.slice(0, 5).join(' OR ')}`;
        
        // Use BrightData LinkedIn search
        const response = await fetch('https://api.brightdata.com/serp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: searchQuery,
                engine: 'linkedin',
                num_results: 10,
                date_range: 'm3' // Last 3 months
            })
        });
        
        if (!response.ok) {
            throw new Error(`BrightData API error: ${response.status}`);
        }
        
        const data = await response.json();
        const results = [];
        
        // Process LinkedIn posts results
        if (data.organic_results && Array.isArray(data.organic_results)) {
            for (const result of data.organic_results) {
                if (result.title && result.link) {
                    // Check for RFP-related content
                    const isRFPContent = keywords.some(keyword => 
                        result.title.toLowerCase().includes(keyword.toLowerCase()) ||
                        (result.snippet && result.snippet.toLowerCase().includes(keyword.toLowerCase()))
                    );
                    
                    // Check for exclusion keywords
                    const hasExclusions = EXCLUSION_KEYWORDS.some(exclusion =>
                        result.title.toLowerCase().includes(exclusion.toLowerCase()) ||
                        (result.snippet && result.snippet.toLowerCase().includes(exclusion.toLowerCase()))
                    );
                    
                    if (isRFPContent && !hasExclusions) {
                        results.push({
                            type: 'linkedin_post',
                            title: result.title,
                            url: result.link,
                            snippet: result.snippet || '',
                            date: result.date || 'Unknown',
                            relevance_score: calculateRelevanceScore(result.title + ' ' + (result.snippet || ''), keywords),
                            digital_focused: isDigitalFocused(result.title + ' ' + (result.snippet || ''))
                        });
                    }
                }
            }
        }
        
        console.log(`   📊 Found ${results.length} relevant posts`);
        return {
            results: results.slice(0, 5), // Top 5 results
            url_count: results.length,
            search_time: Date.now() - startTime
        };
        
    } catch (error) {
        console.log(`   ⚠️  Posts search failed: ${error.message}`);
        return { results: [], url_count: 0, search_time: Date.now() - startTime, error: error.message };
    }
}

/**
 * Phase 2: LinkedIn Jobs Search for Digital Roles
 */
async function searchLinkedInJobs(entityName, roleKeywords) {
    const startTime = Date.now();
    console.log(`   💼 Searching jobs for: ${entityName}`);
    
    try {
        // Create search query for digital roles
        const searchQuery = `${entityName} ${roleKeywords.slice(0, 3).join(' OR ')}`;
        
        const response = await fetch('https://api.brightdata.com/serp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: searchQuery,
                engine: 'linkedin_jobs',
                num_results: 8,
                date_range: 'm2' // Last 2 months
            })
        });
        
        if (!response.ok) {
            throw new Error(`BrightData API error: ${response.status}`);
        }
        
        const data = await response.json();
        const results = [];
        
        // Process job results
        if (data.jobs && Array.isArray(data.jobs)) {
            for (const job of data.jobs) {
                if (job.title && job.link) {
                    // Check if it's a digital role
                    const isDigitalRole = roleKeywords.some(keyword =>
                        job.title.toLowerCase().includes(keyword.toLowerCase()) ||
                        (job.description && job.description.toLowerCase().includes(keyword.toLowerCase()))
                    );
                    
                    // Check for early RFP signals
                    const hasEarlySignal = hasEarlyRFPSignal(job.title + ' ' + (job.description || ''));
                    
                    if (isDigitalRole) {
                        results.push({
                            type: 'linkedin_job',
                            title: job.title,
                            url: job.link,
                            company: job.company_name || entityName,
                            location: job.location || 'Unknown',
                            posted_date: job.posted_date || 'Unknown',
                            early_signal: hasEarlySignal,
                            signal_strength: hasEarlySignal ? calculateSignalStrength(job.title + ' ' + (job.description || '')) : 0
                        });
                    }
                }
            }
        }
        
        console.log(`   📊 Found ${results.length} digital job postings`);
        return {
            results: results.slice(0, 3), // Top 3 results
            url_count: results.length,
            search_time: Date.now() - startTime
        };
        
    } catch (error) {
        console.log(`   ⚠️  Jobs search failed: ${error.message}`);
        return { results: [], url_count: 0, search_time: Date.now() - startTime, error: error.message };
    }
}

/**
 * Phase 3: LinkedIn Company Search for Partnerships
 */
async function searchLinkedInCompany(entityName, partnershipKeywords) {
    const startTime = Date.now();
    console.log(`   🏢 Searching company info for: ${entityName}`);
    
    try {
        // Search for partnership announcements
        const searchQuery = `${entityName} ${partnershipKeywords.slice(0, 4).join(' OR ')}`;
        
        const response = await fetch('https://api.brightdata.com/serp', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: searchQuery,
                engine: 'linkedin',
                num_results: 6,
                date_range: 'm6' // Last 6 months
            })
        });
        
        if (!response.ok) {
            throw new Error(`BrightData API error: ${response.status}`);
        }
        
        const data = await response.json();
        const results = [];
        
        // Process company results
        if (data.organic_results && Array.isArray(data.organic_results)) {
            for (const result of data.organic_results) {
                if (result.title && result.link) {
                    // Check for partnership content
                    const isPartnershipContent = partnershipKeywords.some(keyword =>
                        result.title.toLowerCase().includes(keyword.toLowerCase()) ||
                        (result.snippet && result.snippet.toLowerCase().includes(keyword.toLowerCase()))
                    );
                    
                    // Check if it's active or completed
                    const isCompleted = isCompletedPartnership(result.title + ' ' + (result.snippet || ''));
                    
                    if (isPartnershipContent && !isCompleted) {
                        results.push({
                            type: 'linkedin_partnership',
                            title: result.title,
                            url: result.link,
                            snippet: result.snippet || '',
                            date: result.date || 'Unknown',
                            partnership_type: identifyPartnershipType(result.title + ' ' + (result.snippet || '')),
                            status: 'active'
                        });
                    }
                }
            }
        }
        
        console.log(`   📊 Found ${results.length} partnership opportunities`);
        return {
            results: results.slice(0, 3), // Top 3 results
            url_count: results.length,
            search_time: Date.now() - startTime
        };
        
    } catch (error) {
        console.log(`   ⚠️  Company search failed: ${error.message}`);
        return { results: [], url_count: 0, search_time: Date.now() - startTime, error: error.message };
    }
}

/**
 * Analyze results and apply tagging logic
 */
function analyzeAndTagResults(results) {
    const phase1 = results.phases.phase1_posts;
    const phase2 = results.phases.phase2_jobs;
    const phase3 = results.phases.phase3_company;
    
    let confidence = 0;
    let tag = 'UNKNOWN';
    let reasoning = '';
    let exclusions_applied = [];
    
    // Count total relevant findings
    const totalFindings = phase1.url_count + phase2.url_count + phase3.url_count;
    
    // Check for exclusions
    const hasExclusions = checkForExclusions(results);
    if (hasExclusions.length > 0) {
        exclusions_applied = hasExclusions;
    }
    
    // Tagging logic
    if (totalFindings === 0) {
        tag = 'EXCLUDE';
        reasoning = 'No relevant RFP or digital opportunities found';
        confidence = 90;
    } else if (phase1.url_count > 0) {
        // Direct RFP announcements found
        tag = 'ACTIVE_RFP';
        confidence = Math.min(90, 50 + (phase1.url_count * 15));
        reasoning = `Found ${phase1.url_count} direct RFP announcements in LinkedIn posts`;
    } else if (phase2.url_count > 0) {
        // Early signals from job postings
        const hasStrongSignals = phase2.results.some(job => job.early_signal && job.signal_strength > 7);
        tag = hasStrongSignals ? 'SIGNAL' : 'EARLY_SIGNAL';
        confidence = Math.min(80, 30 + (phase2.url_count * 12));
        reasoning = `Found ${phase2.url_count} digital role postings indicating potential RFP activity`;
    } else if (phase3.url_count > 0) {
        // Partnership opportunities
        tag = 'SIGNAL';
        confidence = Math.min(70, 25 + (phase3.url_count * 10));
        reasoning = `Found ${phase3.url_count} digital partnership opportunities`;
    }
    
    // Apply exclusions if found
    if (exclusions_applied.length > 0) {
        confidence = Math.max(confidence - 20, 30);
        reasoning += ` | Exclusions applied: ${exclusions_applied.join(', ')}`;
    }
    
    return {
        tag,
        confidence,
        reasoning,
        exclusions_applied
    };
}

/**
 * Helper functions
 */
function calculateRelevanceScore(text, keywords) {
    const matches = keywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    return Math.min(10, matches * 2);
}

function isDigitalFocused(text) {
    const digitalKeywords = ['digital', 'software', 'app', 'mobile', 'web', 'technology', 'IT'];
    return digitalKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function hasEarlyRFPSignal(text) {
    const signalKeywords = ['new project', 'digital initiative', 'transformation', 'modernization', 'platform'];
    return signalKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function calculateSignalStrength(text) {
    const strongSignals = ['request', 'proposal', 'tender', 'procurement'];
    const weakSignals = ['exploring', 'considering', 'planning'];
    
    if (strongSignals.some(signal => text.toLowerCase().includes(signal))) {
        return 9;
    } else if (weakSignals.some(signal => text.toLowerCase().includes(signal))) {
        return 5;
    }
    return 3;
}

function isCompletedPartnership(text) {
    const completedKeywords = ['completed', 'finished', 'ended', 'closed', 'announced', 'signed'];
    return completedKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function identifyPartnershipType(text) {
    if (text.toLowerCase().includes('app') || text.toLowerCase().includes('mobile')) {
        return 'app_development';
    } else if (text.toLowerCase().includes('software') || text.toLowerCase().includes('platform')) {
        return 'software_development';
    } else if (text.toLowerCase().includes('digital') || text.toLowerCase().includes('transformation')) {
        return 'digital_transformation';
    }
    return 'general_technology';
}

function checkForExclusions(results) {
    const exclusions = [];
    
    // Check all results for exclusion keywords
    const allResults = [
        ...results.phases.phase1_posts.results,
        ...results.phases.phase2_jobs.results,
        ...results.phases.phase3_company.results
    ];
    
    for (const result of allResults) {
        const text = (result.title + ' ' + (result.snippet || '')).toLowerCase();
        for (const exclusion of EXCLUSION_KEYWORDS) {
            if (text.includes(exclusion.toLowerCase())) {
                if (!exclusions.includes(exclusion)) {
                    exclusions.push(exclusion);
                }
            }
        }
    }
    
    return exclusions;
}

/**
 * Main execution function
 */
async function main() {
    console.log('🚀 Starting RFP Detection for 7 Sports Entities');
    console.log('Target: Digital/Software/Mobile App Opportunities');
    console.log('Strategy: 3-Phase LinkedIn Search (Posts → Jobs → Company)');
    console.log('=' .repeat(80));
    
    // Load environment variables
    require('dotenv').config();
    
    if (!process.env.BRIGHTDATA_API_TOKEN) {
        throw new Error('BRIGHTDATA_API_TOKEN environment variable is required');
    }
    
    // Define the 7 entities to process
    const entities = [
        { name: 'Juventus FC', type: 'club' },
        { name: 'Golden State Warriors', type: 'club' },
        { name: 'Inter Milan', type: 'club' },
        { name: 'Real Madrid C.F.', type: 'club' },
        { name: 'Manchester City FC', type: 'club' },
        { name: 'Toronto Arrows', type: 'club' },
        { name: 'Celta Vigo', type: 'club' }
    ];
    
    const results = [];
    const startTime = Date.now();
    
    // Process each entity
    for (const entity of entities) {
        const result = await detectRFPsForEntity(entity.name, entity.type);
        results.push(result);
        
        // Add delay between entities to respect API limits
        if (entities.indexOf(entity) < entities.length - 1) {
            console.log('\n⏱️  Waiting 3 seconds before next entity...\n');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    // Generate summary report
    const totalTime = Date.now() - startTime;
    console.log('\n' + '='.repeat(80));
    console.log('📊 RFP DETECTION SUMMARY REPORT');
    console.log('=' .repeat(80));
    
    const activeRFPs = results.filter(r => r.final_tag === 'ACTIVE_RFP');
    const signals = results.filter(r => r.final_tag.includes('SIGNAL'));
    const excluded = results.filter(r => r.final_tag === 'EXCLUDE');
    
    console.log(`\n🎯 TOTAL ENTITIES PROCESSED: ${results.length}`);
    console.log(`🔥 ACTIVE RFP OPPORTUNITIES: ${activeRFPs.length}`);
    console.log(`📡 SIGNAL/EARLY SIGNALS: ${signals.length}`);
    console.log(`❌ EXCLUDED: ${excluded.length}`);
    console.log(`⏱️  TOTAL PROCESSING TIME: ${Math.round(totalTime / 1000)} seconds`);
    
    // Show detailed results
    console.log('\n📋 DETAILED RESULTS:');
    console.log('-'.repeat(80));
    
    for (const result of results) {
        console.log(`\n🏟️  ${result.entity}`);
        console.log(`   Status: ${result.final_tag} (${result.confidence}% confidence)`);
        console.log(`   Processing: ${Math.round(result.processing_time / 1000)}s`);
        console.log(`   Reasoning: ${result.reasoning}`);
        
        if (result.phases.phase1_posts.url_count > 0) {
            console.log(`   📋 Posts: ${result.phases.phase1_posts.url_count} RFP-related posts`);
        }
        if (result.phases.phase2_jobs.url_count > 0) {
            console.log(`   💼 Jobs: ${result.phases.phase2_jobs.url_count} digital role postings`);
        }
        if (result.phases.phase3_company.url_count > 0) {
            console.log(`   🤝 Partnerships: ${result.phases.phase3_company.url_count} opportunities`);
        }
        
        // Show actual URLs for high-confidence results
        if (result.confidence > 60 && (result.phases.phase1_posts.results.length > 0 || result.phases.phase2_jobs.results.length > 0)) {
            console.log(`   🔗 Key URLs:`);
            const allUrls = [
                ...result.phases.phase1_posts.results.map(r => ({ url: r.url, type: 'RFP Post', title: r.title.substring(0, 60) + '...' })),
                ...result.phases.phase2_jobs.results.map(r => ({ url: r.url, type: 'Digital Job', title: r.title.substring(0, 60) + '...' }))
            ].slice(0, 3); // Top 3 URLs
            
            allUrls.forEach(item => {
                console.log(`      • ${item.type}: ${item.title}`);
                console.log(`        ${item.url}`);
            });
        }
    }
    
    // Priority recommendations
    console.log('\n🎯 PRIORITY RECOMMENDATIONS:');
    console.log('-'.repeat(80));
    
    const prioritizedResults = results
        .filter(r => r.final_tag !== 'EXCLUDE')
        .sort((a, b) => b.confidence - a.confidence);
    
    if (prioritizedResults.length > 0) {
        console.log('\n📈 High-Priority Targets (Immediate Action):');
        prioritizedResults.slice(0, 3).forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.entity} - ${result.final_tag}`);
            console.log(`   Confidence: ${result.confidence}% | ${result.reasoning}`);
        });
    } else {
        console.log('\n⚠️  No immediate RFP opportunities detected among these entities.');
        console.log('   Consider expanding search criteria or monitoring for future developments.');
    }
    
    // Save results
    const outputPath = path.join(__dirname, 'rfp-detection-7-entities-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
        metadata: {
            timestamp: new Date().toISOString(),
            total_entities: results.length,
            processing_time_seconds: Math.round(totalTime / 1000),
            strategy: '3-phase-linkedin-search',
            focus: 'digital-software-mobile-app'
        },
        summary: {
            active_rfps: activeRFPs.length,
            signals: signals.length,
            excluded: excluded.length
        },
        results: results
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: ${outputPath}`);
    console.log('\n✅ RFP Detection Complete!');
    
    return results;
}

// Run the main function
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    detectRFPsForEntity,
    main
};