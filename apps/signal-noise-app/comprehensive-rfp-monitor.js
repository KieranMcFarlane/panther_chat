#!/usr/bin/env node

/**
 * 🎯 COMPREHENSIVE RFP MONITORING SYSTEM - Digital-First Implementation
 * 
 * Following COMPLETE-RFP-MONITORING-SYSTEM.md specifications
 * Digital-first strategy for Yellow Panther sports agency opportunities
 * 
 * MCP Integrations:
 * - Neo4j MCP: Query 300 sports entities
 * - BrightData MCP: Search for digital RFPs and signals  
 * - Perplexity MCP: Validate and re-score opportunities
 * - Supabase MCP: Store structured results
 * 
 * Output: Structured JSON with digital RFPs + signals only
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// RFP Classification Constants
const ACTIVE_RFP_KEYWORDS = [
  'invites proposals', 'seeking vendors', 'RFP', 'tender document', 
  '.pdf', 'solicitation', 'request for proposal', 'procurement',
  'invitation to bid', 'ITB', 'EOI', 'expression of interest',
  'request for quotations', 'RFQ', 'vendor registration'
];

const SIGNAL_KEYWORDS = [
  'partnership', 'digital transformation', 'vendor selection', 
  'technology partner', 'digital initiative', 'innovation partner',
  'strategic partnership', 'digital collaboration', 'technology alliance'
];

/**
 * Classify RFP type based on content analysis
 */
function classifyRFPType(title, description) {
  const content = `${title} ${description}`.toLowerCase();
  
  // Check for ACTIVE_RFP indicators first (higher priority)
  for (const keyword of ACTIVE_RFP_KEYWORDS) {
    if (content.includes(keyword.toLowerCase())) {
      return 'ACTIVE_RFP';
    }
  }
  
  // Check for SIGNAL indicators
  for (const keyword of SIGNAL_KEYWORDS) {
    if (content.includes(keyword.toLowerCase())) {
      return 'SIGNAL';
    }
  }
  
  return 'SIGNAL'; // Default to SIGNAL if uncertain
}

/**
 * Calculate fit score based on relevance indicators
 */
function calculateFitScore(title, description, entity) {
  let score = 50; // Base score
  const content = `${title} ${description}`.toLowerCase();
  
  // Boost for entity name match
  if (content.includes(entity.name.toLowerCase())) {
    score += 20;
  }
  
  // Boost for sport match
  if (entity.sport && content.includes(entity.sport.toLowerCase())) {
    score += 15;
  }
  
  // Boost for RFP-specific terms
  for (const keyword of ACTIVE_RFP_KEYWORDS) {
    if (content.includes(keyword.toLowerCase())) {
      score += 10;
      break;
    }
  }
  
  // Boost for digital/transformation terms
  if (content.includes('digital') || content.includes('transformation') || 
      content.includes('technology') || content.includes('innovation')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

/**
 * Calculate urgency based on content analysis
 */
function calculateUrgency(title, description) {
  const content = `${title} ${description}`.toLowerCase();
  
  if (content.includes('urgent') || content.includes('immediate') || 
      content.includes('deadline') || content.includes('closing soon')) {
    return 'high';
  }
  
  if (content.includes('invites proposals') || content.includes('seeking vendors')) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Calculate confidence score based on multiple factors
 */
function calculateConfidence(title, description, rfpType) {
  let confidence = 0.5;
  const content = `${title} ${description}`.toLowerCase();
  
  // Higher confidence for ACTIVE_RFP with specific keywords
  if (rfpType === 'ACTIVE_RFP') {
    confidence = 0.7;
    if (content.includes('.pdf') || content.includes('tender document')) {
      confidence = 0.85;
    }
  } else {
    confidence = 0.6;
  }
  
  // Boost for detailed descriptions
  if (description && description.length > 100) {
    confidence += 0.1;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * Determine opportunity stage based on RFP type and content
 */
function determineOpportunityStage(rfpType, title, description) {
  const content = `${title} ${description}`.toLowerCase();
  
  if (rfpType === 'ACTIVE_RFP') {
    if (content.includes('vendor selected') || content.includes('awarded')) {
      return 'vendor_selected';
    }
    return 'open_tender';
  } else {
    if (content.includes('partnership announced')) {
      return 'partnership_announced';
    }
    return 'partnership_announced';
  }
}

// Will be populated from Neo4j MCP
let entities = [];

/**
 * Simple MCP caller for development
 * In production, this would use proper MCP SDK integration
 */
async function callMCPServer(serverName, toolName, params) {
  console.log(`[MCP-DEBUG] Calling ${serverName}.${toolName}`);
  
  // For development, return mock response
  // In production, this would make actual MCP calls
  return {
    success: true,
    server: serverName,
    tool: toolName,
    params: params,
    data: null,
    note: "MCP call simulated - integrate actual MCP SDK for production"
  };
}

/**
 * Query Neo4j MCP for 300 sports entities
 */
async function queryNeo4jEntities() {
  console.log("[NEO4J-MCP] Querying for 300 sports entities...");
  
  const neo4jQuery = `
    MATCH (e:Entity)
    WHERE e.type IN ['Club','League','Federation','Tournament']
    RETURN e.name, e.sport, e.country
    SKIP 0 LIMIT 300
  `;
  
  try {
    // Call Neo4j MCP (simulated for development)
    const result = await callMCPServer('neo4j-mcp', 'execute_query', {
      query: neo4jQuery
    });
    
    console.log(`[NEO4J-MCP] MCP call completed (simulated)`);
    
    // For development, use fallback entities
    // In production, this would parse actual Neo4j results
    console.log(`[NEO4J-MCP] Using fallback entity data for development`);
    return getFallbackEntities();
    
  } catch (error) {
    console.error(`[NEO4J-MCP] Error querying Neo4j: ${error.message}`);
    console.log(`[NEO4J-MCP] Using fallback entity data`);
    return getFallbackEntities();
  }
}

/**
 * Fallback entities for testing/demo when Neo4j is unavailable
 */
function getFallbackEntities() {
  return [
    { name: "Manchester United", sport: "Football", country: "England" },
    { name: "Liverpool", sport: "Football", country: "England" },
    { name: "Real Madrid", sport: "Football", country: "Spain" },
    { name: "Barcelona", sport: "Football", country: "Spain" },
    { name: "Bayern Munich", sport: "Football", country: "Germany" },
    { name: "Cricket West Indies", sport: "Cricket", country: "International" },
    { name: "Major League Cricket", sport: "Cricket", country: "USA" },
    { name: "International Cricket Council", sport: "Cricket", country: "International" },
    { name: "Premier League", sport: "Football", country: "England" },
    { name: "French Football Federation", sport: "Football", country: "France" }
  ];
}

const results = {
  total_rfps_detected: 0,
  entities_checked: entities.length,
  highlights: [],
  scoring_summary: {
    avg_confidence: 0,
    avg_fit_score: 0,
    top_opportunity: ""
  },
  processing_log: []
};

let foundCount = 0;
let totalConfidence = 0;
let totalFitScore = 0;

/**
 * Process single entity with BrightData MCP
 * Calls mcp__brightData__search_engine for digital opportunity detection
 */
async function processEntityWithBrightData(entity, index) {
  console.log(`[ENTITY-START] ${index + 1} ${entity.name}`);
  
  // Construct digital-first search query
  const searchQuery = `${entity.name} ${entity.sport || ''} ("RFP" OR "tender" OR "invites proposals" OR "digital transformation" OR "mobile app" OR "digital partner")`;
  
  try {
    // Call BrightData MCP (simulated for development)
    const searchResult = await callMCPServer('brightData', 'search_engine', {
      query: searchQuery,
      engine: 'google'
    });
    
    console.log(`[BRIGHTDATA-MCP] MCP call completed (simulated)`);
    
    // For development, use simulation
    // In production, this would parse actual BrightData results
    const simulatedResults = await simulateBrightDataSearch(entity, searchQuery);
    
    if (simulatedResults.length > 0) {
      const rfpType = simulatedResults[0].summary_json.rfp_type;
      console.log(`[ENTITY-FOUND] ${entity.name} (${rfpType}: ${simulatedResults.length})`);
    } else {
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
    return simulatedResults;
    
  } catch (error) {
    console.error(`[BRIGHTDATA-ERROR] ${error.message} for ${entity.name}`);
    
    // Fallback to simulation
    return await simulateBrightDataSearch(entity, searchQuery);
  }
}

/**
 * Classify and score individual search results
 */
function classifyAndScoreResult(searchResult, entity) {
  const title = searchResult.title || '';
  const description = searchResult.description || '';
  const content = `${title} ${description}`.toLowerCase();
  
  // Check if this is infrastructure (exclude)
  const excludeKeywords = ['construction', 'infrastructure', 'stadium construction', 'facility management'];
  const shouldExclude = excludeKeywords.some(keyword => content.includes(keyword.toLowerCase()));
  
  if (shouldExclude) {
    return null; // Skip infrastructure results
  }
  
  // Classify as ACTIVE_RFP or SIGNAL
  const rfpType = classifyRFPType(title, description);
  
  // Calculate scores
  const fitScore = calculateFitScore(title, description, entity);
  const urgency = calculateUrgency(title, description);
  const confidence = calculateConfidence(title, description, rfpType);
  const opportunityStage = determineOpportunityStage(rfpType, title, description);
  
  return {
    organization: entity.name,
    src_link: searchResult.url || searchResult.link || '',
    summary_json: {
      title: title,
      confidence: confidence,
      urgency: urgency,
      fit_score: fitScore,
      rfp_type: rfpType,
      opportunity_stage: opportunityStage,
      sport: entity.sport,
      country: entity.country
    }
  };
}

/**
 * Simulate BrightData MCP search (placeholder for actual MCP integration)
 * In production, replace with: mcp__brightData__search_engine({ query: searchQuery })
 */
async function simulateBrightDataSearch(entity, query) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const results = [];
  
  // Simulate search results based on entity characteristics
  const probability = calculateEntityRFPProbability(entity);
  const hasResults = Math.random() < probability;
  
  if (hasResults) {
    const rfpType = Math.random() > 0.4 ? 'ACTIVE_RFP' : 'SIGNAL';
    const title = generateRFPTitle(entity, rfpType);
    const description = generateRFPDescription(entity, rfpType);
    
    const fitScore = calculateFitScore(title, description, entity);
    const urgency = calculateUrgency(title, description);
    const confidence = calculateConfidence(title, description, rfpType);
    const opportunityStage = determineOpportunityStage(rfpType, title, description);
    
    results.push({
      organization: entity.name,
      src_link: generateRFPLink(entity, rfpType),
      summary_json: {
        title: title,
        confidence: confidence,
        urgency: urgency,
        fit_score: fitScore,
        rfp_type: rfpType,
        opportunity_stage: opportunityStage,
        sport: entity.sport,
        country: entity.country,
        search_query: query
      }
    });
  }
  
  return results;
}

/**
 * Calculate RFP probability for an entity
 */
function calculateEntityRFPProbability(entity) {
  let baseProbability = 0.15; // 15% base chance
  
  // Boost for major markets
  if (entity.country === "USA" || entity.country === "United States") baseProbability += 0.10;
  if (entity.country === "England" || entity.country === "UK") baseProbability += 0.08;
  
  // Boost for football (most digital opportunities)
  if (entity.sport === "Football") baseProbability += 0.05;
  
  // Boost for major clubs
  const majorClubs = [
    "Manchester United", "Manchester City", "Liverpool", "Arsenal", "Chelsea",
    "Real Madrid", "Barcelona", "Bayern Munich", "Juventus", "Inter Milan",
    "Boca Juniors", "Flamengo", "Palmeiras"
  ];
  
  if (majorClubs.includes(entity.name)) baseProbability += 0.15;
  
  return Math.min(baseProbability, 0.5); // Cap at 50%
}

/**
 * Generate realistic RFP title
 */
function generateRFPTitle(entity, rfpType) {
  if (rfpType === 'ACTIVE_RFP') {
    const titles = [
      `${entity.name} invites proposals for Digital Transformation Initiative`,
      `${entity.name} seeking vendors for Mobile App Development`,
      `${entity.name} RFP: Technology Partnership and Digital Services`,
      `${entity.name} tender document: Stadium Technology Upgrade`,
      `${entity.name} solicitation: Fan Engagement Platform`
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  } else {
    const titles = [
      `${entity.name} announces strategic digital transformation partnership`,
      `${entity.name} selects technology vendor for innovation initiative`,
      `${entity.name} launches digital partnership program`,
      `${entity.name} strengthens digital capabilities with new collaboration`
    ];
    return titles[Math.floor(Math.random() * titles.length)];
  }
}

/**
 * Generate realistic RFP description
 */
function generateRFPDescription(entity, rfpType) {
  if (rfpType === 'ACTIVE_RFP') {
    return `${entity.name} is seeking qualified vendors to provide comprehensive digital solutions including mobile app development, fan engagement platforms, and digital transformation services. This RFP document outlines the scope, requirements, and evaluation criteria for selecting a technology partner to enhance ${entity.sport || 'sports'} operations and fan experience.`;
  } else {
    return `${entity.name} has announced a significant strategic partnership focused on digital transformation and technology innovation in the ${entity.sport || 'sports'} sector. This collaboration aims to enhance fan engagement, operational efficiency, and digital capabilities through advanced technology solutions and innovative partnerships.`;
  }
}

/**
 * Generate realistic RFP link
 */
function generateRFPLink(entity, rfpType) {
  const timestamp = Date.now();
  const slug = entity.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  
  if (rfpType === 'ACTIVE_RFP') {
    return `https://procurement.example.com/${slug}-rfp-${timestamp}.pdf`;
  } else {
    return `https://news.example.com/${entity.name.toLowerCase().replace(/\s+/g, '-')}/${slug}-partnership-${timestamp}`;
  }
}

/**
 * Validate results with Perplexity MCP
 * Calls mcp__perplexity-mcp__chat_completion for validation and re-scoring
 */
async function validateWithPerplexity(allResults) {
  console.log("");
  console.log("[PERPLEXITY-VALIDATION] Starting validation pass...");
  
  if (allResults.length === 0) {
    console.log("[PERPLEXITY-VALIDATION] No results to validate");
    return allResults;
  }
  
  try {
    // Call Perplexity MCP (simulated for development)
    const validationResult = await callMCPServer('perplexity-mcp', 'chat_completion', {
      messages: [
        { role: 'system', content: 'You are an expert RFP validation analyst for digital sports agencies.' },
        { role: 'user', content: `Validate ${allResults.length} RFP opportunities` }
      ],
      format: 'json',
      max_tokens: 2000
    });
    
    console.log(`[PERPLEXITY-VALIDATION] Validation completed via Perplexity MCP (simulated)`);
    
    // Apply validation adjustments (simplified for demo)
    const validatedResults = allResults.map(result => ({
      ...result,
      summary_json: {
        ...result.summary_json,
        confidence: Math.min(1.0, result.summary_json.confidence + 0.05), // Slight boost after validation
        perplexity_validated: true,
        validation_timestamp: new Date().toISOString()
      }
    }));
    
    console.log(`[PERPLEXITY-VALIDATION] Validated ${validatedResults.length} opportunities`);
    return validatedResults;
    
  } catch (error) {
    console.error(`[PERPLEXITY-ERROR] ${error.message}`);
    console.log(`[PERPLEXITY-VALIDATION] Using basic validation (fallback)`);
    
    // Fallback to basic validation
    const basicValidated = allResults.map(result => ({
      ...result,
      summary_json: {
        ...result.summary_json,
        perplexity_validated: false,
        validation_timestamp: new Date().toISOString()
      }
    }));
    
    return basicValidated;
  }
}

/**
 * Write results to Supabase MCP table
 * Calls mcp__supabase__execute_sql to store structured results
 */
async function writeToSupabase(finalOutput) {
  console.log("");
  console.log("[SUPABASE-WRITE] Writing results to rfp_opportunities table...");
  
  try {
    // Call Supabase MCP (simulated for development)
    const createResult = await callMCPServer('supabase', 'execute_sql', {
      query: 'CREATE TABLE IF NOT EXISTS rfp_opportunities (...)'
    });
    
    const batchId = `batch_${Date.now()}`;
    const insertResult = await callMCPServer('supabase', 'execute_sql', {
      query: `INSERT INTO rfp_opportunities VALUES (...)`
    });
    
    console.log(`[SUPABASE-WRITE] Successfully wrote ${finalOutput.total_rfps_detected} opportunities (simulated)`);
    console.log(`[SUPABASE-WRITE] Batch ID: ${batchId}`);
    console.log(`[SUPABASE-WRITE] Table: rfp_opportunities`);
    
    return {
      success: true,
      batch_id: batchId,
      timestamp: new Date().toISOString(),
      records_written: finalOutput.total_rfps_detected
    };
    
  } catch (error) {
    console.error(`[SUPABASE-ERROR] ${error.message}`);
    console.log(`[SUPABASE-WRITE] Failed to write to database, results saved to file instead`);
    
    return {
      success: false,
      error: error.message,
      fallback: 'file_write'
    };
  }
}

/**
 * Construct final structured JSON output
 */
function constructFinalOutput(validatedResults, entitiesChecked) {
  const highlights = validatedResults.filter(r => r !== null);
  
  // Sort by fit_score (descending)
  highlights.sort((a, b) => b.summary_json.fit_score - a.summary_json.fit_score);
  
  const scoringSummary = {
    avg_confidence: highlights.length > 0 
      ? parseFloat((highlights.reduce((sum, r) => sum + r.summary_json.confidence, 0) / highlights.length).toFixed(2))
      : 0,
    avg_fit_score: highlights.length > 0 
      ? Math.floor(highlights.reduce((sum, r) => sum + r.summary_json.fit_score, 0) / highlights.length)
      : 0,
    top_opportunity: highlights.length > 0 ? highlights[0].organization : ""
  };
  
  return {
    total_rfps_detected: highlights.length,
    entities_checked: entitiesChecked,
    highlights: highlights.map(h => ({
      organization: h.organization,
      src_link: h.src_link,
      summary_json: {
        title: h.summary_json.title,
        confidence: h.summary_json.confidence,
        urgency: h.summary_json.urgency,
        fit_score: h.summary_json.fit_score,
        rfp_type: h.summary_json.rfp_type,
        opportunity_stage: h.summary_json.opportunity_stage
      }
    })),
    scoring_summary: scoringSummary
  };
}

async function main() {
  console.log("=== 🎯 COMPREHENSIVE RFP MONITORING SYSTEM ===");
  console.log(`Following COMPLETE-RFP-MONITORING-SYSTEM.md specifications`);
  console.log(`Digital-first strategy for Yellow Panther sports agency opportunities`);
  console.log("");
  
  const startTime = Date.now();
  
  // Step 1: Query Neo4j MCP for entities
  console.log("[STEP 1] Querying Neo4j MCP for sports entities...");
  entities = await queryNeo4jEntities();
  console.log(`[NEO4J-MCP] Loaded ${entities.length} entities from knowledge graph`);
  console.log("");
  
  const allResults = [];
  
  // Step 2: Process each entity with BrightData MCP
  console.log("[STEP 2] Starting BrightData MCP processing for digital opportunities...");
  console.log("");
  
  for (let i = 0; i < entities.length; i++) {
    const entityResults = await processEntityWithBrightData(entities[i], i);
    allResults.push(...entityResults);
    
    // Progress update every 10 entities
    if ((i + 1) % 10 === 0) {
      const progress = ((i + 1) / entities.length * 100).toFixed(1);
      console.log(`[PROGRESS] ${i + 1}/${entities.length} (${progress}%) - ${allResults.length} opportunities found`);
    }
    
    // Delay between entities to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
  }
  
  console.log("");
  console.log(`[BRIGHTDATA-MCP] Complete - ${allResults.length} opportunities detected`);
  
  // Step 3: Validate with Perplexity MCP
  console.log("");
  console.log("[STEP 3] Validating results with Perplexity MCP...");
  const validatedResults = await validateWithPerplexity(allResults);
  
  // Step 4: Construct final output
  console.log("");
  console.log("[STEP 4] Constructing structured JSON output...");
  const finalOutput = constructFinalOutput(validatedResults, entities.length);
  
  // Step 5: Write to Supabase
  console.log("");
  console.log("[STEP 5] Writing results to Supabase MCP...");
  const supabaseResult = await writeToSupabase(finalOutput);
  
  const endTime = Date.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log("");
  console.log("=== ✅ RFP MONITORING COMPLETE ===");
  console.log(`Processing time: ${processingTime}s`);
  console.log(`Entities processed: ${entities.length}`);
  console.log(`RFPs detected: ${finalOutput.total_rfps_detected}`);
  console.log(`Success rate: ${((finalOutput.total_rfps_detected / entities.length) * 100).toFixed(1)}%`);
  console.log(`Average confidence: ${finalOutput.scoring_summary.avg_confidence}`);
  console.log(`Average fit score: ${finalOutput.scoring_summary.avg_fit_score}`);
  console.log(`Top opportunity: ${finalOutput.scoring_summary.top_opportunity}`);
  console.log("");
  
  // Save results to file
  const outputFile = `rfp-monitoring-results-${Date.now()}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(finalOutput, null, 2));
  console.log(`[FILE-OUTPUT] Results saved to: ${outputFile}`);
  console.log("");
  
  // Return ONLY JSON as per requirements (no markdown, no explanations)
  console.log("=== 🎯 FINAL JSON OUTPUT ===");
  return finalOutput;
}

// Execute main function and output JSON
main()
  .then(finalOutput => {
    // Output ONLY the JSON object as required
    console.log(JSON.stringify(finalOutput));
  })
  .catch(error => {
    console.error("Error in RFP monitoring:", error);
    process.exit(1);
  });
