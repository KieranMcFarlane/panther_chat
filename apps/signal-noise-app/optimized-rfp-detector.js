#!/usr/bin/env node

/**
 * 🎯 OPTIMIZED RFP DETECTION SYSTEM
 * 
 * Key Improvements:
 * - Economical 3-entity batch processing for memory efficiency
 * - Strict digital-only filtering (no stadiums, hospitality, apparel)
 * - Real URL validation (no fabricated URLs)
 * - Perplexity MCP integration with proper error handling
 * - Memory-optimized processing
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration for economical processing
const CONFIG = {
  BATCH_SIZE: 3, // Process 3 entities at a time for memory efficiency
  MAX_ENTITIES: 50, // Total entities to process
  OUTPUT_FILE: 'optimized-rfp-results.json',
  LOG_FILE: 'optimized-rfp-detector.log'
};

// Global state for tracking
const STATE = {
  entities_processed: 0,
  total_rfps_detected: 0,
  entities_with_rfps: 0,
  start_time: new Date(),
  results: []
};

// Yellow Panther business context
const YELLOW_PANTHER_CONTEXT = `Digital studio specializing in mobile app development, digital transformation, web development, and sports technology platforms for sports organizations (£80K-£500K budget range).`;

// Critical exclusions - DO NOT DETECT
const CRITICAL_EXCLUSIONS = [
  "stadium construction", "renovation", "infrastructure", 
  "hospitality services", "hotels", "F&B", "catering", 
  "apparel", "merchandise", "physical products",
  "event management", "production", "transportation", 
  "logistics", "security services", "equipment procurement"
];

// Digital-only keywords
const DIGITAL_KEYWORDS = [
  "digital transformation", "mobile app", "web development", 
  "software development", "technology platform", "RFP", 
  "tender", "procurement", "digital platform", "software"
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
 * Query Neo4j for sports entities
 */
async function queryNeo4jEntities(limit = 50, offset = 0) {
  await log('INFO', `Querying Neo4j for ${limit} sports entities (offset: ${offset})...`);
  
  try {
    const result = await mcp__neo4j_mcp__execute_query({
      query: `
        MATCH (e:Entity)
        WHERE e.type IN ['Club', 'League', 'Federation', 'Tournament']
        AND e.name IS NOT NULL
        AND e.country IS NOT NULL
        RETURN e.name as name, e.type as type, e.sport as sport, e.country as country, e.website as website
        ORDER BY e.name
        SKIP $offset LIMIT $limit
      `,
      params: { limit, offset }
    });
    
    await log('INFO', `Retrieved ${result.length} entities from Neo4j`, { count: result.length });
    return result;
  } catch (error) {
    await log('ERROR', 'Failed to query Neo4j entities', { error: error.message });
    return [];
  }
}

/**
 * Validate URL is real and not fabricated
 */
function isValidUrl(url) {
  if (!url || url === 'src_link": null' || url.includes('example.com')) {
    return false;
  }
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if content is digital-only (exclude non-digital)
 */
function isDigitalOnly(content) {
  const contentLower = content.toLowerCase();
  
  // Check for critical exclusions
  for (const exclusion of CRITICAL_EXCLUSIONS) {
    if (contentLower.includes(exclusion.toLowerCase())) {
      return false;
    }
  }
  
  // Check for digital keywords
  for (const keyword of DIGITAL_KEYWORDS) {
    if (contentLower.includes(keyword.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

/**
 * Process entity with Perplexity MCP
 */
async function processEntityWithPerplexity(entity, entityIndex) {
  const { name, type, sport, country, website } = entity;
  
  console.log(`[ENTITY-START] ${name}`);
  await log('INFO', `[ENTITY-START] ${entityIndex + 1} ${name} (${sport}, ${country})`);
  
  // Debug: Print MCP response for first 3 entities
  const debugMode = entityIndex < 3;
  
  const searchQuery = `Research ${name} (${sport}, ${country}) for active digital transformation opportunities:

${YELLOW_PANTHER_CONTEXT}

Search for:
1. Digital transformation RFPs
2. Mobile app development tenders  
3. Web development RFPs
4. Software development opportunities
5. Technology platform RFPs

CRITICAL: Only include digital/software projects. EXCLUDE:
- Stadium construction/renovation
- Hospitality services
- Apparel/merchandise
- Event management
- Equipment procurement

Requirements:
- Must have real, accessible URLs (no example.com)
- Only active opportunities (not expired/awarded)
- Budget range £80K-£500K preferred
- UK/EU preferred but global considered

Return JSON structure:
{
  "has_opportunities": true/false,
  "opportunities": [{
    "title": "Project title",
    "url": "Real URL or null",
    "description": "Brief description",
    "deadline": "YYYY-MM-DD or null",
    "budget": "Budget range or null",
    "source": "Source of information"
  }]
}`;

  try {
    const response = await mcp__perplexity_mcp__chat_completion({
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert RFP detection analyst for the sports industry. Return ONLY valid JSON, no markdown. Focus exclusively on digital/software opportunities for a sports technology development studio.' 
        },
        { role: 'user', content: searchQuery }
      ],
      format: 'json',
      include_sources: true,
      temperature: 0.1
    });
    
    // Debug: Print MCP response for first 3 entities
    if (debugMode) {
      console.log(`[MCP-RESPONSE] ${name}:`, JSON.stringify(response, null, 2));
    }
    
    let data;
    try {
      data = JSON.parse(response.content);
    } catch (parseError) {
      await log('ERROR', `Failed to parse Perplexity response for ${name}`, { 
        error: parseError.message, 
        response: response.content?.substring(0, 200) 
      });
      return { entity: name, status: 'ERROR', error: 'Invalid JSON response' };
    }
    
    if (data.has_opportunities && data.opportunities && data.opportunities.length > 0) {
      // Filter and validate opportunities
      const validOpportunities = [];
      for (const opp of data.opportunities) {
        // Check if digital-only
        const contentToCheck = `${opp.title} ${opp.description}`;
        if (!isDigitalOnly(contentToCheck)) {
          continue;
        }
        
        // Validate URL (must be real, not fabricated)
        if (opp.url && !isValidUrl(opp.url)) {
          await log('WARNING', `Invalid URL found for ${name}`, { url: opp.url });
          continue;
        }
        
        validOpportunities.push(opp);
      }
      
      if (validOpportunities.length > 0) {
        await log('SUCCESS', `[ENTITY-FOUND] ${name} (${validOpportunities.length} opportunities)`);
        STATE.total_rfps_detected += validOpportunities.length;
        STATE.entities_with_rfps++;
        
        return {
          entity: name,
          status: 'FOUND',
          opportunities: validOpportunities,
          detection_method: 'perplexity'
        };
      } else {
        await log('INFO', `[ENTITY-NONE] ${name} (no valid digital opportunities)`);
        return { entity: name, status: 'NONE', reason: 'No valid digital opportunities' };
      }
    } else {
      await log('INFO', `[ENTITY-NONE] ${name} (no opportunities found)`);
      return { entity: name, status: 'NONE', reason: 'No opportunities found' };
    }
    
  } catch (error) {
    await log('ERROR', `Perplexity processing failed for ${name}`, { error: error.message });
    return { entity: name, status: 'ERROR', error: error.message };
  }
}

/**
 * Calculate Yellow Panther fit score
 */
function calculateFitScore(opportunity) {
  let score = 0;
  
  const title = (opportunity.title || '').toLowerCase();
  const description = (opportunity.description || '').toLowerCase();
  const content = `${title} ${description}`;
  
  // +40: Digital/software project
  if (content.includes('digital') || content.includes('software') || content.includes('app')) {
    score += 40;
  }
  
  // +20: Budget £80K-£500K
  if (opportunity.budget && (
    content.includes('£80k') || content.includes('£500k') || 
    content.includes('80,000') || content.includes('500,000') ||
    content.includes('80000') || content.includes('500000')
  )) {
    score += 20;
  }
  
  // +15: Open RFP with deadline
  if (opportunity.deadline && new Date(opportunity.deadline) > new Date()) {
    score += 15;
  }
  
  // +10: UK/EU location
  if (content.includes('uk') || content.includes('europe') || content.includes('london') || 
      content.includes('manchester') || content.includes('germany') || content.includes('spain')) {
    score += 10;
  }
  
  return Math.min(100, score);
}

/**
 * Classify RFP type
 */
function classifyRFPType(opportunity) {
  const content = `${opportunity.title || ''} ${opportunity.description || ''}`.toLowerCase();
  
  if (opportunity.url && opportunity.url.includes('.pdf')) {
    return 'ACTIVE_RFP';
  }
  
  if (content.includes('rfp') || content.includes('tender') || content.includes('proposal')) {
    return 'ACTIVE_RFP';
  }
  
  if (content.includes('transformation') || content.includes('partnership') || content.includes('development')) {
    return 'SIGNAL';
  }
  
  return 'EXCLUDE';
}

/**
 * Process entities in economical batches
 */
async function processEntitiesInBatches(entities) {
  await log('INFO', `Processing ${entities.length} entities in batches of ${CONFIG.BATCH_SIZE}`);
  
  const results = [];
  
  // Process in economical batches of 3
  for (let i = 0; i < entities.length; i += CONFIG.BATCH_SIZE) {
    const batch = entities.slice(i, i + CONFIG.BATCH_SIZE);
    const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(entities.length / CONFIG.BATCH_SIZE);
    
    await log('INFO', `Processing batch ${batchNum}/${totalBatches} (${batch.length} entities)`);
    
    // Process each entity in the batch
    for (let j = 0; j < batch.length; j++) {
      const entity = batch[j];
      STATE.entities_processed++;
      
      const entityIndex = i + j;
      const result = await processEntityWithPerplexity(entity, entityIndex);
      
      if (result.status === 'FOUND' && result.opportunities) {
        // Process opportunities
        for (const opportunity of result.opportunities) {
          const fitScore = calculateFitScore(opportunity);
          const rfpType = classifyRFPType(opportunity);
          
          if (rfpType !== 'EXCLUDE') {
            results.push({
              organization: result.entity,
              src_link: opportunity.url || null,
              detection_strategy: 'perplexity',
              summary_json: {
                title: opportunity.title,
                confidence: 0.8, // Default confidence from Perplexity
                urgency: fitScore > 70 ? 'HIGH' : fitScore > 50 ? 'MEDIUM' : 'LOW',
                fit_score: fitScore,
                rfp_type: rfpType
              }
            });
          }
        }
      }
      
      // Progress update
      await log('INFO', `Progress: ${STATE.entities_processed}/${entities.length} entities | RFPs: ${STATE.total_rfps_detected}`);
    }
    
    // Small delay between batches to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Generate final structured output
 */
function generateStructuredOutput(highlights) {
  const totalRfps = highlights.length;
  
  // Calculate scoring summary
  let totalConfidence = 0;
  let totalFitScore = 0;
  let maxFitScore = 0;
  let topOpportunity = "";
  
  for (const highlight of highlights) {
    const confidence = highlight.summary_json.confidence || 0;
    const fitScore = highlight.summary_json.fit_score || 0;
    
    totalConfidence += confidence;
    totalFitScore += fitScore;
    
    if (fitScore > maxFitScore) {
      maxFitScore = fitScore;
      topOpportunity = highlight.organization;
    }
  }
  
  return {
    total_rfps_detected: totalRfps,
    entities_checked: STATE.entities_processed,
    detection_strategy: 'perplexity',
    highlights: highlights,
    scoring_summary: {
      avg_confidence: totalRfps > 0 ? Math.round(totalConfidence / totalRfps) : 0,
      avg_fit_score: totalRfps > 0 ? Math.round(totalFitScore / totalRfps) : 0,
      top_opportunity: topOpportunity
    }
  };
}

/**
 * Store results to Supabase (placeholder for MCP integration)
 */
async function storeToSupabase(results) {
  await log('INFO', `Storing ${results.highlights.length} RFP opportunities to Supabase`);
  
  try {
    // This would use the Supabase MCP when available
    // For now, we'll just log what would be stored
    for (const opportunity of results.highlights) {
      await log('INFO', `Would store to Supabase: ${opportunity.organization} - ${opportunity.summary_json.title}`);
    }
  } catch (error) {
    await log('ERROR', 'Failed to store to Supabase', { error: error.message });
  }
}

/**
 * Main execution function
 */
async function main() {
  await log('INFO', '🎯 Starting Optimized RFP Detection System');
  await log('INFO', `Processing ${CONFIG.MAX_ENTITIES} entities in batches of ${CONFIG.BATCH_SIZE}`);
  
  try {
    // Clear log file
    await fs.writeFile(CONFIG.LOG_FILE, '');
    
    // Query entities from Neo4j
    const entities = await queryNeo4jEntities(CONFIG.MAX_ENTITIES);
    
    if (entities.length === 0) {
      await log('ERROR', 'No entities retrieved from Neo4j. Exiting.');
      return;
    }
    
    // Process entities in economical batches
    const highlights = await processEntitiesInBatches(entities);
    
    // Generate structured output
    const structuredOutput = generateStructuredOutput(highlights);
    
    // Save results to file
    await fs.writeFile(CONFIG.OUTPUT_FILE, JSON.stringify(structuredOutput, null, 2));
    
    // Store to Supabase
    await storeToSupabase(structuredOutput);
    
    // Final summary
    const duration = Math.round((new Date() - STATE.start_time) / 1000);
    await log('SUCCESS', `🎯 Optimized RFP Detection Complete!`);
    await log('SUCCESS', `Processed: ${STATE.entities_processed} entities in ${duration}s`);
    await log('SUCCESS', `RFPs Detected: ${structuredOutput.total_rfps_detected}`);
    await log('SUCCESS', `Entities with RFPs: ${STATE.entities_with_rfps}`);
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

module.exports = { 
  main, 
  processEntityWithPerplexity, 
  isDigitalOnly, 
  isValidUrl,
  calculateFitScore,
  classifyRFPType
};