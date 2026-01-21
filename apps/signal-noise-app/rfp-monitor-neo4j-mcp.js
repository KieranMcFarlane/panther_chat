#!/usr/bin/env node

/**
 * Complete RFP Monitoring System
 * Following COMPLETE-RFP-MONITORING-SYSTEM.md specifications
 * Uses Neo4j MCP, BrightData MCP, and Perplexity MCP
 */

const neo4j = require('neo4j-driver');

// Environment configuration
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
const BRIGHTDATA_TOKEN = process.env.BRIGHTDATA_TOKEN || 'bbbc6961d91d724bb6eb0b18bfc91bc11abd3a0d454411230d1f92aea27917f4';
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '';

// State management
const state = {
  entitiesChecked: 0,
  rfpsDetected: 0,
  highlights: [],
  scores: { confidence: [], fitScore: [] },
  processedEntities: new Set()
};

// Neo4j connection
let driver;

/**
 * Initialize Neo4j connection
 */
async function initNeo4j() {
  driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  const serverInfo = await driver.getServerInfo();
  console.log(`[SYSTEM] Connected to Neo4j: ${serverInfo.address}`);
}

/**
 * Query 300 entities from Neo4j
 */
async function getEntities() {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (e:Entity)
       WHERE e.type IN ['Club','League','Federation','Tournament']
       RETURN e.name as name, e.sport as sport, e.country as country
       SKIP 0 LIMIT 300`
    );
    
    return result.records.map(record => ({
      name: record.get('name'),
      sport: record.get('sport') || 'Unknown',
      country: record.get('country') || 'Unknown'
    }));
  } finally {
    await session.close();
  }
}

/**
 * Perform BrightData search for RFP opportunities
 */
async function searchBrightData(entity) {
  const searchQuery = `${entity.name} ${entity.sport} ("RFP" OR "tender" OR "invites proposals" OR "digital transformation" OR "mobile app" OR "digital partner")`;
  
  try {
    const response = await fetch('https://api.brightdata.com/serp_search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BRIGHTDATA_TOKEN}`
      },
      body: JSON.stringify({
        q: searchQuery,
        engine: 'google',
        num: 10
      })
    });
    
    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }
    
    const data = await response.json();
    return classifyResults(data.organic || [], entity);
  } catch (error) {
    console.error(`[ERROR] BrightData search failed for ${entity.name}:`, error.message);
    return [];
  }
}

/**
 * Classify search results
 */
function classifyResults(results, entity) {
  return results.map(result => {
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const url = (result.link || '').toLowerCase();
    
    const combinedText = `${title} ${snippet} ${url}`;
    
    // Active RFP indicators
    const activeRfpKeywords = [
      'invites proposals', 'seeking vendors', 'request for proposal',
      'tender document', '.pdf', 'solicitation', 'bid submission',
      'procurement', 'vendor registration'
    ];
    
    // Signal indicators  
    const signalKeywords = [
      'partnership announcement', 'digital transformation',
      'vendor selection', 'strategic partnership', 'technology partner'
    ];
    
    let rfpType = 'UNKNOWN';
    let confidence = 0.3;
    let urgency = 'low';
    let opportunityStage = 'unknown';
    
    const hasActiveRfp = activeRfpKeywords.some(keyword => combinedText.includes(keyword));
    const hasSignal = signalKeywords.some(keyword => combinedText.includes(keyword));
    
    if (hasActiveRfp) {
      rfpType = 'ACTIVE_RFP';
      confidence = 0.8;
      urgency = combinedText.includes('urgent') || combinedText.includes('deadline') ? 'high' : 'medium';
      opportunityStage = 'open_tender';
    } else if (hasSignal) {
      rfpType = 'SIGNAL';
      confidence = 0.6;
      urgency = 'low';
      opportunityStage = combinedText.includes('vendor selected') ? 'vendor_selected' : 'partnership_announced';
    }
    
    // Calculate fit score
    const fitScore = calculateFitScore(confidence, rfpType, combinedText);
    
    return {
      organization: entity.name,
      src_link: result.link,
      summary_json: {
        title: result.title,
        confidence: confidence,
        urgency: urgency,
        fit_score: fitScore,
        rfp_type: rfpType,
        opportunity_stage: opportunityStage
      }
    };
  }).filter(result => result.summary_json.rfp_type !== 'UNKNOWN');
}

/**
 * Calculate fit score
 */
function calculateFitScore(confidence, rfpType, text) {
  let score = Math.round(confidence * 100);
  
  if (rfpType === 'ACTIVE_RFP') {
    score += 20;
  }
  
  if (text.includes('digital') || text.includes('mobile app') || text.includes('technology')) {
    score += 15;
  }
  
  if (text.includes('sport') || text.includes('stadium') || text.includes('venue')) {
    score += 10;
  }
  
  return Math.min(score, 100);
}

/**
 * Process single entity
 */
async function processEntity(entity, index) {
  if (state.processedEntities.has(entity.name)) {
    return;
  }
  
  state.processedEntities.add(entity.name);
  state.entitiesChecked++;
  
  console.log(`[ENTITY-START] ${index} ${entity.name}`);
  
  try {
    const opportunities = await searchBrightData(entity);
    
    if (opportunities.length > 0) {
      const activeRfps = opportunities.filter(op => op.summary_json.rfp_type === 'ACTIVE_RFP').length;
      const signals = opportunities.filter(op => op.summary_json.rfp_type === 'SIGNAL').length;
      
      console.log(`[ENTITY-FOUND] ${entity.name} (ACTIVE_RFP: ${activeRfps}, SIGNAL: ${signals})`);
      
      opportunities.forEach(opp => {
        state.highlights.push(opp);
        state.rfpsDetected++;
        state.scores.confidence.push(opp.summary_json.confidence);
        state.scores.fitScore.push(opp.summary_json.fit_score);
      });
    } else {
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    console.error(`[ERROR] Failed to process ${entity.name}:`, error.message);
  }
}

/**
 * Validate results with Perplexity
 */
async function validateWithPerplexity() {
  if (!PERPLEXITY_API_KEY) {
    console.log('[SYSTEM] Perplexity API key not configured, skipping validation');
    return;
  }
  
  console.log('[SYSTEM] Starting Perplexity validation pass...');
  
  // Get top 10 opportunities for validation
  const topOpportunities = state.highlights
    .sort((a, b) => b.summary_json.fit_score - a.summary_json.fit_score)
    .slice(0, 10);
  
  for (const opportunity of topOpportunities) {
    try {
      const validationQuery = `Validate this RFP opportunity: ${opportunity.summary_json.title} at ${opportunity.src_link}. Is this a legitimate sports organization digital RFP?`;
      
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-sonar-small-128k-online',
          messages: [
            { role: 'user', content: validationQuery }
          ],
          max_tokens: 300
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        const validation = data.choices[0]?.message?.content || '';
        
        // Adjust confidence based on validation
        if (validation.toLowerCase().includes('legitimate') || validation.toLowerCase().includes('valid rfp')) {
          opportunity.summary_json.confidence = Math.min(opportunity.summary_json.confidence + 0.1, 1.0);
          opportunity.summary_json.fit_score = Math.min(opportunity.summary_json.fit_score + 10, 100);
        } else if (validation.toLowerCase().includes('not legitimate') || validation.toLowerCase().includes('invalid')) {
          opportunity.summary_json.confidence = Math.max(opportunity.summary_json.confidence - 0.2, 0.0);
          opportunity.summary_json.fit_score = Math.max(opportunity.summary_json.fit_score - 20, 0);
        }
      }
    } catch (error) {
      console.error(`[ERROR] Perplexity validation failed for ${opportunity.organization}:`, error.message);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Generate structured JSON output
 */
function generateOutput() {
  const avgConfidence = state.scores.confidence.length > 0
    ? state.scores.confidence.reduce((a, b) => a + b, 0) / state.scores.confidence.length
    : 0;
  
  const avgFitScore = state.scores.fitScore.length > 0
    ? state.scores.fitScore.reduce((a, b) => a + b, 0) / state.scores.fitScore.length
    : 0;
  
  const topOpportunity = state.highlights.length > 0
    ? state.highlights.sort((a, b) => b.summary_json.fit_score - a.summary_json.fit_score)[0].organization
    : 'None';
  
  return {
    total_rfps_detected: state.rfpsDetected,
    entities_checked: state.entitiesChecked,
    highlights: state.highlights,
    scoring_summary: {
      avg_confidence: Math.round(avgConfidence * 1000) / 1000,
      avg_fit_score: Math.round(avgFitScore * 10) / 10,
      top_opportunity: topOpportunity
    }
  };
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('[SYSTEM] Starting Comprehensive RFP Monitoring System...');
    console.log(`[SYSTEM] Time: ${new Date().toISOString()}`);
    console.log(`[SYSTEM] Neo4j URI: ${NEO4J_URI}`);
    
    // Initialize Neo4j connection
    await initNeo4j();
    
    // Get entities
    console.log('[SYSTEM] Fetching entities from Neo4j...');
    const entities = await getEntities();
    console.log(`[SYSTEM] Retrieved ${entities.length} entities`);
    
    // Process entities
    console.log('[SYSTEM] Starting entity processing...');
    for (let i = 0; i < entities.length; i++) {
      await processEntity(entities[i], i + 1);
    }
    
    // Validate with Perplexity
    await validateWithPerplexity();
    
    // Generate output
    console.log('[SYSTEM] Generating structured output...');
    const output = generateOutput();
    
    // Output ONLY JSON as per specification
    console.log(JSON.stringify(output, null, 2));
    
    // Cleanup
    await driver.close();
    
  } catch (error) {
    console.error('[SYSTEM] Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { main, generateOutput };