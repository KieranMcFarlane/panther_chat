#!/usr/bin/env node

/**
 * RFP Detection for 50 Sports Entities from Neo4j
 * Uses Perplexity API for RFP detection with proper URL validation
 */

const https = require('https');
const fs = require('fs');

// 50 entities from Neo4j query (SKIP 350 LIMIT 50)
const entities = [
  { name: "MKS Będzin", sport: "Volleyball", country: "Poland" },
  { name: "Eastern Province", sport: "Cricket", country: "South Africa" },
  { name: "Aguada", sport: "Basketball", country: "Uruguay" },
  { name: "Marcq-en-Baroeul", sport: "Rugby", country: "France" },
  { name: "Parma Perm", sport: "Basketball", country: "Russia" },
  { name: "Handebol Londrina", sport: "Handball", country: "Brazil" },
  { name: "Bahçeşehir Koleji", sport: "Basketball", country: "Türkiye" },
  { name: "Wolfdogs Nagoya", sport: "Volleyball", country: "Japan" },
  { name: "Al Ahli", sport: "Football", country: "Saudi Arabia" },
  { name: "Indianapolis Indians", sport: "Baseball", country: "United States" },
  { name: "Mitteldeutscher BC", sport: "Basketball", country: "Germany" },
  { name: "Montpellier Hérault Rugby", sport: "Rugby", country: "France" },
  { name: "Idaho Steelheads", sport: "Ice Hockey", country: "United States" },
  { name: "FC Porto Handball", sport: "Handball", country: "Portugal" },
  { name: "Halkbank Ankara", sport: "Volleyball", country: "Turkey" },
  { name: "Esperance de Tunis", sport: "Football", country: "Tunisia" },
  { name: "RK Vojvodina", sport: "Handball", country: "Serbia" },
  { name: "New Jersey Devils", sport: "Ice Hockey", country: "United States" },
  { name: "Club Atlético Goes", sport: "Basketball", country: "Uruguay" },
  { name: "Al Ettifaq", sport: "Football", country: "Saudi Arabia" },
  { name: "Ottawa Senators", sport: "Ice Hockey", country: "Canada" },
  { name: "Miami Marlins", sport: "Baseball", country: "United States" },
  { name: "VfB Stuttgart", sport: "Football", country: "Germany" },
  { name: "Estoril Praia", sport: "Football", country: "Portugal" },
  { name: "Old Glory DC", sport: "Rugby", country: "United States" },
  { name: "GOG Håndbold", sport: "Handball", country: "Denmark" },
  { name: "Nizhny Novgorod", sport: "Basketball", country: "Russia" },
  { name: "Galle Cricket Club", sport: "Cricket", country: "Sri Lanka" },
  { name: "Lavrio BC", sport: "Basketball", country: "Greece" },
  { name: "Jersey Reds", sport: "Rugby", country: "Jersey" },
  { name: "Connacht", sport: "Rugby", country: "Ireland" },
  { name: "RK Celje Pivovarna Laško", sport: "Handball", country: "Slovenia" },
  { name: "PEC Zwolle", sport: "Football", country: "Netherlands" },
  { name: "Internacional", sport: "Football", country: "Brazil" },
  { name: "Toshiba Brave Lupus", sport: "Rugby", country: "Japan" },
  { name: "Al Wahda Damascus", sport: "Basketball", country: "Syria" },
  { name: "Antalyaspor", sport: "Football", country: "Türkiye" },
  { name: "Los Angeles Angels", sport: "Baseball", country: "United States" },
  { name: "Tatabánya KC", sport: "Handball", country: "Hungary" },
  { name: "Nottingham Rugby", sport: "Rugby", country: "England" },
  { name: "Real Sociedad", sport: "Football", country: "Spain" },
  { name: "Dragons RFC", sport: "Rugby", country: "Wales" },
  { name: "Jiangsu Dragons", sport: "Basketball", country: "China" },
  { name: "Ricoh Black Rams", sport: "Rugby", country: "Japan" },
  { name: "FC Copenhagen", sport: "Football", country: "Denmark" },
  { name: "Yokohama DeNA BayStars", sport: "Baseball", country: "Japan" },
  { name: "Islamabad United", sport: "Cricket", country: "Pakistan" },
  { name: "Indy Fuel", sport: "Ice Hockey", country: "United States" },
  { name: "Harlequins", sport: "Rugby", country: "England" },
  { name: "Unics Kazan", sport: "Basketball", country: "Russia" }
];

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY || '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';

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

IMPORTANT: Return ONLY real, verified URLs from actual search results. Do not fabricate or create placeholder URLs.
Exclude non-digital projects like stadium construction, hospitality, apparel, F&B, or event production.

If you find relevant opportunities, provide the actual URLs from search results. If no relevant RFPs are found, clearly state that.
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
                return url.includes('http') && !url.includes('example.com') && !url.includes('placeholder');
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
  if (['England', 'Scotland', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Portugal', 'Europe', 'Ireland', 'Wales', 'Jersey', 'Greece', 'Slovenia', 'Türkiye', 'Hungary', 'Poland'].includes(entity.country)) {
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
  console.log('Starting RFP detection for 50 sports entities from Neo4j using Perplexity API');
  console.log('================================================================================');
  
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
    
    console.log('\n================================================================================');
    console.log('PROCESSING COMPLETE');
    console.log('================================================================================');
    console.log(`Total entities processed: ${summary.total_entities}`);
    console.log(`Active RFPs found: ${summary.active_rfps}`);
    console.log(`Digital signals: ${summary.signals}`);
    console.log(`Excluded (non-digital): ${summary.excluded}`);
    console.log(`Processing errors: ${summary.errors}`);
    console.log(`Processing time: ${summary.processing_time_seconds} seconds`);
    
    // Save results
    const outputFile = `rfp-detection-results-50-entities-${Date.now()}.json`;
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
    
    // Return JSON format for final output
    const highlights = results
      .filter(r => r.classification !== 'EXCLUDE' && r.classification !== 'ERROR' && r.urls_found.length > 0)
      .map(r => ({
        organization: r.entity_name,
        src_link: r.urls_found[0] || null,
        detection_strategy: r.detection_strategy,
        summary_json: {
          title: `${r.classification}: Digital opportunity for ${r.entity_name}`,
          confidence: Math.min(95, r.fit_score + (r.has_pdf ? 10 : 0)),
          urgency: r.has_pdf ? 'high' : 'medium',
          fit_score: r.fit_score,
          rfp_type: r.classification
        }
      }));
    
    const finalResult = {
      total_rfps_detected: summary.active_rfps + summary.signals,
      entities_checked: 50,
      detection_strategy: 'perplexity',
      highlights: highlights,
      scoring_summary: {
        avg_confidence: highlights.length > 0 ? Math.round(highlights.reduce((sum, h) => sum + h.summary_json.confidence, 0) / highlights.length) : 0,
        avg_fit_score: highlights.length > 0 ? Math.round(highlights.reduce((sum, h) => sum + h.summary_json.fit_score, 0) / highlights.length) : 0,
        top_opportunity: highlights.length > 0 ? highlights[0].organization : 'None'
      }
    };
    
    console.log('\n\nFINAL RESULT FOR SUPABASE:');
    console.log(JSON.stringify(finalResult, null, 2));
    
    return finalResult;
    
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