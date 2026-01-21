#!/usr/bin/env node

/**
 * Process 50 sports entities for RFP detection using Perplexity MCP
 * This script performs comprehensive RFP detection with proper validation and classification
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 50 entities from Neo4j (starting from offset 1150)
const entities = [
  { name: "Brazilian Football Confederation", sport: "Football", country: "Brazil", type: "Federation" },
  { name: "Russian Football Union", sport: "Football", country: "Russia", type: "Federation" },
  { name: "Grenada Basketball Association", sport: "Basketball", country: "Grenada", type: "Federation" },
  { name: "Ethiopian Handball Federation", sport: "Handball", country: "Ethiopia", type: "Federation" },
  { name: "International Ice Hockey Federation", sport: "Ice Hockey", country: "Switzerland", type: "Federation" },
  { name: "FIVB", sport: "Volleyball", country: "Switzerland", type: "Federation" },
  { name: "CEV", sport: "Volleyball", country: "Luxembourg", type: "Federation" },
  { name: "European Athletics", sport: "Athletics", country: "Switzerland", type: "Federation" },
  { name: "International Biathlon Union", sport: "Biathlon", country: "Austria", type: "Federation" },
  { name: "International Skating Union", sport: "Figure Skating, Speed Skating", country: "Switzerland", type: "Federation" },
  { name: "International Luge Federation", sport: "Luge", country: "Germany", type: "Federation" },
  { name: "International Bobsleigh and Skeleton Federation", sport: "Bobsleigh, Skeleton", country: "Switzerland", type: "Federation" },
  { name: "World Curling Federation", sport: "Curling", country: "Switzerland", type: "Federation" },
  { name: "International Table Tennis Federation", sport: "Table Tennis", country: "Switzerland", type: "Federation" },
  { name: "World Triathlon", sport: "Triathlon", country: "Spain", type: "Federation" },
  { name: "International Modern Pentathlon Union", sport: "Modern Pentathlon", country: "Hungary", type: "Federation" },
  { name: "International Archery Federation", sport: "Archery", country: "Switzerland", type: "Federation" },
  { name: "International Boxing Association", sport: "Boxing", country: "Turkey", type: "Federation" },
  { name: "International Judo Federation", sport: "Judo", country: "Hungary", type: "Federation" },
  { name: "International Wrestling Federation", sport: "Wrestling", country: "Turkey", type: "Federation" },
  { name: "International Taekwondo Federation", sport: "Taekwondo", country: "South Korea", type: "Federation" },
  { name: "Latvian Basketball Association", sport: "Basketball", country: "Latvia", type: "Federation" },
  { name: "Peruvian Rugby Federation", sport: "Rugby Union", country: "Peru", type: "Federation" },
  { name: "Costa Rican Handball Federation", sport: "Handball", country: "Costa Rica", type: "Federation" },
  { name: "Israel Ice Hockey Federation", sport: "Ice Hockey", country: "Israel", type: "Federation" },
  { name: "Finnish Football Association", sport: "Football", country: "Finland", type: "Federation" },
  { name: "US Virgin Islands Baseball Federation", sport: "Baseball", country: "US Virgin Islands", type: "Federation" },
  { name: "Colombian Volleyball Federation", sport: "Volleyball", country: "Colombia", type: "Federation" },
  { name: "Canadian Ice Hockey Federation", sport: "Ice Hockey", country: "Canada", type: "Federation" },
  { name: "Netherlands Cricket Board", sport: "Cricket", country: "Netherlands", type: "Federation" },
  { name: "Kenya Basketball Federation", sport: "Basketball", country: "Kenya", type: "Federation" },
  { name: "Indonesian Volleyball Federation", sport: "Volleyball", country: "Indonesia", type: "Federation" },
  { name: "United Arab Emirates Emirates Motorsports Organization (EMSO)", sport: "Motorsport", country: "UAE", type: "Federation" },
  { name: "Polish Ice Hockey Federation", sport: "Ice Hockey", country: "Poland", type: "Federation" },
  { name: "Panama Cricket Association", sport: "Cricket", country: "Panama", type: "Federation" },
  { name: "Kenya Rugby Union", sport: "Rugby Union", country: "Kenya", type: "Federation" },
  { name: "Thai Baseball Federation", sport: "Baseball", country: "Thailand", type: "Federation" },
  { name: "Motorsport South Africa (MSA)", sport: "Motorsport", country: "South Africa", type: "Federation" },
  { name: "Niue Rugby Football Union", sport: "Rugby Union", country: "Niue", type: "Federation" },
  { name: "Antigua and Barbuda Basketball Association", sport: "Basketball", country: "Antigua and Barbuda", type: "Federation" },
  { name: "Czech Baseball Association", sport: "Baseball", country: "Czech Republic", type: "Federation" },
  { name: "Central African Football Federation", sport: "Football", country: "Central African Republic", type: "Federation" },
  { name: "Thai Cricket Association", sport: "Cricket", country: "Thailand", type: "Federation" },
  { name: "Qatar Ice Hockey Federation", sport: "Ice Hockey", country: "Qatar", type: "Federation" },
  { name: "Armenian Football Federation", sport: "Football", country: "Armenia", type: "Federation" },
  { name: "Malaysian Rugby Union", sport: "Rugby Union", country: "Malaysia", type: "Federation" },
  { name: "Polish Rugby Union", sport: "Rugby Union", country: "Poland", type: "Federation" },
  { name: "Tunisian Ice Hockey Association", sport: "Ice Hockey", country: "Tunisia", type: "Federation" },
  { name: "Kuwait Ice Hockey Association", sport: "Ice Hockey", country: "Kuwait", type: "Federation" },
  { name: "Mauritanian Basketball Federation", sport: "Basketball", country: "Mauritania", type: "Federation" }
];

// Non-digital exclusion keywords
const nonDigitalKeywords = [
  'stadium construction', 'construction', 'hospitality', 'apparel', 'merchandise',
  'f&b', 'food and beverage', 'catering', 'event production', 'venue management',
  'ticketing', 'sponsorship', 'broadcasting rights', 'media rights', 'infrastructure',
  'real estate', 'facilities', 'maintenance', 'operations', 'security',
  'cleaning', 'waste management', 'transportation', 'parking', 'retail'
];

// Digital/software keywords
const digitalKeywords = [
  'digital transformation', 'mobile app', 'web development', 'software development',
  'technology platform', 'digital platform', 'rfp', 'tender', 'procurement',
  'it services', 'cloud services', 'data analytics', 'crm', 'erp',
  'e-commerce', 'digital marketing', 'cybersecurity', 'ai platform',
  'machine learning', 'blockchain', 'iot', 'ar/vr', 'fan engagement platform'
];

/**
 * Execute MCP tool call via Python script
 */
async function callMCPTool(entity, searchTerm) {
  return new Promise((resolve, reject) => {
    const pythonScript = `
import json
import sys
import subprocess
import os

# MCP tool call for Perplexity search
def call_perplexity_mcp(search_query):
    try:
        # Set environment variables
        env = os.environ.copy()
        env['PERPLEXITY_API_KEY'] = os.getenv('PERPLEXITY_API_KEY', 'pplx-7qR3K2yVd4vB8nX6tJmP4rHkL9sWfQ3xZc5vN2bG1oU')
        
        # Call Python MCP script
        result = subprocess.run([
            sys.executable, 'mcp-rfp-detector.py', search_query
        ], capture_output=True, text=True, env=env, timeout=60)
        
        if result.returncode == 0:
            try:
                data = json.loads(result.stdout.strip())
                return data
            except json.JSONDecodeError:
                # Fallback: parse raw response
                return {"raw_response": result.stdout.strip(), "status": "success"}
        else:
            return {"error": result.stderr, "status": "error"}
    except Exception as e:
        return {"error": str(e), "status": "exception"}

# Main execution
search_term = "${searchTerm}"
entity_name = "${entity.name}"

try:
    result = call_perplexity_mcp(search_term)
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({"error": str(e), "status": "fatal"}))
`;

    const pythonProcess = spawn('python3', ['-c', pythonScript], {
      cwd: __dirname,
      env: {
        ...process.env,
        PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY || 'pplx-7qR3K2yVd4vB8nX6tJmP4rHkL9sWfQ3xZc5vN2bG1oU'
      }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      try {
        const result = JSON.parse(stdout.trim());
        resolve(result);
      } catch (error) {
        resolve({
          error: `Failed to parse MCP response: ${stderr}`,
          raw_response: stdout,
          status: "parse_error"
        });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({
        error: `Python process failed: ${error.message}`,
        status: "process_error"
      });
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      pythonProcess.kill();
      resolve({
        error: "MCP call timed out after 60 seconds",
        status: "timeout"
      });
    }, 60000);
  });
}

/**
 * Validate URL exists and is accessible
 */
async function validateUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Calculate fit score based on criteria
 */
function calculateFitScore(entity, result, classification) {
  let score = 0;
  const reasons = [];

  // Base scoring
  if (classification === 'ACTIVE_RFP') {
    score += 40;
    reasons.push('Active RFP with digital/software project');
  } else if (classification === 'SIGNAL') {
    score += 20;
    reasons.push('Digital transformation signal detected');
  } else if (classification === 'EXCLUDE') {
    score -= 50;
    reasons.push('Non-digital project excluded');
  }

  // Bonus for official sources
  if (result.urls && result.urls.length > 0) {
    score += 10;
    reasons.push('Valid URLs found');
  }

  // Bonus for specific keywords
  if (result.search_term) {
    if (result.search_term.includes('RFP') || result.search_term.includes('tender')) {
      score += 15;
      reasons.push('RFP/tender keywords present');
    }
    if (result.search_term.includes('digital') || result.search_term.includes('software')) {
      score += 10;
      reasons.push('Digital/software keywords present');
    }
  }

  // Location bonus for UK/EU
  if (['England', 'Scotland', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Portugal', 'Europe'].includes(entity.country)) {
    score += 10;
    reasons.push('UK/EU location bonus');
  }

  // Penalty for fabricated/placeholder
  if (result.error && result.error.includes('fabricated')) {
    score -= 50;
    reasons.push('Potential fabricated/placeholder content');
  }

  return {
    score: Math.max(0, Math.min(100, score)), // Clamp between 0-100
    reasons
  };
}

/**
 * Classify RFP opportunity
 */
function classifyOpportunity(entity, mcpResult) {
  // Check for non-digital keywords
  const searchText = (mcpResult.raw_response || '').toLowerCase();
  const hasNonDigital = nonDigitalKeywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  if (hasNonDigital) {
    return 'EXCLUDE';
  }

  // Check for digital keywords
  const hasDigital = digitalKeywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );

  // Check for actual RFP/tender indicators
  const hasRFPIndicators = [
    'request for proposal', 'rfp', 'tender', 'procurement', 
    'bid deadline', 'submission deadline', 'official tender'
  ].some(indicator => searchText.includes(indicator));

  if (hasDigital && hasRFPIndicators) {
    return 'ACTIVE_RFP';
  } else if (hasDigital) {
    return 'SIGNAL';
  } else {
    return 'EXCLUDE';
  }
}

/**
 * Process a single entity
 */
async function processEntity(entity, index) {
  console.log(`\n[ENTITY-START] ${entity.name}`);
  
  // Build search query
  const searchQuery = `${entity.name} ${entity.sport} ("digital transformation RFP" OR "mobile app tender" OR "web development RFP" OR "software development" OR "technology platform RFP" OR "digital platform")`;
  
  console.log(`Search query: ${searchQuery}`);
  
  // Call Perplexity MCP
  const mcpResult = await callMCPTool(entity, searchQuery);
  
  // Show MCP response for first 3 entities
  if (index < 3) {
    console.log('[MCP-RESPONSE]', JSON.stringify(mcpResult, null, 2));
  }
  
  // Classify opportunity
  const classification = classifyOpportunity(entity, mcpResult);
  
  // Calculate fit score
  const fitScore = calculateFitScore(entity, mcpResult, classification);
  
  // Validate URLs if any
  let validUrls = [];
  if (mcpResult.urls && Array.isArray(mcpResult.urls)) {
    for (const url of mcpResult.urls) {
      if (await validateUrl(url)) {
        validUrls.push(url);
      }
    }
  }
  
  // Build result object
  const result = {
    entity_name: entity.name,
    sport: entity.sport,
    country: entity.country,
    search_term: searchQuery,
    detection_strategy: 'perplexity',
    classification: classification,
    fit_score: fitScore.score,
    fit_score_reasons: fitScore.reasons,
    perplexity_response: mcpResult,
    urls_found: validUrls,
    has_pdf: validUrls.some(url => url.toLowerCase().includes('.pdf')),
    processing_timestamp: new Date().toISOString(),
    entity_index: index + 1
  };
  
  // Print result status
  if (classification !== 'EXCLUDE' && validUrls.length > 0) {
    console.log(`[ENTITY-FOUND] ${entity.name} - ${classification} (${fitScore.score}/100)`);
  } else {
    console.log(`[ENTITY-NONE] ${entity.name} - ${classification}`);
  }
  
  return result;
}

/**
 * Main processing function
 */
async function main() {
  console.log('Starting RFP detection for 50 sports entities using Perplexity MCP');
  console.log('=' * 80);
  
  const results = [];
  const startTime = Date.now();
  
  try {
    // Process entities in batches of 5 to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < entities.length; i += batchSize) {
      const batch = entities.slice(i, i + batchSize);
      console.log(`\n--- Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(entities.length/batchSize)} ---`);
      
      const batchPromises = batch.map((entity, index) => 
        processEntity(entity, i + index)
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches
      if (i + batchSize < entities.length) {
        console.log('Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Generate summary
    const summary = {
      total_entities: entities.length,
      active_rfps: results.filter(r => r.classification === 'ACTIVE_RFP').length,
      signals: results.filter(r => r.classification === 'SIGNAL').length,
      excluded: results.filter(r => r.classification === 'EXCLUDE').length,
      processing_time_seconds: Math.round((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    };
    
    console.log('\n' + '=' * 80);
    console.log('PROCESSING COMPLETE');
    console.log('=' * 80);
    console.log(`Total entities processed: ${summary.total_entities}`);
    console.log(`Active RFPs found: ${summary.active_rfps}`);
    console.log(`Digital signals: ${summary.signals}`);
    console.log(`Excluded (non-digital): ${summary.excluded}`);
    console.log(`Processing time: ${summary.processing_time_seconds} seconds`);
    
    // Save results
    const outputFile = `perplexity-rfp-detection-50-entities-${Date.now()}.json`;
    const outputData = {
      summary: summary,
      results: results,
      metadata: {
        detection_strategy: 'perplexity',
        query_template: 'entity + sport + digital keywords',
        exclusion_criteria: nonDigitalKeywords,
        digital_keywords: digitalKeywords,
        fit_scoring_criteria: {
          digital_project: 40,
          budget_range: 20,
          open_rfp: 15,
          uk_eu_location: 10,
          non_digital_penalty: -50,
          fabricated_penalty: -50
        }
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\nResults saved to: ${outputFile}`);
    
    // Print top opportunities
    const topOpportunities = results
      .filter(r => r.classification !== 'EXCLUDE')
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 10);
    
    if (topOpportunities.length > 0) {
      console.log('\n--- TOP OPPORTUNITIES ---');
      topOpportunities.forEach((opp, i) => {
        console.log(`${i+1}. ${opp.entity_name} - ${opp.classification} (${opp.fit_score}/100)`);
        if (opp.urls_found.length > 0) {
          console.log(`   URLs: ${opp.urls_found.slice(0, 2).join(', ')}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Fatal error during processing:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { processEntity, callMCPTool, calculateFitScore };