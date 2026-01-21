#!/usr/bin/env node

/**
 * 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
 * Live execution with MCP tools integration
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  MAX_ENTITIES: 50, // Reduced for demo
  OUTPUT_FILE: `perplexity-hybrid-rfp-results-${new Date().toISOString().split('T')[0]}.json`,
  LOG_FILE: 'perplexity-hybrid-rfp-monitor.log'
};

// Global state
const STATE = {
  entities_processed: 0,
  total_rfps_detected: 0,
  verified_rfps: 0,
  rejected_rfps: 0,
  perplexity_queries: 0,
  brightdata_queries: 0,
  total_cost: 0,
  start_time: new Date(),
  results: [],
  cost_breakdown: {
    perplexity_discovery: 0,
    perplexity_validation: 0,
    perplexity_competitive_intel: 0,
    brightdata_targeted: 0,
    brightdata_broad: 0
  }
};

// Sample entities from our Neo4j query results
const SAMPLE_ENTITIES = [
  { name: "1. FC Köln", type: "Club", sport: "Football", country: "Germany", website: "https://www.fc-koeln.de" },
  { name: "Bayern München", type: "Club", sport: "Football", country: "Germany", website: "https://fcbayern.com/" },
  { name: "Arsenal", type: "Club", sport: "Football", country: "England", website: "https://www.arsenal.com/" },
  { name: "Ajax", type: "Club", sport: "Football", country: "Netherlands", website: "https://www.ajax.nl/" },
  { name: "Barcelona", type: "Club", sport: "Football", country: "Spain", website: "https://www.fcbarcelona.com/" },
  { name: "Real Madrid", type: "Club", sport: "Football", country: "Spain", website: "https://www.realmadrid.com/" },
  { name: "Manchester United", type: "Club", sport: "Football", country: "England", website: "https://www.manutd.com/" },
  { name: "Liverpool", type: "Club", sport: "Football", country: "England", website: "https://www.liverpoolfc.com/" },
  { name: "Chelsea", type: "Club", sport: "Football", country: "England", website: "https://www.chelseafc.com/" },
  { name: "Manchester City", type: "Club", sport: "Football", country: "England", website: "https://www.mancity.com/" }
];

/**
 * Enhanced logging function
 */
async function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}\n`;
  
  console.log(`[${level}] ${message}`, data || '');
  
  try {
    await fs.appendFile(CONFIG.LOG_FILE, logEntry);
  } catch (error) {
    console.error('Failed to write to log file:', error.message);
  }
}

/**
 * Calculate query cost based on token usage and type
 */
function calculateCost(type, tokens = 1000) {
  const costs = {
    perplexity_discovery: 0.01,
    perplexity_validation: 0.005,
    perplexity_competitive_intel: 0.015,
    brightdata_targeted: 0.002,
    brightdata_broad: 0.01
  };
  
  const cost = costs[type] || 0;
  STATE.total_cost += cost;
  STATE.cost_breakdown[type] = (STATE.cost_breakdown[type] || 0) + cost;
  
  return cost;
}

/**
 * Phase 1: Perplexity discovery with 5-priority approach
 */
async function perplexityDiscovery(entity) {
  const { name, type, sport, country, website } = entity;
  
  await log('INFO', `[ENTITY-START] ${STATE.entities_processed + 1} ${name} (${sport}, ${country})`);
  
  const discoveryQuery = `Research ${name} (${sport}, ${country}) for active procurement opportunities:

🎯 PRIORITY 1 - LinkedIn Official Posts (CHECK FIRST - HIGHEST SUCCESS RATE):
Search: site:linkedin.com/posts + "${name}"
Look for OFFICIAL account posts with procurement keywords:
- "invites proposals from"
- "soliciting proposals from" 
- "request for expression of interest"
- "invitation to tender"
- "call for proposals"
- "vendor selection process"
- "We're looking for" + ("digital" OR "technology" OR "partner")
- "Seeking partners for"

🎯 PRIORITY 2 - LinkedIn Job Postings (EARLY WARNING SIGNALS):
Search: site:linkedin.com/jobs company:"${name}"
Look for NEW job postings (last 3 months):
- "Project Manager" + ("Digital" OR "Transformation" OR "Implementation")
- "Program Manager" + ("Technology" OR "Digital" OR "Platform")
- "Transformation Lead"
- "Implementation Manager"

🎯 PRIORITY 3 - Known Tender Platforms (TARGETED SEARCH):
Check these specific URLs:
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: "${name}")
2. ${website || name + '.com'}/procurement
3. ${website || name + '.com'}/tenders
4. ${website || name + '.com'}/rfp
5. https://ted.europa.eu (if European organization)
6. https://www.find-tender.service.gov.uk (if UK organization)

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains:
- site:sportspro.com + "${name}" + ("RFP" OR "tender" OR "partnership announced")
- site:sportbusiness.com + "${name}" + ("digital transformation" OR "technology partner")

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + "${name}" + ("digital transformation" OR "RFP" OR "partnership")

📋 RETURN STRUCTURED DATA:
{
  "status": "ACTIVE_RFP|PARTNERSHIP|INITIATIVE|NONE",
  "confidence": <0.0-1.0>,
  "opportunities": [{
    "title": "<project title>",
    "type": "rfp|tender|partnership|initiative",
    "deadline": "<YYYY-MM-DD or null>",
    "url": "<official source URL>",
    "budget": "<estimated value or 'Not specified'>",
    "source_type": "tender_portal|linkedin|news|official_website",
    "source_date": "<YYYY-MM-DD>"
  }],
  "discovery_method": "perplexity_primary",
  "sources_checked": ["<url1>", "<url2>"]
}

If NO opportunities found, return: {"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}`;

  try {
    STATE.perplexity_queries++;
    const cost = calculateCost('perplexity_discovery');
    
    const response = await mcp__perplexity-mcp__chat_completion({
      messages: [
        { role: 'system', content: 'You are an expert RFP detection analyst for the sports industry. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: discoveryQuery }
      ],
      format: 'text',
      temperature: 0.1
    });
    
    let data;
    try {
      // Parse JSON from text response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      await log('ERROR', `Failed to parse Perplexity response for ${name}`, { error: parseError.message, response: response.content });
      return { status: 'ERROR', error: 'Invalid JSON response' };
    }
    
    // Process results
    if (data.status === 'ACTIVE_RFP') {
      const opportunity = data.opportunities[0];
      await log('SUCCESS', `[ENTITY-PERPLEXITY-RFP] ${name} (Title: ${opportunity.title}, Deadline: ${opportunity.deadline}, Budget: ${opportunity.budget})`);
      return {
        ...data,
        organization: name,
        detection_source: 'perplexity_discovery',
        validation_status: 'VERIFIED',
        cost: cost,
        discovery_priority: 1
      };
    } else if (data.status === 'PARTNERSHIP' || data.status === 'INITIATIVE') {
      const opportunity = data.opportunities?.[0] || {};
      await log('INFO', `[ENTITY-PERPLEXITY-SIGNAL] ${name} (Type: ${data.status}, Date: ${opportunity.source_date})`);
      return {
        ...data,
        organization: name,
        detection_source: 'perplexity_discovery',
        validation_status: 'VERIFIED-INDIRECT',
        cost: cost,
        discovery_priority: 1
      };
    } else {
      await log('INFO', `[ENTITY-PERPLEXITY-NONE] ${name}`);
      return { ...data, organization: name, needs_brightdata_fallback: true };
    }
    
  } catch (error) {
    await log('ERROR', `Perplexity discovery failed for ${name}`, { error: error.message });
    return { status: 'ERROR', error: error.message, organization: name, needs_brightdata_fallback: true };
  }
}

/**
 * Phase 1B: BrightData fallback for Perplexity NONE results
 */
async function brightdataFallback(entity) {
  const { name, type, sport, country, website } = entity;
  
  await log('INFO', `[ENTITY-BRIGHTDATA-FALLBACK] ${name}`);
  
  // TIER 1: Known tender domains
  const tenderDomains = [
    { domain: 'isportconnect.com/marketplace_categorie/tenders/', query: name, cost_type: 'brightdata_targeted' },
    { domain: website || `${name.toLowerCase().replace(/\s+/g, '')}.com`, query: 'RFP OR tender OR proposal', cost_type: 'brightdata_targeted' },
  ];
  
  // Add regional tender portals
  if (country.toLowerCase().includes('europe') || ['uk', 'germany', 'france', 'spain', 'italy'].includes(country.toLowerCase())) {
    tenderDomains.push({ domain: 'ted.europa.eu', query: `${name} digital`, cost_type: 'brightdata_targeted' });
  }
  if (country.toLowerCase() === 'us' || country.toLowerCase() === 'usa') {
    tenderDomains.push({ domain: 'sam.gov', query: `${name} technology`, cost_type: 'brightdata_targeted' });
  }
  
  try {
    // Try targeted domains first
    for (const domainConfig of tenderDomains) {
      STATE.brightdata_queries++;
      const cost = calculateCost(domainConfig.cost_type);
      
      const searchQuery = `site:${domainConfig.domain} ${domainConfig.query}`;
      
      const response = await mcp__brightdata-mcp__search_engine({
        query: searchQuery,
        engine: 'google'
      });
      
      if (response.results && response.results.length > 0) {
        await log('SUCCESS', `[ENTITY-BRIGHTDATA-DETECTED] ${name} (Hits: ${response.results.length}, Tier: 1)`);
        return {
          status: 'DETECTED',
          organization: name,
          detection_source: 'brightdata_fallback',
          validation_status: 'UNVERIFIED-BRIGHTDATA',
          brightdata_tier: 1,
          results: response.results,
          cost: cost,
          search_query: searchQuery
        };
      }
    }
    
    await log('INFO', `[ENTITY-NONE] ${name} (BrightData found no results)`);
    return { status: 'NONE', organization: name, detection_source: 'brightdata_fallback' };
    
  } catch (error) {
    await log('ERROR', `BrightData fallback failed for ${name}`, { error: error.message });
    return { status: 'ERROR', error: error.message, organization: name };
  }
}

/**
 * Phase 4: Enhanced Yellow Panther fit scoring algorithm
 */
function calculateFitScore(entity, opportunity) {
  const { name, type, sport, country } = entity;
  const { title, type: oppType, budget } = opportunity;
  
  let baseScore = 0;
  
  // A. Service Alignment (50% weight)
  const titleLower = (title || '').toLowerCase();
  
  if (titleLower.includes('mobile app') || titleLower.includes('app development')) {
    baseScore += 50;
  } else if (titleLower.includes('digital transformation') || titleLower.includes('digital platform')) {
    baseScore += 50;
  } else if (titleLower.includes('web platform') || titleLower.includes('website development')) {
    baseScore += 40;
  } else if (titleLower.includes('fan engagement') || titleLower.includes('fan experience')) {
    baseScore += 45;
  } else if (titleLower.includes('ticketing') || titleLower.includes('ticketing system')) {
    baseScore += 35;
  } else if (titleLower.includes('analytics') || titleLower.includes('data platform')) {
    baseScore += 30;
  } else if (titleLower.includes('streaming') || titleLower.includes('ott platform')) {
    baseScore += 40;
  }
  
  // B. Project Scope Match (30% weight)
  if (titleLower.includes('end-to-end') || titleLower.includes('full development')) {
    baseScore += 30;
  } else if (titleLower.includes('strategic partnership') || titleLower.includes('multi-year')) {
    baseScore += 25;
  } else if (titleLower.includes('implementation') && titleLower.includes('support')) {
    baseScore += 25;
  } else if (titleLower.includes('integration') || titleLower.includes('system integration')) {
    baseScore += 20;
  } else if (titleLower.includes('consulting')) {
    baseScore += 10;
  }
  
  // C. Yellow Panther Differentiators (20% weight)
  if (sport && ['football', 'soccer', 'basketball', 'tennis', 'cricket'].includes(sport.toLowerCase())) {
    baseScore += 10; // Sports industry specific
  }
  
  if (type === 'Federation' || type === 'International Federation') {
    baseScore += 8; // International federation
  }
  
  if (name.toLowerCase().includes('premier league') || name.toLowerCase().includes('la liga') || 
      name.toLowerCase().includes('bundesliga') || name.toLowerCase().includes('serie a')) {
    baseScore += 8; // Premier league/top-tier club
  }
  
  if (titleLower.includes('iso') || titleLower.includes('certification') || titleLower.includes('award')) {
    baseScore += 5; // ISO certification mentioned
  }
  
  if (titleLower.includes('award') || titleLower.includes('award-winning')) {
    baseScore += 5; // Award-winning team preference
  }
  
  if (['uk', 'gb', 'europe'].includes(country.toLowerCase())) {
    baseScore += 4; // UK/Europe location
  }
  
  return Math.min(baseScore, 100);
}

/**
 * Phase 5: Structured JSON output generation
 */
function generateStructuredOutput(results) {
  const verifiedOpportunities = results.filter(r => r.validation_status === 'VERIFIED' || r.validation_status === 'VERIFIED-INDIRECT');
  const highlights = verifiedOpportunities.map(result => {
    const entity = result._entity || {};
    const opportunity = result.opportunities?.[0] || {};
    const fitScore = result.fit_score || calculateFitScore(entity, opportunity);
    
    return {
      organization: result.organization,
      src_link: opportunity.url || result.verified_url || opportunity.verification_url,
      source_type: opportunity.source_type || 'unknown',
      discovery_source: result.detection_source,
      discovery_method: result.discovery_method || (result.detection_source?.includes('perplexity') ? 'perplexity_primary' : 'brightdata_fallback'),
      validation_status: result.validation_status,
      date_published: opportunity.source_date || null,
      deadline: opportunity.deadline || result.deadline || null,
      deadline_days_remaining: opportunity.days_remaining || null,
      estimated_rfp_date: result.estimated_rfp_date || null,
      budget: opportunity.budget || result.budget || 'Not specified',
      summary_json: {
        title: opportunity.title || 'Unknown opportunity',
        confidence: result.confidence || 0.5,
        urgency: calculateUrgency(opportunity.deadline || result.deadline),
        fit_score: fitScore,
        source_quality: calculateSourceQuality(result.source_type || opportunity.source_type)
      },
      perplexity_validation: {
        verified_by_perplexity: result.detection_source?.includes('perplexity') || false,
        deadline_confirmed: !!(opportunity.deadline || result.deadline),
        url_verified: !!(opportunity.url || result.verified_url),
        budget_estimated: !!(opportunity.budget || result.budget),
        verification_sources: result.verification_sources || []
      },
      competitive_intel: result.competitive_intel || {
        digital_maturity: 'UNKNOWN',
        current_partners: [],
        recent_projects: [],
        competitors: [],
        yp_advantages: [],
        decision_makers: []
      }
    };
  }).filter(h => h.src_link && !h.src_link.includes('example.com'));
  
  return {
    total_rfps_detected: STATE.total_rfps_detected,
    verified_rfps: STATE.verified_rfps,
    rejected_rfps: STATE.rejected_rfps,
    entities_checked: STATE.entities_processed,
    highlights: highlights,
    scoring_summary: {
      avg_confidence: calculateAverage(highlights, 'summary_json.confidence'),
      avg_fit_score: calculateAverage(highlights, 'summary_json.fit_score'),
      top_opportunity: getTopOpportunity(highlights)
    },
    quality_metrics: {
      brightdata_detections: STATE.cost_breakdown.brightdata_targeted + STATE.cost_breakdown.brightdata_broad > 0 ? 1 : 0,
      perplexity_verifications: STATE.cost_breakdown.perplexity_validation > 0 ? 1 : 0,
      verified_rate: STATE.entities_processed > 0 ? STATE.verified_rfps / STATE.entities_processed : 0,
      placeholder_urls_rejected: results.filter(r => r.validation_status?.includes('INVALID-URL')).length,
      expired_rfps_rejected: results.filter(r => r.validation_status?.includes('EXPIRED')).length,
      competitive_intel_gathered: STATE.cost_breakdown.perplexity_competitive_intel > 0 ? 1 : 0
    },
    discovery_breakdown: {
      linkedin_posts: highlights.filter(h => h.source_type === 'linkedin').length,
      linkedin_jobs: highlights.filter(h => h.source_type === 'linkedin_job').length,
      tender_platforms: highlights.filter(h => h.source_type === 'tender_portal').length,
      sports_news_sites: highlights.filter(h => h.source_type === 'news').length,
      official_websites: highlights.filter(h => h.source_type === 'official_website').length,
      linkedin_success_rate: calculateSuccessRate(highlights, 'linkedin'),
      tender_platform_success_rate: calculateSuccessRate(highlights, 'tender_portal')
    },
    perplexity_usage: {
      discovery_queries: STATE.cost_breakdown.perplexity_discovery > 0 ? STATE.perplexity_queries : 0,
      validation_queries: STATE.cost_breakdown.perplexity_validation > 0 ? STATE.perplexity_queries : 0,
      competitive_intel_queries: STATE.cost_breakdown.perplexity_competitive_intel > 0 ? STATE.perplexity_queries : 0,
      total_queries: STATE.perplexity_queries,
      estimated_cost: STATE.cost_breakdown.perplexity_discovery + STATE.cost_breakdown.perplexity_validation + STATE.cost_breakdown.perplexity_competitive_intel
    },
    brightdata_usage: {
      targeted_domain_queries: STATE.cost_breakdown.brightdata_targeted > 0 ? STATE.brightdata_queries : 0,
      broad_web_queries: STATE.cost_breakdown.brightdata_broad > 0 ? STATE.brightdata_queries : 0,
      total_queries: STATE.brightdata_queries,
      estimated_cost: STATE.cost_breakdown.brightdata_targeted + STATE.cost_breakdown.brightdata_broad
    },
    cost_comparison: {
      total_cost: STATE.total_cost,
      cost_per_verified_rfp: STATE.verified_rfps > 0 ? STATE.total_cost / STATE.verified_rfps : 0,
      estimated_old_system_cost: STATE.entities_processed * 0.50, // Old system: ~$0.50 per entity
      savings_vs_old_system: (STATE.entities_processed * 0.50) - STATE.total_cost
    },
    processing_metadata: {
      start_time: STATE.start_time.toISOString(),
      end_time: new Date().toISOString(),
      processing_duration_seconds: Math.floor((new Date() - STATE.start_time) / 1000),
      system_version: "1.0.0",
      cost_strategy: "perplexity_first_with_brightdata_fallback"
    }
  };
}

// Helper functions for structured output
function calculateUrgency(deadline) {
  if (!deadline) return 'medium';
  const days = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (days < 7) return 'high';
  if (days < 30) return 'medium';
  return 'low';
}

function calculateSourceQuality(sourceType) {
  const qualityMap = {
    'tender_portal': 0.9,
    'linkedin': 0.8,
    'official_website': 0.85,
    'news': 0.7
  };
  return qualityMap[sourceType] || 0.5;
}

function calculateAverage(items, path) {
  if (!items.length) return 0;
  const values = items.map(item => {
    const keys = path.split('.');
    let value = item;
    for (const key of keys) {
      value = value?.[key];
    }
    return value || 0;
  });
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function getTopOpportunity(highlights) {
  if (!highlights.length) return null;
  return highlights.reduce((top, current) => 
    (current.summary_json.fit_score > top.summary_json.fit_score) ? current : top
  ).organization;
}

function calculateSuccessRate(highlights, sourceType) {
  const sourceCount = highlights.filter(h => h.source_type === sourceType).length;
  return highlights.length > 0 ? sourceCount / highlights.length : 0;
}

/**
 * Main execution function
 */
async function main() {
  await log('INFO', '🎯 Starting Perplexity-First Hybrid RFP Detection System');
  await log('INFO', `Target: Process up to ${CONFIG.MAX_ENTITIES} entities with cost optimization`);
  
  try {
    // Clear log file
    await fs.writeFile(CONFIG.LOG_FILE, '');
    
    const entities = SAMPLE_ENTITIES.slice(0, CONFIG.MAX_ENTITIES);
    
    await log('INFO', `Processing ${entities.length} sample entities`);
    
    // Process each entity
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      STATE.entities_processed++;
      
      // Phase 1: Perplexity discovery
      const perplexityResult = await perplexityDiscovery(entity);
      
      let finalResult = perplexityResult;
      
      // Phase 1B: BrightData fallback if needed
      if (perplexityResult.status === 'NONE' || perplexityResult.needs_brightdata_fallback) {
        const brightdataResult = await brightdataFallback(entity);
        finalResult = brightdataResult;
      }
      
      // Store entity reference for later processing
      finalResult._entity = entity;
      
      // Calculate fit score for verified opportunities
      if (finalResult.validation_status === 'VERIFIED' || finalResult.validation_status === 'VERIFIED-INDIRECT') {
        const opportunity = finalResult.opportunities?.[0] || {};
        finalResult.fit_score = calculateFitScore(entity, opportunity);
        STATE.verified_rfps++;
        STATE.total_rfps_detected++;
      } else if (finalResult.status === 'ACTIVE_RFP' || finalResult.status === 'PARTNERSHIP') {
        STATE.total_rfps_detected++;
      }
      
      STATE.results.push(finalResult);
      
      // Progress logging
      await log('INFO', `Progress: ${STATE.entities_processed}/${entities.length} entities | Cost: $${STATE.total_cost.toFixed(2)} | RFPs: ${STATE.total_rfps_detected}`);
      
      // Brief pause to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Phase 5: Generate structured output
    await log('INFO', 'Generating structured output...');
    const structuredOutput = generateStructuredOutput(STATE.results);
    
    // Save results to file
    await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(structuredOutput, null, 2));
    
    // Final summary
    const duration = Math.round((new Date() - STATE.start_time) / 1000);
    await log('SUCCESS', `🎯 Perplexity-First Hybrid RFP Detection Complete!`);
    await log('SUCCESS', `Processed: ${STATE.entities_processed} entities in ${duration}s`);
    await log('SUCCESS', `RFPs Detected: ${STATE.total_rfps_detected} | Verified: ${STATE.verified_rfps} | Rejected: ${STATE.rejected_rfps}`);
    await log('SUCCESS', `Total Cost: $${STATE.total_cost.toFixed(2)} | Savings vs Old System: $${structuredOutput.cost_comparison.savings_vs_old_system.toFixed(2)}`);
    await log('SUCCESS', `Results saved to: ${CONFIG.OUTPUT_FILE}`);
    
    // Return only JSON as required
    console.log(JSON.stringify(structuredOutput, null, 2));
    
  } catch (error) {
    await log('ERROR', 'System execution failed', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = { main, perplexityDiscovery, brightdataFallback };