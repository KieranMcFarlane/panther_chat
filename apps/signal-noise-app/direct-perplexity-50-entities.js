#!/usr/bin/env node

/**
 * Direct Perplexity RFP Detection for 50 Sports Entities
 * Uses direct HTTP calls to Perplexity API for RFP detection
 */

const https = require('https');
const fs = require('fs');

// 50 entities to process
const entities = [
  { name: "Manchester United FC", sport: "Football", country: "England" },
  { name: "Anaheim Ducks", sport: "Ice Hockey", country: "USA" },
  { name: "Arizona Diamondbacks", sport: "Baseball", country: "USA" },
  { name: "Dallas Mavericks", sport: "Basketball", country: "USA" },
  { name: "Golden State Warriors", sport: "Basketball", country: "USA" },
  { name: "Houston Astros", sport: "Baseball", country: "USA" },
  { name: "Los Angeles Lakers", sport: "Basketball", country: "USA" },
  { name: "Miami Heat", sport: "Basketball", country: "USA" },
  { name: "New England Patriots", sport: "Football", country: "USA" },
  { name: "New York Giants", sport: "Football", country: "USA" },
  { name: "San Antonio Spurs", sport: "Basketball", country: "USA" },
  { name: "Seattle Seahawks", sport: "Football", country: "USA" },
  { name: "Toronto Blue Jays", sport: "Baseball", country: "Canada" },
  { name: "Toronto Raptors", sport: "Basketball", country: "Canada" },
  { name: "Vancouver Canucks", sport: "Ice Hockey", country: "Canada" },
  { name: "NBA", sport: "Basketball", country: "USA" },
  { name: "WNBA", sport: "Basketball", country: "USA" },
  { name: "MLB", sport: "Baseball", country: "USA" },
  { name: "LaLiga", sport: "Football", country: "Spain" },
  { name: "Bundesliga", sport: "Football", country: "Germany" },
  { name: "Serie A", sport: "Football", country: "Italy" },
  { name: "Ligue 1", sport: "Football", country: "France" },
  { name: "Eredivisie", sport: "Football", country: "Netherlands" },
  { name: "Primeira Liga", sport: "Football", country: "Portugal" },
  { name: "Russian Premier League", sport: "Football", country: "Russia" },
  { name: "Ukrainian Premier League", sport: "Football", country: "Ukraine" },
  { name: "Turkish Süper Lig", sport: "Football", country: "Turkey" },
  { name: "Greek Super League", sport: "Football", country: "Greece" },
  { name: "Scottish Premiership", sport: "Football", country: "Scotland" },
  { name: "Belgian Pro League", sport: "Football", country: "Belgium" },
  { name: "Austrian Bundesliga", sport: "Football", country: "Austria" },
  { name: "Swiss Super League", sport: "Football", country: "Switzerland" },
  { name: "Danish Superliga", sport: "Football", country: "Denmark" },
  { name: "Norwegian Eliteserien", sport: "Football", country: "Norway" },
  { name: "Swedish Allsvenskan", sport: "Football", country: "Sweden" },
  { name: "Finnish Veikkausliiga", sport: "Football", country: "Finland" },
  { name: "CSL", sport: "Basketball", country: "China" },
  { name: "KBL", sport: "Basketball", country: "South Korea" },
  { name: "B.League", sport: "Basketball", country: "Japan" },
  { name: "NBL", sport: "Basketball", country: "Australia" },
  { name: "IPL", sport: "Cricket", country: "India" },
  { name: "The Hundred", sport: "Cricket", country: "England" },
  { name: "WPL", sport: "Cricket", country: "India" },
  { name: "BBL", sport: "Cricket", country: "Australia" },
  { name: "CPL", sport: "Cricket", country: "West Indies" },
  { name: "PSL", sport: "Cricket", country: "Pakistan" },
  { name: "EuroLeague", sport: "Basketball", country: "Europe" },
  { name: "EuroCup", sport: "Basketball", country: "Europe" },
  { name: "Basketball Champions League", sport: "Basketball", country: "Europe" },
  { name: "FIBA World Cup", sport: "Tournament", country: "International" }
];

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || 'pplx-7qR3K2yVd4vB8nX6tJmP4rHkL9sWfQ3xZc5vN2bG1oU';

/**
 * Make HTTP request to Perplexity API
 */
function callPerplexityAPI(searchQuery) {
  return new Promise((resolve) => {
    const url = 'https://api.perplexity.ai/chat/completions';
    
    const prompt = `Search for RFP (Request for Proposal) and tender opportunities related to: ${searchQuery}

Focus specifically on:
- Digital transformation projects
- Mobile app development tenders  
- Web development RFPs
- Software development opportunities
- Technology platform procurement
- Digital platform initiatives

IMPORTANT: Return ONLY real, verified URLs. Do not fabricate or create placeholder URLs.
Exclude non-digital projects like stadium construction, hospitality, apparel, F&B, or event production.

If you find relevant opportunities, provide the actual URLs. If no relevant RFPs are found, clearly state that.
Focus on active tenders, procurement notices, or official RFP documents.`;

    const payload = JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.choices && response.choices.length > 0) {
            const content = response.choices[0].message.content;
            
            // Extract URLs from the response
            const urlRegex = /https?:\/\/[^\s\)]+/g;
            const foundUrls = content.match(urlRegex) || [];
            
            // Validate URLs (basic check)
            const validUrls = foundUrls.filter(url => {
              try {
                new URL(url);
                return url.includes('http') && !url.includes('example.com');
              } catch {
                return false;
              }
            });

            resolve({
              status: 'success',
              content: content,
              urls: validUrls,
              search_query: searchQuery,
              timestamp: new Date().toISOString()
            });
          } else {
            resolve({
              status: 'no_content',
              error: 'No content in API response',
              search_query: searchQuery,
              raw_response: data
            });
          }
        } catch (error) {
          resolve({
            status: 'parse_error',
            error: `Failed to parse API response: ${error.message}`,
            search_query: searchQuery,
            raw_response: data
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        status: 'request_error',
        error: `Request failed: ${error.message}`,
        search_query: searchQuery
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        status: 'timeout',
        error: 'Request timed out after 30 seconds',
        search_query: searchQuery
      });
    });

    req.setTimeout(30000); // 30 second timeout
    req.write(payload);
    req.end();
  });
}

/**
 * Classify RFP opportunity based on content
 */
function classifyOpportunity(entity, perplexityResult) {
  const content = (perplexityResult.content || '').toLowerCase();
  const searchQuery = perplexityResult.search_query || '';
  
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
  
  // RFP/tender indicators
  const rfpIndicators = [
    'request for proposal', 'rfp', 'tender', 'procurement', 
    'bid deadline', 'submission deadline', 'official tender', 'procurement notice'
  ];

  // Check for non-digital content
  const hasNonDigital = nonDigitalKeywords.some(keyword => content.includes(keyword));
  if (hasNonDigital) {
    return 'EXCLUDE';
  }

  // Check for digital content
  const hasDigital = digitalKeywords.some(keyword => content.includes(keyword) || searchQuery.includes(keyword));
  const hasRFP = rfpIndicators.some(indicator => content.includes(indicator));
  const hasValidUrls = perplexityResult.urls && perplexityResult.urls.length > 0;

  // Classification logic
  if (hasDigital && hasRFP && hasValidUrls) {
    return 'ACTIVE_RFP';
  } else if (hasDigital && (hasRFP || hasValidUrls)) {
    return 'SIGNAL';
  } else {
    return 'EXCLUDE';
  }
}

/**
 * Calculate fit score
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

  // URL bonus
  if (result.urls && result.urls.length > 0) {
    score += 10;
    reasons.push(`${result.urls.length} valid URLs found`);
  }

  // Location bonus for UK/EU
  if (['England', 'Scotland', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Portugal', 'Europe'].includes(entity.country)) {
    score += 10;
    reasons.push('UK/EU location bonus');
  }

  // Content quality bonus
  if (result.content && result.content.length > 200) {
    score += 5;
    reasons.push('Detailed content found');
  }

  // Success status bonus
  if (result.status === 'success') {
    score += 5;
    reasons.push('Successful API response');
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons
  };
}

/**
 * Process a single entity
 */
async function processEntity(entity, index) {
  console.log(`\n[ENTITY-START] ${entity.name}`);
  
  // Build search query
  const searchQuery = `${entity.name} ${entity.sport} ("digital transformation RFP" OR "mobile app tender" OR "web development RFP" OR "software development" OR "technology platform RFP" OR "digital platform")`;
  
  console.log(`Search: ${searchQuery}`);
  
  // Call Perplexity API
  const perplexityResult = await callPerplexityAPI(searchQuery);
  
  // Show full response for first 3 entities
  if (index < 3) {
    console.log('[MCP-RESPONSE]');
    console.log('Status:', perplexityResult.status);
    console.log('Content:', perplexityResult.content || 'No content');
    console.log('URLs found:', perplexityResult.urls || []);
  }
  
  // Classify opportunity
  const classification = classifyOpportunity(entity, perplexityResult);
  
  // Calculate fit score
  const fitScore = calculateFitScore(entity, perplexityResult, classification);
  
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
    perplexity_response: perplexityResult,
    urls_found: perplexityResult.urls || [],
    has_pdf: (perplexityResult.urls || []).some(url => url.toLowerCase().includes('.pdf')),
    processing_timestamp: new Date().toISOString(),
    entity_index: index + 1
  };
  
  // Print result status
  if (classification !== 'EXCLUDE' && (perplexityResult.urls || []).length > 0) {
    console.log(`[ENTITY-FOUND] ${entity.name} - ${classification} (${fitScore.score}/100)`);
    if (perplexityResult.urls && perplexityResult.urls.length > 0) {
      console.log(`   URLs: ${perplexityResult.urls.slice(0, 2).join(', ')}`);
    }
  } else {
    console.log(`[ENTITY-NONE] ${entity.name} - ${classification}`);
  }
  
  return result;
}

/**
 * Main processing function
 */
async function main() {
  console.log('Starting RFP detection for 50 sports entities using Perplexity API');
  console.log('================================================================');
  
  const results = [];
  const startTime = Date.now();
  
  try {
    // Process entities with small delays to avoid rate limiting
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      try {
        const result = await processEntity(entity, i);
        results.push(result);
      } catch (error) {
        console.error(`Error processing ${entity.name}:`, error.message);
        results.push({
          entity_name: entity.name,
          sport: entity.sport,
          country: entity.country,
          detection_strategy: 'perplexity',
          classification: 'ERROR',
          fit_score: 0,
          fit_score_reasons: [`Processing error: ${error.message}`],
          perplexity_response: { error: error.message },
          urls_found: [],
          has_pdf: false,
          processing_timestamp: new Date().toISOString(),
          entity_index: i + 1
        });
      }
      
      // Small delay between requests (except for last one)
      if (i < entities.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Generate summary
    const summary = {
      total_entities: entities.length,
      active_rfps: results.filter(r => r.classification === 'ACTIVE_RFP').length,
      signals: results.filter(r => r.classification === 'SIGNAL').length,
      excluded: results.filter(r => r.classification === 'EXCLUDE').length,
      errors: results.filter(r => r.classification === 'ERROR').length,
      processing_time_seconds: Math.round((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString()
    };
    
    console.log('\n================================================================');
    console.log('PROCESSING COMPLETE');
    console.log('================================================================');
    console.log(`Total entities processed: ${summary.total_entities}`);
    console.log(`Active RFPs found: ${summary.active_rfps}`);
    console.log(`Digital signals: ${summary.signals}`);
    console.log(`Excluded (non-digital): ${summary.excluded}`);
    console.log(`Processing errors: ${summary.errors}`);
    console.log(`Processing time: ${summary.processing_time_seconds} seconds`);
    
    // Save results
    const outputFile = `perplexity-rfp-results-50-entities-${Date.now()}.json`;
    const outputData = {
      summary: summary,
      results: results,
      metadata: {
        detection_strategy: 'perplexity',
        api_model: 'llama-3.1-sonar-small-128k-online',
        query_template: 'entity + sport + digital RFP keywords',
        scoring_criteria: {
          active_rfp_digital: 40,
          signal_digital: 20,
          valid_urls: 10,
          uk_eu_location: 10,
          content_quality: 5,
          successful_response: 5,
          non_digital_penalty: -50
        }
      }
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(`\nResults saved to: ${outputFile}`);
    
    // Print top opportunities
    const topOpportunities = results
      .filter(r => r.classification !== 'EXCLUDE' && r.classification !== 'ERROR')
      .sort((a, b) => b.fit_score - a.fit_score)
      .slice(0, 10);
    
    if (topOpportunities.length > 0) {
      console.log('\n--- TOP OPPORTUNITIES ---');
      topOpportunities.forEach((opp, i) => {
        console.log(`${i+1}. ${opp.entity_name} (${opp.country}) - ${opp.classification} (${opp.fit_score}/100)`);
        if (opp.urls_found.length > 0) {
          console.log(`   URLs: ${opp.urls_found.slice(0, 2).join(', ')}`);
        }
      });
    } else {
      console.log('\n--- NO OPPORTUNITIES FOUND ---');
      console.log('No digital RFP opportunities detected in this batch.');
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

module.exports = { processEntity, callPerplexityAPI, calculateFitScore };