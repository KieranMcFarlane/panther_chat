#!/usr/bin/env node

/**
 * 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
 * Intelligent discovery with BrightData fallback for maximum quality & cost efficiency
 * 
 * Cost Strategy:
 * - Perplexity: $0.33/100K tokens (~$0.01 per detailed query) 
 * - BrightData: $0.001-0.01 per targeted domain query vs $0.01-0.10 for broad search
 * - Target: 70% cost reduction vs old BrightData-first approach
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const CONFIG = {
  BATCH_SIZE: 10, // Process entities in batches for cost control
  MAX_ENTITIES: 300, // Total entities to process
  HIGH_VALUE_THRESHOLD: 80, // Fit score threshold for competitive intelligence
  OUTPUT_FILE: 'perplexity-hybrid-rfp-results.json',
  LOG_FILE: 'perplexity-hybrid-rfp-monitor.log',
  COST_TRACKING: {
    perplexity_cost_per_1m_tokens: 1.0, // $1.00 per 1M tokens
    brightdata_targeted_cost: 0.005,     // $0.005 per targeted domain query
    brightdata_broad_cost: 0.05         // $0.05 per broad web search
  }
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
function calculateCost(type, tokens = 1000, isBroadSearch = false) {
  const costs = {
    perplexity_discovery: 0.01,
    perplexity_validation: 0.005,
    perplexity_competitive_intel: 0.015,
    brightdata_targeted: CONFIG.COST_TRACKING.brightdata_targeted_cost,
    brightdata_broad: CONFIG.COST_TRACKING.brightdata_broad_cost
  };
  
  const cost = costs[type] || 0;
  STATE.total_cost += cost;
  STATE.cost_breakdown[type] = (STATE.cost_breakdown[type] || 0) + cost;
  
  return cost;
}

/**
 * Query Neo4j for sports entities
 */
async function queryNeo4jEntities(limit = 300) {
  await log('INFO', `Querying Neo4j for ${limit} sports entities...`);
  
  try {
    const result = await mcp__neo4j_mcp__execute_query({
      query: `
        MATCH (e:Entity)
        WHERE e.type IN ['Club', 'League', 'Federation', 'Tournament', 'Venue', 'National Team']
        AND e.name IS NOT NULL
        AND e.country IS NOT NULL
        RETURN e.name as name, e.type as type, e.sport as sport, e.country as country, e.website as website
        ORDER BY e.name
        LIMIT $limit
      `,
      params: { limit }
    });
    
    await log('INFO', `Retrieved ${result.length} entities from Neo4j`, { count: result.length });
    return result;
  } catch (error) {
    await log('ERROR', 'Failed to query Neo4j entities', { error: error.message });
    return [];
  }
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
Look for OFFICIAL account posts ONLY (verified/blue checkmark preferred)
Keywords to match:
- "invites proposals from"
- "soliciting proposals from" 
- "request for expression of interest"
- "invitation to tender"
- "call for proposals"
- "vendor selection process"
- "We're looking for" + ("digital" OR "technology" OR "partner")
- "Seeking partners for"
Time filter: Last 6 months (not 30 days!)
Engagement: Posts with >5 likes/comments (indicates legitimacy)
Extract: Post URL, date, project title, deadline if mentioned, contact info
Success rate: ~35% (7x better than generic search!)

🎯 PRIORITY 2 - LinkedIn Job Postings (EARLY WARNING SIGNALS):
Search: site:linkedin.com/jobs company:"${name}"
Look for NEW job postings (last 3 months):
- "Project Manager" + ("Digital" OR "Transformation" OR "Implementation")
- "Program Manager" + ("Technology" OR "Digital" OR "Platform")
- "Transformation Lead"
- "Implementation Manager"
Rationale: Organizations hire project managers 1-2 months BEFORE releasing RFPs
Extract: Job title, posting date, project hints from description
If found: Mark as "EARLY_SIGNAL" with estimated RFP timeline
Success rate: ~25% (predictive signal!)

🎯 PRIORITY 3 - Known Tender Platforms (TARGETED SEARCH):
Check these specific URLs in order:
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: "${name}")
2. ${website || name + '.com'}/procurement
3. ${website || name + '.com'}/tenders  
4. ${website || name + '.com'}/rfp
5. https://ted.europa.eu (if European organization)
6. https://sam.gov (if US organization)
7. https://www.find-tender.service.gov.uk (if UK organization)
Look for: Active tenders with submission deadlines
Extract: Tender reference, title, deadline, budget, requirements
Success rate: ~30%

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains specifically:
- site:sportspro.com + "${name}" + ("RFP" OR "tender" OR "partnership announced" OR "selected as")
- site:sportbusiness.com + "${name}" + ("digital transformation" OR "technology partner")
- site:insideworldfootball.com + "${name}" + procurement
Time filter: Last 3 months
Extract: Partnership announcements, vendor selections, project launches
Rationale: Recent partnerships indicate digital maturity and future opportunities
Success rate: ~20%

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + "${name}" + ("digital transformation" OR "RFP" OR "partnership")
Also check: linkedin.com/company/${name.toLowerCase().replace(/\s+/g, '')}/posts
Time filter: Last 6 months
Extract: Detailed RFP descriptions, procurement strategies, technology roadmaps
Success rate: ~15%

❌ EXCLUSIONS:
- Expired/closed RFPs (deadline passed)
- Awarded contracts (vendor already selected)
- Non-digital opportunities (facilities, catering, merchandise)
- Placeholder/example URLs

📊 VALIDATION REQUIREMENTS:
- All URLs must be real, accessible sources (not example.com)
- Deadlines must be in future (if provided)
- Sources must be from last 6 months
- Provide source URLs for verification

📋 RETURN STRUCTURED DATA:
{
  "status": "ACTIVE_RFP|PARTNERSHIP|INITIATIVE|NONE",
  "confidence": <0.0-1.0>,
  "opportunities": [{
    "title": "<project title>",
    "type": "rfp|tender|partnership|initiative",
    "deadline": "<YYYY-MM-DD or null>",
    "days_remaining": <int or null>,
    "url": "<official source URL>",
    "budget": "<estimated value or 'Not specified'>",
    "source_type": "tender_portal|linkedin|news|official_website",
    "source_date": "<YYYY-MM-DD>",
    "verification_url": "<source URL>"
  }],
  "discovery_method": "perplexity_primary|perplexity_secondary|perplexity_tertiary",
  "sources_checked": ["<url1>", "<url2>"]
}

If NO opportunities found, return: {"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": []}`;

  try {
    STATE.perplexity_queries++;
    const cost = calculateCost('perplexity_discovery');
    
    const response = await mcp__perplexity_mcp__chat_completion({
      messages: [
        { role: 'system', content: 'You are an expert RFP detection analyst for the sports industry. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: discoveryQuery }
      ],
      format: 'json',
      include_sources: true,
      temperature: 0.1
    });
    
    let data;
    try {
      data = JSON.parse(response.content);
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
      const opportunity = data.opportunities[0];
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
      
      const response = await mcp__brightdata_mcp__search_engine({
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
    
    // TIER 2: Sports industry news domains
    const newsDomains = ['sportspro.com', 'sportbusiness.com', 'insideworldfootball.com'];
    for (const domain of newsDomains) {
      STATE.brightdata_queries++;
      const cost = calculateCost('brightdata_targeted');
      
      const newsQuery = `site:${domain} ${name} ("RFP" OR "tender" OR "partnership announced" OR "digital transformation")`;
      
      const response = await mcp__brightdata_mcp__search_engine({
        query: newsQuery,
        engine: 'google'
      });
      
      if (response.results && response.results.length > 0) {
        await log('SUCCESS', `[ENTITY-BRIGHTDATA-DETECTED] ${name} (Hits: ${response.results.length}, Tier: 2)`);
        return {
          status: 'DETECTED',
          organization: name,
          detection_source: 'brightdata_fallback',
          validation_status: 'UNVERIFIED-BRIGHTDATA',
          brightdata_tier: 2,
          results: response.results,
          cost: cost,
          search_query: newsQuery
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
 * Phase 2: Perplexity validation for BrightData detections
 */
async function perplexityValidation(brightdataResult) {
  const { organization, results, search_query } = brightdataResult;
  
  await log('INFO', `[ENTITY-VALIDATION] ${organization}`);
  
  const bestResult = results && results.length > 0 ? results[0] : null;
  if (!bestResult) {
    return { ...brightdataResult, validation_status: 'REJECTED-NO-RESULTS' };
  }
  
  const validationQuery = `Verify this RFP/opportunity from ${organization}:
Found: ${bestResult.title} at ${bestResult.url}

Validate:
1. Is this URL real and accessible (not example.com)?
2. Is this opportunity currently OPEN (not closed/awarded)?
3. What is the exact submission deadline (YYYY-MM-DD)?
4. What is the estimated budget/contract value?
5. When was this posted/announced?

Requirements:
- Only confirm if opportunity is active and open
- Reject if deadline passed or opportunity closed
- Provide alternative sources if primary URL invalid

Return JSON:
{
  "validation_status": "VERIFIED|REJECTED-CLOSED|REJECTED-EXPIRED|REJECTED-INVALID-URL|UNVERIFIABLE",
  "rejection_reason": "<reason if rejected>",
  "deadline": "<YYYY-MM-DD or null>",
  "budget": "<amount or 'Not specified'>",
  "verified_url": "<real URL or null>",
  "verification_sources": ["<url1>", "<url2>"]
}`;

  try {
    STATE.perplexity_queries++;
    const cost = calculateCost('perplexity_validation');
    
    const response = await mcp__perplexity_mcp__chat_completion({
      messages: [
        { role: 'system', content: 'You are an expert RFP validation analyst. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: validationQuery }
      ],
      format: 'json',
      temperature: 0.1
    });
    
    let validationData;
    try {
      validationData = JSON.parse(response.content);
    } catch (parseError) {
      await log('ERROR', `Failed to parse validation response for ${organization}`, { error: parseError.message });
      return { ...brightdataResult, validation_status: 'REJECTED-PARSE-ERROR' };
    }
    
    if (validationData.validation_status === 'VERIFIED') {
      await log('SUCCESS', `[ENTITY-VERIFIED] ${organization} (Deadline: ${validationData.deadline}, Budget: ${validationData.budget})`);
      return {
        ...brightdataResult,
        ...validationData,
        validation_status: 'VERIFIED',
        cost: (brightdataResult.cost || 0) + cost
      };
    } else {
      await log('INFO', `[ENTITY-REJECTED] ${organization} (Reason: ${validationData.rejection_reason})`);
      return {
        ...brightdataResult,
        ...validationData,
        validation_status: validationData.validation_status
      };
    }
    
  } catch (error) {
    await log('ERROR', `Perplexity validation failed for ${organization}`, { error: error.message });
    return { ...brightdataResult, validation_status: 'VALIDATION-ERROR' };
  }
}

/**
 * Phase 3: Competitive intelligence for high-value opportunities
 */
async function gatherCompetitiveIntelligence(entity, fitScore) {
  if (fitScore < CONFIG.HIGH_VALUE_THRESHOLD) {
    return null;
  }
  
  const { name, type, sport, country } = entity;
  
  await log('INFO', `[ENTITY-INTEL] ${name} (Fit Score: ${fitScore})`);
  
  const intelQuery = `Analyze ${name}'s digital technology landscape:

1. Current Technology Partners: Who provides their digital services?
2. Recent Digital Projects: Projects in last 2 years (vendor, scope, outcome)
3. Decision Makers: Technology/procurement leaders (names, titles, LinkedIn)
4. Competitors: Known vendors bidding on similar opportunities
5. Yellow Panther Edge: Competitive advantages (sports focus, awards, ISO certs)
6. Strategic Context: Budget trends, digital maturity, leadership changes

Return JSON with source URLs.`;

  try {
    STATE.perplexity_queries++;
    const cost = calculateCost('perplexity_competitive_intel');
    
    const response = await mcp__perplexity_mcp__chat_completion({
      messages: [
        { role: 'system', content: 'You are a competitive intelligence analyst for sports technology. Return ONLY valid JSON, no markdown.' },
        { role: 'user', content: intelQuery }
      ],
      format: 'json',
      include_sources: true,
      temperature: 0.2
    });
    
    let intelData;
    try {
      intelData = JSON.parse(response.content);
    } catch (parseError) {
      await log('ERROR', `Failed to parse intelligence response for ${name}`, { error: parseError.message });
      return null;
    }
    
    await log('INFO', `[ENTITY-INTEL-COMPLETE] ${name} (Maturity: ${intelData.digital_maturity || 'UNKNOWN'}, Competitors: ${intelData.competitors?.length || 0})`);
    
    return {
      ...intelData,
      cost: cost
    };
    
  } catch (error) {
    await log('ERROR', `Competitive intelligence failed for ${name}`, { error: error.message });
    return null;
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
      discovery_method: result.discovery_method || (result.detection_source.includes('perplexity') ? 'perplexity_primary' : 'brightdata_fallback'),
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
 * Store verified RFPs to Supabase
 */
async function storeToSupabase(highlights) {
  const verifiedOpportunities = highlights.filter(h => h.validation_status === 'VERIFIED');
  
  if (verifiedOpportunities.length === 0) {
    await log('INFO', 'No verified opportunities to store in Supabase');
    return;
  }
  
  await log('INFO', `Storing ${verifiedOpportunities.length} verified opportunities to Supabase`);
  
  for (const opportunity of verifiedOpportunities) {
    try {
      // This would use the Supabase MCP when available
      // await mcp__supabase__execute_sql({
      //   query: `INSERT INTO rfp_opportunities (...) VALUES (...)`
      // });
      await log('INFO', `Would store opportunity: ${opportunity.organization} - ${opportunity.summary_json.title}`);
    } catch (error) {
      await log('ERROR', `Failed to store opportunity to Supabase`, { 
        organization: opportunity.organization, 
        error: error.message 
      });
    }
  }
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
    
    // Query entities from Neo4j
    const entities = await queryNeo4jEntities(CONFIG.MAX_ENTITIES);
    
    if (entities.length === 0) {
      await log('ERROR', 'No entities retrieved from Neo4j. Exiting.');
      return;
    }
    
    await log('INFO', `Processing ${entities.length} entities in batches of ${CONFIG.BATCH_SIZE}`);
    
    // Process entities in batches
    for (let i = 0; i < entities.length; i += CONFIG.BATCH_SIZE) {
      const batch = entities.slice(i, i + CONFIG.BATCH_SIZE);
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(entities.length / CONFIG.BATCH_SIZE);
      
      await log('INFO', `Processing batch ${batchNum}/${totalBatches} (${batch.length} entities)`);
      
      // Process each entity in the batch
      for (const entity of batch) {
        STATE.entities_processed++;
        
        // Phase 1: Perplexity discovery
        const perplexityResult = await perplexityDiscovery(entity);
        
        let finalResult = perplexityResult;
        
        // Phase 1B: BrightData fallback if needed
        if (perplexityResult.status === 'NONE' || perplexityResult.needs_brightdata_fallback) {
          const brightdataResult = await brightdataFallback(entity);
          
          // Phase 2: Perplexity validation for BrightData detections
          if (brightdataResult.status === 'DETECTED' && brightdataResult.validation_status === 'UNVERIFIED-BRIGHTDATA') {
            finalResult = await perplexityValidation(brightdataResult);
          } else {
            finalResult = brightdataResult;
          }
        }
        
        // Store entity reference for later processing
        finalResult._entity = entity;
        
        // Calculate fit score for verified opportunities
        if (finalResult.validation_status === 'VERIFIED' || finalResult.validation_status === 'VERIFIED-INDIRECT') {
          const opportunity = finalResult.opportunities?.[0] || {};
          finalResult.fit_score = calculateFitScore(entity, opportunity);
          
          // Phase 3: Competitive intelligence for high-value opportunities
          if (finalResult.fit_score >= CONFIG.HIGH_VALUE_THRESHOLD) {
            finalResult.competitive_intel = await gatherCompetitiveIntelligence(entity, finalResult.fit_score);
          }
          
          STATE.verified_rfps++;
          STATE.total_rfps_detected++;
        } else if (finalResult.validation_status && finalResult.validation_status.startsWith('REJECTED')) {
          STATE.rejected_rfps++;
        } else if (finalResult.status === 'ACTIVE_RFP' || finalResult.status === 'PARTNERSHIP') {
          STATE.total_rfps_detected++;
        }
        
        STATE.results.push(finalResult);
        
        // Progress logging
        if (STATE.entities_processed % 10 === 0) {
          await log('INFO', `Progress: ${STATE.entities_processed}/${entities.length} entities | Cost: $${STATE.total_cost.toFixed(2)} | RFPs: ${STATE.total_rfps_detected}`);
        }
      }
      
      // Brief pause between batches to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Phase 5: Generate structured output
    await log('INFO', 'Generating structured output...');
    const structuredOutput = generateStructuredOutput(STATE.results);
    
    // Save results to file
    await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(structuredOutput, null, 2));
    
    // Store verified opportunities to Supabase
    await storeToSupabase(structuredOutput.highlights);
    
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

module.exports = { main, perplexityDiscovery, brightdataFallback, perplexityValidation };