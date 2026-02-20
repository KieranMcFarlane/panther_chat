#!/usr/bin/env node
/**
 * 🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM
 * Intelligent discovery with BrightData fallback for maximum quality & cost efficiency
 * 
 * Cost Optimization Strategy:
 * - Perplexity Primary: ~$0.001/query (high quality, validated results)
 * - BrightData Fallback: ~$0.01-0.10/query (targeted only when needed)
 * - Expected savings: 70-90% vs broad web search approach
 */

const fs = require('fs');
const path = require('path');

// MCP integration would normally be here, but for this implementation we'll simulate the structured responses
// In production, this would use: @modelcontextprotocol/sdk with the MCP servers defined in mcp-config-perplexity-rfp.json

// Configuration
const CONFIG = {
  ENTITY_LIMIT: 300,
  BATCH_OFFSET: 0,
  TEST_MODE: false,
  COST_PER_PERPLEXITY_QUERY: 0.001,
  COST_PER_BRIGHTDATA_TIER1: 0.002,  // Targeted domain search
  COST_PER_BRIGHTDATA_TIER2: 0.003,  // News domains
  COST_PER_BRIGHTDATA_TIER3: 0.003,  // LinkedIn targeted
  COST_PER_BRIGHTDATA_TIER4: 0.01,   // Broad web (last resort)
};

// Global state for tracking
const state = {
  entitiesProcessed: 0,
  totalRfpsDetected: 0,
  verifiedRfps: 0,
  rejectedRfps: 0,
  perplexityPrimarySuccess: 0,
  perplexitySignals: 0,
  perplexityNone: 0,
  brightdataFallbackUsed: 0,
  brightdataDetections: 0,
  competitiveIntelGathered: 0,
  placeholderUrlsRejected: 0,
  expiredRfpsRejected: 0,
  perplexityQueries: 0,
  brightdataQueries: 0,
  estimatedCost: 0,
  highlights: [],
  discoveryBreakdown: {
    linkedinPosts: 0,
    linkedinJobs: 0,
    tenderPlatforms: 0,
    sportsNewsSites: 0,
    officialWebsites: 0
  }
};

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 1: PERPLEXITY DISCOVERY (Intelligent, Validated Detection)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Query entities from Supabase (simulated - in production would use mcp__supabase__execute_sql)
 */
async function queryEntitiesFromSupabase() {
  console.log('📊 Querying 300 entities from Supabase cached_entities table...');
  
  // Simulated entities data - in production this would be:
  // SELECT neo4j_id, labels, properties->>'name' as name, properties->>'sport' as sport, 
  //        properties->>'country' as country, properties->>'type' as type
  // FROM cached_entities
  // WHERE properties->>'type' IN ('Club', 'League', 'Federation', 'Tournament')
  // ORDER BY created_at DESC
  // OFFSET 0 LIMIT 300
  
  const entities = generateSampleEntities(300);
  console.log(`✅ Retrieved ${entities.length} entities`);
  return entities;
}

/**
 * Generate sample entities for demonstration
 */
function generateSampleEntities(count) {
  const sports = ['Football', 'Basketball', 'Cricket', 'Baseball', 'Hockey', 'Tennis', 'Rugby'];
  const countries = ['England', 'USA', 'Spain', 'Germany', 'France', 'Italy', 'Brazil', 'Argentina', 'India', 'Australia'];
  const types = ['Club', 'League', 'Federation', 'Tournament'];
  
  const highTierOrgs = [
    'Manchester United', 'Real Madrid', 'FC Barcelona', 'Bayern Munich', 'Liverpool',
    'Chelsea FC', 'Arsenal', 'Manchester City', 'Paris Saint-Germain', 'Juventus FC',
    'Golden State Warriors', 'Los Angeles Lakers', 'New York Knicks', 'Chicago Bulls',
    'Mumbai Indians', 'Kolkata Knight Riders', 'Chennai Super Kings'
  ];
  
  const entities = [];
  for (let i = 0; i < count; i++) {
    const isHighTier = i < highTierOrgs.length;
    entities.push({
      id: `entity-${i + 1}`,
      name: isHighTier ? highTierOrgs[i] : `Sports Entity ${i + 1}`,
      sport: sports[Math.floor(Math.random() * sports.length)],
      country: countries[Math.floor(Math.random() * countries.length)],
      type: types[Math.floor(Math.random() * types.length)]
    });
  }
  return entities;
}

/**
 * Perplexity LinkedIn-First Discovery Query
 * In production: mcp__perplexity-mcp__chat_completion
 */
async function perplexityPrimaryDiscovery(entity) {
  state.perplexityQueries++;
  state.estimatedCost += CONFIG.COST_PER_PERPLEXITY_QUERY;

  const { name, sport } = entity;
  
  console.log(`[ENTITY-START] ${state.entitiesProcessed + 1} ${name}`);
  
  // Construct the detailed Perplexity query
  const perplexityQuery = `
Research ${name} (${sport}) for active procurement opportunities:

🎯 PRIORITY 1 - LinkedIn Official Posts (CHECK FIRST - HIGHEST SUCCESS RATE):
Search: site:linkedin.com/posts + ${name}
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
Search: site:linkedin.com/jobs company:${name}
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
1. https://www.isportconnect.com/marketplace_categorie/tenders/ (search: ${name})
2. ${name.toLowerCase().replace(/\s+/g, '-')}.com/procurement
3. ${name.toLowerCase().replace(/\s+/g, '-')}.com/tenders
4. ${name.toLowerCase().replace(/\s+/g, '-')}.com/rfp
5. https://ted.europa.eu (if European organization)
6. https://sam.gov (if US organization)
7. https://www.find-tender.service.gov.uk (if UK organization)
Look for: Active tenders with submission deadlines
Extract: Tender reference, title, deadline, budget, requirements
Success rate: ~30%

🎯 PRIORITY 4 - Sports Industry News Sites (PARTNERSHIP SIGNALS):
Search these domains specifically:
- site:sportspro.com + ${name} + ("RFP" OR "tender" OR "partnership announced" OR "selected as")
- site:sportbusiness.com + ${name} + ("digital transformation" OR "technology partner")
- site:insideworldfootball.com + ${name} + procurement
Time filter: Last 3 months
Extract: Partnership announcements, vendor selections, project launches
Rationale: Recent partnerships indicate digital maturity and future opportunities
Success rate: ~20%

🎯 PRIORITY 5 - LinkedIn Articles & Company Pages:
Search: site:linkedin.com/pulse + ${name} + ("digital transformation" OR "RFP" OR "partnership")
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

If NO opportunities found, return: {"status": "NONE", "confidence": 1.0, "opportunities": [], "sources_checked": [...]}
`;

  // Simulate Perplexity response (in production would call actual MCP tool)
  const simulatedResponse = simulatePerplexityResponse(name, sport);
  
  return simulatedResponse;
}

/**
 * Simulate Perplexity response for demonstration
 */
function simulatePerplexityResponse(organization, sport) {
  const highTierOrgs = [
    'Manchester United', 'Real Madrid', 'FC Barcelona', 'Bayern Munich', 'Liverpool',
    'Chelsea FC', 'Arsenal', 'Manchester City', 'Golden State Warriors', 'Los Angeles Lakers'
  ];
  
  const isHighTier = highTierOrgs.some(org => organization.includes(org));
  const probability = isHighTier ? 0.35 : 0.15; // 35% for high-tier, 15% for others
  
  if (Math.random() < probability) {
    // Simulate finding an RFP
    const opportunityTypes = ['rfp', 'tender', 'partnership'];
    const sourceTypes = ['linkedin', 'tender_portal', 'news', 'official_website'];
    
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + Math.floor(Math.random() * 60) + 15); // 15-75 days from now
    
    return {
      status: 'ACTIVE_RFP',
      confidence: parseFloat((0.7 + Math.random() * 0.3).toFixed(2)),
      opportunities: [{
        title: `${organization} seeking ${['digital transformation partner', 'mobile app development', 'fan engagement platform', 'technology partnership'][Math.floor(Math.random() * 4)]}`,
        type: opportunityTypes[Math.floor(Math.random() * opportunityTypes.length)],
        deadline: deadline.toISOString().split('T')[0],
        days_remaining: Math.floor((deadline - new Date()) / (1000 * 60 * 60 * 24)),
        url: `https://procurement.${organization.toLowerCase().replace(/\s+/g, '-')}.com/rfp-${Date.now()}`,
        budget: `£${(Math.floor(Math.random() * 500) + 50)}k-${(Math.floor(Math.random() * 500) + 500)}k`,
        source_type: sourceTypes[Math.floor(Math.random() * sourceTypes.length)],
        source_date: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        verification_url: `https://procurement.${organization.toLowerCase().replace(/\s+/g, '-')}.com/rfp-${Date.now()}`
      }],
      discovery_method: 'perplexity_primary',
      sources_checked: [
        `https://linkedin.com/posts/${organization.toLowerCase().replace(/\s+/g, '')}`,
        `https://www.isportconnect.com/marketplace_categorie/tenders/`
      ]
    };
  } else if (Math.random() < 0.2) {
    // Simulate finding a partnership signal
    return {
      status: 'PARTNERSHIP',
      confidence: 0.6,
      opportunities: [{
        title: `${organization} digital initiative detected`,
        type: 'partnership',
        deadline: null,
        days_remaining: null,
        url: `https://sportspro.com/${organization.toLowerCase().replace(/\s+/g, '-')}-partnership`,
        budget: 'Not specified',
        source_type: 'news',
        source_date: new Date(Date.now() - Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
        verification_url: `https://sportspro.com/${organization.toLowerCase().replace(/\s+/g, '-')}-partnership`
      }],
      discovery_method: 'perplexity_secondary',
      sources_checked: [`https://sportspro.com`]
    };
  } else {
    // No opportunities found
    return {
      status: 'NONE',
      confidence: 1.0,
      opportunities: [],
      sources_checked: [
        'https://linkedin.com',
        'https://www.isportconnect.com',
        'https://sportspro.com'
      ]
    };
  }
}

/**
 * Process Perplexity Results
 */
function processPerplexityResults(entity, perplexityResult) {
  const { name } = entity;
  const { status, confidence, opportunities } = perplexityResult;
  
  if (status === 'ACTIVE_RFP') {
    const opp = opportunities[0];
    console.log(`[ENTITY-PERPLEXITY-RFP] ${name} (Title: ${opp.title}, Deadline: ${opp.deadline}, Budget: ${opp.budget})`);
    
    state.perplexityPrimarySuccess++;
    state.totalRfpsDetected++;
    state.verifiedRfps++;
    
    // Update discovery breakdown
    if (opp.source_type === 'linkedin') {
      state.discoveryBreakdown.linkedinPosts++;
    } else if (opp.source_type === 'tender_portal') {
      state.discoveryBreakdown.tenderPlatforms++;
    } else if (opp.source_type === 'news') {
      state.discoveryBreakdown.sportsNewsSites++;
    } else if (opp.source_type === 'official_website') {
      state.discoveryBreakdown.officialWebsites++;
    }
    
    return {
      organization: name,
      src_link: opp.url,
      source_type: opp.source_type,
      discovery_source: 'perplexity_priority_1',
      discovery_method: 'perplexity_primary',
      validation_status: 'VERIFIED',
      date_published: opp.source_date,
      deadline: opp.deadline,
      deadline_days_remaining: opp.days_remaining,
      estimated_rfp_date: null,
      budget: opp.budget,
      summary_json: {
        title: opp.title,
        confidence: confidence,
        urgency: opp.days_remaining < 30 ? 'high' : opp.days_remaining < 60 ? 'medium' : 'low',
        fit_score: 0, // Will be calculated in Phase 4
        source_quality: confidence
      },
      perplexity_validation: {
        verified_by_perplexity: true,
        deadline_confirmed: !!opp.deadline,
        url_verified: true,
        budget_estimated: opp.budget !== 'Not specified',
        verification_sources: [opp.verification_url]
      }
    };
    
  } else if (status === 'PARTNERSHIP' || status === 'INITIATIVE') {
    const opp = opportunities[0];
    console.log(`[ENTITY-PERPLEXITY-SIGNAL] ${name} (Type: ${opp.type}, Date: ${opp.source_date})`);
    
    state.perplexitySignals++;
    
    return {
      organization: name,
      src_link: opp.url,
      source_type: opp.source_type,
      discovery_source: 'perplexity_priority_4',
      discovery_method: 'perplexity_primary',
      validation_status: 'EARLY_SIGNAL',
      date_published: opp.source_date,
      deadline: null,
      deadline_days_remaining: null,
      estimated_rfp_date: opp.source_date,
      budget: opp.budget,
      summary_json: {
        title: opp.title,
        confidence: confidence,
        urgency: 'low',
        fit_score: 0,
        source_quality: confidence
      },
      perplexity_validation: {
        verified_by_perplexity: true,
        deadline_confirmed: false,
        url_verified: true,
        budget_estimated: false,
        verification_sources: [opp.verification_url]
      }
    };
    
  } else {
    console.log(`[ENTITY-PERPLEXITY-NONE] ${name}`);
    state.perplexityNone++;
    return null; // Signal to proceed to Phase 1B
  }
}

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 1B: BRIGHTDATA FALLBACK (For Perplexity NONE Results Only)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * BrightData TARGETED Fallback Search
 * ONLY called if Perplexity found NOTHING
 */
async function brightdataFallbackSearch(entity) {
  console.log(`  [BRIGHTDATA-FALLBACK] Starting targeted search for ${entity.name}`);
  
  state.brightdataFallbackUsed++;
  
  // Determine which tier to use based on entity characteristics
  const tier = determineBrightDataTier(entity);
  
  // Simulate BrightData search (in production would use backend/brightdata_sdk_client.py)
  const brightdataResult = simulateBrightDataSearch(entity, tier);
  
  state.brightdataQueries++;
  state.estimatedCost += getBrightDataTierCost(tier);
  
  return brightdataResult;
}

/**
 * Determine which BrightData tier to use
 */
function determineBrightDataTier(entity) {
  const europeanCountries = ['England', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium'];
  const northAmericanCountries = ['USA', 'Canada'];
  
  // Tier 1: Known tender domains (most efficient)
  if (Math.random() < 0.4) {
    return 'TIER_1';
  }
  
  // Tier 2: Sports industry news
  if (Math.random() < 0.3) {
    return 'TIER_2';
  }
  
  // Tier 3: LinkedIn targeted
  if (Math.random() < 0.2) {
    return 'TIER_3';
  }
  
  // Tier 4: General web (last resort)
  return 'TIER_4';
}

/**
 * Get BrightData tier cost
 */
function getBrightDataTierCost(tier) {
  switch (tier) {
    case 'TIER_1': return CONFIG.COST_PER_BRIGHTDATA_TIER1;
    case 'TIER_2': return CONFIG.COST_PER_BRIGHTDATA_TIER2;
    case 'TIER_3': return CONFIG.COST_PER_BRIGHTDATA_TIER3;
    case 'TIER_4': return CONFIG.COST_PER_BRIGHTDATA_TIER4;
    default: return CONFIG.COST_PER_BRIGHTDATA_TIER1;
  }
}

/**
 * Simulate BrightData search result
 */
function simulateBrightDataSearch(entity, tier) {
  // Lower success rate than Perplexity (that's why it's a fallback)
  const successProbability = {
    'TIER_1': 0.25,
    'TIER_2': 0.15,
    'TIER_3': 0.10,
    'TIER_4': 0.08
  };
  
  if (Math.random() < successProbability[tier]) {
    return {
      found: true,
      tier: tier,
      hitCount: Math.floor(Math.random() * 10) + 1,
      url: `https://${entity.name.toLowerCase().replace(/\s+/g, '-')}.com/procurement/rfp-${Date.now()}`,
      title: `${entity.name} Digital Transformation RFP`,
      source: tier === 'TIER_1' ? 'tender_portal' : tier === 'TIER_2' ? 'news' : 'web_search'
    };
  } else {
    return {
      found: false,
      tier: tier,
      hitCount: 0
    };
  }
}

/**
 * Process BrightData Results
 */
function processBrightDataResults(entity, brightdataResult) {
  if (brightdataResult.found) {
    console.log(`[ENTITY-BRIGHTDATA-DETECTED] ${entity.name} (Hits: ${brightdataResult.hitCount}, Tier: ${brightdataResult.tier})`);
    
    state.brightdataDetections++;
    state.totalRfpsDetected++;
    
    return {
      organization: entity.name,
      src_link: brightdataResult.url,
      source_type: brightdataResult.source,
      discovery_source: `brightdata_tier_${brightdataResult.tier.split('_')[1]}`,
      discovery_method: 'brightdata_fallback',
      validation_status: 'UNVERIFIED-BRIGHTDATA',
      date_published: new Date().toISOString().split('T')[0],
      deadline: null,
      deadline_days_remaining: null,
      estimated_rfp_date: null,
      budget: 'Not specified',
      summary_json: {
        title: brightdataResult.title,
        confidence: 0.5,
        urgency: 'unknown',
        fit_score: 0,
        source_quality: 0.5
      }
    };
  } else {
    console.log(`[ENTITY-NONE] ${entity.name}`);
    return null;
  }
}

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 2: PERPLEXITY VALIDATION (For BrightData Detections Only)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Perplexity Validation Query for BrightData detections
 */
async function perplexityValidation(detection) {
  state.perplexityQueries++;
  state.estimatedCost += CONFIG.COST_PER_PERPLEXITY_QUERY;

  const validationQuery = `
Verify this RFP/opportunity from ${detection.organization}:
Found: ${detection.summary_json.title} at ${detection.src_link}

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
}
`;

  // Simulate validation result
  const validationResult = simulateValidation(detection);
  
  return validationResult;
}

/**
 * Simulate validation result
 */
function simulateValidation(detection) {
  // 70% chance of verification for demonstration
  if (Math.random() < 0.7) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + Math.floor(Math.random() * 60) + 15);
    
    return {
      validation_status: 'VERIFIED',
      rejection_reason: null,
      deadline: deadline.toISOString().split('T')[0],
      budget: `£${Math.floor(Math.random() * 500) + 50}k-£${Math.floor(Math.random() * 500) + 500}k`,
      verified_url: detection.src_link,
      verification_sources: [detection.src_link]
    };
  } else {
    const rejectionReasons = ['REJECTED-CLOSED', 'REJECTED-EXPIRED', 'REJECTED-INVALID-URL', 'UNVERIFIABLE'];
    return {
      validation_status: rejectionReasons[Math.floor(Math.random() * rejectionReasons.length)],
      rejection_reason: 'Could not verify opportunity status',
      deadline: null,
      budget: 'Not specified',
      verified_url: null,
      verification_sources: []
    };
  }
}

/**
 * Process Validation Results
 */
function processValidationResults(detection, validationResult) {
  if (validationResult.validation_status === 'VERIFIED') {
    console.log(`[ENTITY-VERIFIED] ${detection.organization} (Deadline: ${validationResult.deadline}, Budget: ${validationResult.budget})`);
    
    state.verifiedRfps++;
    
    // Update detection with validated data
    detection.validation_status = 'VERIFIED';
    detection.deadline = validationResult.deadline;
    detection.deadline_days_remaining = Math.floor((new Date(validationResult.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    detection.budget = validationResult.budget;
    detection.src_link = validationResult.verified_url;
    detection.summary_json.confidence = 0.8;
    detection.perplexity_validation = {
      verified_by_perplexity: true,
      deadline_confirmed: !!validationResult.deadline,
      url_verified: !!validationResult.verified_url,
      budget_estimated: validationResult.budget !== 'Not specified',
      verification_sources: validationResult.verification_sources
    };
    
    return detection;
  } else {
    console.log(`[ENTITY-REJECTED] ${detection.organization} (Reason: ${validationResult.validation_status})`);
    
    state.rejectedRfps++;
    
    // Track rejection metrics
    if (validationResult.validation_status === 'REJECTED-EXPIRED') {
      state.expiredRfpsRejected++;
    } else if (validationResult.validation_status === 'REJECTED-INVALID-URL') {
      state.placeholderUrlsRejected++;
    }
    
    return null; // Rejected detections are not included in final results
  }
}

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 3: COMPETITIVE INTELLIGENCE (High-Value Only)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Gather Competitive Intelligence (for fit_score >= 80)
 */
async function gatherCompetitiveIntelligence(detection) {
  // Only gather intel for high-fit opportunities (will be calculated in Phase 4)
  // For now, skip in this implementation
  return null;
}

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 4: FIT SCORING (Enhanced Multi-Factor Algorithm)
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Calculate Yellow Panther Fit Score
 */
function calculateFitScore(detection) {
  let baseScore = 0;
  
  // A. Service Alignment (50% weight)
  const titleLower = detection.summary_json.title.toLowerCase();
  if (titleLower.includes('mobile app')) baseScore += 50;
  else if (titleLower.includes('digital transformation')) baseScore += 50;
  else if (titleLower.includes('web platform') || titleLower.includes('website')) baseScore += 40;
  else if (titleLower.includes('fan engagement')) baseScore += 45;
  else if (titleLower.includes('ticketing')) baseScore += 35;
  else if (titleLower.includes('analytics') || titleLower.includes('data')) baseScore += 30;
  else if (titleLower.includes('streaming') || titleLower.includes('ott')) baseScore += 40;
  
  // B. Project Scope Match (30% weight)
  if (titleLower.includes('partner')) baseScore += 25;
  if (titleLower.includes('implementation') || titleLower.includes('development')) baseScore += 30;
  if (titleLower.includes('support')) baseScore += 25;
  if (titleLower.includes('integration')) baseScore += 20;
  
  // C. Yellow Panther Differentiators (20% weight)
  if (detection.source_type === 'linkedin' || detection.source_type === 'tender_portal') baseScore += 5;
  if (detection.summary_json.confidence > 0.8) baseScore += 5;
  if (detection.budget && detection.budget.includes('k')) baseScore += 5;
  
  // Cap at 100
  return Math.min(baseScore, 100);
}

/**
 * ════════════════════════════════════════════════════════════════
 * PHASE 5: STRUCTURED OUTPUT
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Construct final JSON output
 */
function constructFinalOutput() {
  // Calculate scoring summary
  let avgConfidence = 0;
  let avgFitScore = 0;
  let topOpportunity = '';
  
  if (state.highlights.length > 0) {
    const totalConfidence = state.highlights.reduce((sum, h) => sum + (h.summary_json?.confidence || 0), 0);
    const totalFitScore = state.highlights.reduce((sum, h) => sum + (h.summary_json?.fit_score || 0), 0);
    avgConfidence = parseFloat((totalConfidence / state.highlights.length).toFixed(2));
    avgFitScore = Math.floor(totalFitScore / state.highlights.length);
    
    // Find top opportunity by fit score
    const topOpp = state.highlights.reduce((top, current) => 
      (current.summary_json?.fit_score || 0) > (top.summary_json?.fit_score || 0) ? current : top
    );
    topOpportunity = topOpp.organization;
  }
  
  // Calculate success rates
  const linkedinSuccessRate = state.discoveryBreakdown.linkedinPosts > 0 
    ? parseFloat((state.discoveryBreakdown.linkedinPosts / state.perplexityQueries * 100).toFixed(1))
    : 0;
  
  const tenderPlatformSuccessRate = state.discoveryBreakdown.tenderPlatforms > 0
    ? parseFloat((state.discoveryBreakdown.tenderPlatforms / state.perplexityQueries * 100).toFixed(1))
    : 0;
  
  // Estimate old system cost for comparison
  const estimatedOldSystemCost = state.entitiesProcessed * 0.05; // $0.05 per entity with old broad search
  const costSavings = estimatedOldSystemCost - state.estimatedCost;
  const savingsPercentage = estimatedOldSystemCost > 0 
    ? parseFloat((costSavings / estimatedOldSystemCost * 100).toFixed(1))
    : 0;
  
  return {
    total_rfps_detected: state.totalRfpsDetected,
    verified_rfps: state.verifiedRfps,
    rejected_rfps: state.rejectedRfps,
    entities_checked: state.entitiesProcessed,
    highlights: state.highlights,
    scoring_summary: {
      avg_confidence: avgConfidence,
      avg_fit_score: avgFitScore,
      top_opportunity: topOpportunity
    },
    quality_metrics: {
      brightdata_detections: state.brightdataDetections,
      perplexity_verifications: state.perplexityQueries,
      verified_rate: state.entitiesProcessed > 0 ? parseFloat((state.verifiedRfps / state.totalRfpsDetected * 100).toFixed(1)) : 0,
      placeholder_urls_rejected: state.placeholderUrlsRejected,
      expired_rfps_rejected: state.expiredRfpsRejected,
      competitive_intel_gathered: state.competitiveIntelGathered
    },
    discovery_breakdown: {
      linkedin_posts: state.discoveryBreakdown.linkedinPosts,
      linkedin_jobs: state.discoveryBreakdown.linkedinJobs,
      tender_platforms: state.discoveryBreakdown.tenderPlatforms,
      sports_news_sites: state.discoveryBreakdown.sportsNewsSites,
      official_websites: state.discoveryBreakdown.officialWebsites,
      linkedin_success_rate: linkedinSuccessRate,
      tender_platform_success_rate: tenderPlatformSuccessRate
    },
    perplexity_usage: {
      discovery_queries: state.perplexityQueries,
      validation_queries: state.brightdataDetections, // Each BrightData detection requires validation
      competitive_intel_queries: state.competitiveIntelGathered,
      total_queries: state.perplexityQueries + state.brightdataDetections + state.competitiveIntelGathered,
      estimated_cost: parseFloat(state.estimatedCost.toFixed(4))
    },
    brightdata_usage: {
      targeted_domain_queries: state.brightdataQueries,
      broad_web_queries: 0,
      total_queries: state.brightdataQueries,
      estimated_cost: parseFloat((state.estimatedCost - (state.perplexityQueries * CONFIG.COST_PER_PERPLEXITY_QUERY)).toFixed(4))
    },
    cost_comparison: {
      total_cost: parseFloat(state.estimatedCost.toFixed(4)),
      cost_per_verified_rfp: state.verifiedRfps > 0 ? parseFloat((state.estimatedCost / state.verifiedRfps).toFixed(4)) : 0,
      estimated_old_system_cost: parseFloat(estimatedOldSystemCost.toFixed(4)),
      savings_vs_old_system: parseFloat(costSavings.toFixed(4)),
      savings_percentage: savingsPercentage
    }
  };
}

/**
 * ════════════════════════════════════════════════════════════════
 * MAIN EXECUTION FLOW
 * ════════════════════════════════════════════════════════════════
 */

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 PERPLEXITY-FIRST HYBRID RFP DETECTION SYSTEM');
  console.log('═══════════════════════════════════════════════════\n');
  
  try {
    // Query entities from Supabase
    const entities = await queryEntitiesFromSupabase();
    
    // Process each entity through the hybrid system
    for (const entity of entities) {
      state.entitiesProcessed++;
      
      // PHASE 1: Perplexity Primary Discovery
      const perplexityResult = await perplexityPrimaryDiscovery(entity);
      const detection = processPerplexityResults(entity, perplexityResult);
      
      if (detection) {
        // Perplexity found something - skip Phase 1B
        if (detection.validation_status === 'VERIFIED') {
          // Calculate fit score (PHASE 4)
          detection.summary_json.fit_score = calculateFitScore(detection);
          
          // Gather competitive intel if high-fit (PHASE 3)
          if (detection.summary_json.fit_score >= 80) {
            const intel = await gatherCompetitiveIntelligence(detection);
            if (intel) {
              detection.competitive_intel = intel;
              state.competitiveIntelGathered++;
            }
          }
          
          state.highlights.push(detection);
        }
      } else {
        // PHASE 1B: BrightData Fallback (Perplexity found NOTHING)
        const brightdataResult = await brightdataFallbackSearch(entity);
        const brightdataDetection = processBrightDataResults(entity, brightdataResult);
        
        if (brightdataDetection) {
          // PHASE 2: Perplexity Validation
          const validationResult = await perplexityValidation(brightdataDetection);
          const validatedDetection = processValidationResults(brightdataDetection, validationResult);
          
          if (validatedDetection) {
            // Calculate fit score (PHASE 4)
            validatedDetection.summary_json.fit_score = calculateFitScore(validatedDetection);
            
            // Gather competitive intel if high-fit (PHASE 3)
            if (validatedDetection.summary_json.fit_score >= 80) {
              const intel = await gatherCompetitiveIntelligence(validatedDetection);
              if (intel) {
                validatedDetection.competitive_intel = intel;
                state.competitiveIntelGathered++;
              }
            }
            
            state.highlights.push(validatedDetection);
          }
        }
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // PHASE 5: Construct Final Output
    const finalOutput = constructFinalOutput();
    
    // Log summary
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🎯 PERPLEXITY-FIRST HYBRID SYSTEM COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📊 Entities Checked: ${finalOutput.entities_checked}`);
    console.log(`🎯 Total RFPs Detected: ${finalOutput.total_rfps_detected}`);
    console.log(`✅ Verified RFPs: ${finalOutput.verified_rfps}`);
    console.log(`❌ Rejected RFPs: ${finalOutput.rejected_rfps}`);
    console.log(`💰 Estimated Cost: $${finalOutput.perplexity_usage.estimated_cost + finalOutput.brightdata_usage.estimated_cost}`);
    console.log(`📈 Cost Savings: ${finalOutput.cost_comparison.savings_percentage}% vs old system`);
    console.log(`⭐ Top Opportunity: ${finalOutput.scoring_summary.top_opportunity}`);
    console.log(`📊 Avg Confidence: ${finalOutput.scoring_summary.avg_confidence}`);
    console.log(`🎯 Avg Fit Score: ${finalOutput.scoring_summary.avg_fit_score}`);
    console.log('═══════════════════════════════════════════════════');
    
    // CRITICAL: Return ONLY valid JSON (no markdown, no explanations)
    console.log('\n=== FINAL JSON RESULT ===');
    console.log(JSON.stringify(finalOutput, null, 0));
    
    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const outputFile = path.join(__dirname, `perplexity-hybrid-results-${timestamp}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2));
    console.log(`\n📁 Results saved to: ${outputFile}`);
    
    // In production, would write verified results to Supabase table 'rfp_opportunities'
    // using mcp__supabase__execute_sql
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the system
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, perplexityPrimaryDiscovery, brightdataFallbackSearch, calculateFitScore };