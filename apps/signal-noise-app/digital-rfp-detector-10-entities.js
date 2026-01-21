#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Entities to process - South American football clubs
const entities = [
  "Olmedo",
  "Aucas", 
  "El Nacional",
  "Deportivo Cuenca",
  "Guaraní",
  "Club Aurora",
  "Bolívar",
  "The Strongest",
  "Jorge Wilstermann",
  "Blooming"
];

// Digital opportunity search queries
const digitalOpportunityQueries = [
  'digital transformation',
  'mobile app development', 
  'software development',
  'technology partnership',
  'innovation project',
  'digital platform',
  'app development',
  'website development',
  'technology solution',
  'digital services'
];

// Exclusion keywords - non-digital opportunities
const exclusionKeywords = [
  'stadium construction', 'hospitality', 'catering', 'apparel', 'kit', 'merchandise',
  'event management', 'ticketing', 'security', 'cleaning', 'maintenance', 'construction',
  'infrastructure', 'architectural', 'engineering', 'legal', 'accounting'
];

// Use BrightData MCP via fetch
async function searchWithBrightData(query) {
  try {
    // First try direct search
    const searchResponse = await fetch('https://api.brightdata.com/serp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: 'google_search',
        query: query,
        format: 'json'
      })
    });

    if (searchResponse.ok) {
      const data = await searchResponse.json();
      return data;
    } else {
      throw new Error(`BrightData API error: ${searchResponse.status}`);
    }
  } catch (error) {
    console.error(`BrightData search failed:`, error.message);
    return null;
  }
}

// Check if result contains digital opportunities and excludes non-digital
function filterDigitalOpportunities(results, entityName) {
  if (!results || !results.organic || !Array.isArray(results.organic)) {
    return { relevant: [], total: 0, digital_only: 0 };
  }

  const relevant = results.organic.filter(result => {
    const title = (result.title || '').toLowerCase();
    const description = (result.description || '').toLowerCase();
    const content = title + ' ' + description;
    
    // Check for exclusion keywords
    const hasExclusion = exclusionKeywords.some(keyword => 
      content.includes(keyword.toLowerCase())
    );
    
    // Check for digital opportunity indicators
    const hasDigitalIndicators = [
      'digital', 'software', 'app', 'mobile', 'web', 'technology', 
      'IT', 'development', 'platform', 'system', 'innovation', 'solution',
      'transformation', 'online', 'website', 'application'
    ].some(indicator => content.includes(indicator));
    
    // Include only if no exclusion keywords AND has digital indicators
    return !hasExclusion && hasDigitalIndicators;
  });

  return {
    relevant: relevant,
    total: results.organic.length,
    digital_only: relevant.length
  };
}

// Calculate scores based on findings
function calculateScores(digitalResults, rfpResults, partnershipResults) {
  let confidence = 0;
  let fitScore = 0;
  let signals = [];
  
  // Direct RFP mentions (highest weight)
  if (rfpResults.digital_only > 0) {
    confidence += 60;
    fitScore += 50;
    signals.push('Direct RFP opportunities detected');
  }
  
  // Digital opportunities (high weight)
  if (digitalResults.digital_only > 0) {
    confidence += 40;
    fitScore += 40;
    signals.push('Digital transformation opportunities');
  }
  
  // Partnership potential (medium weight)
  if (partnershipResults.digital_only > 0) {
    confidence += 30;
    fitScore += 30;
    signals.push('Technology partnership potential');
  }
  
  return {
    confidence: Math.min(confidence, 100),
    fitScore: Math.min(fitScore, 100),
    signals: signals
  };
}

// Extract URLs from results
function extractURLs(results, category) {
  if (!results || !results.relevant || !Array.isArray(results.relevant)) {
    return [];
  }
  
  return results.relevant.map(result => ({
    url: result.link,
    title: result.title || 'No title',
    description: result.description || '',
    category: category,
    source: 'Google Search'
  }));
}

// Process single entity
async function processEntity(entityName) {
  console.log(`🔍 Processing: ${entityName}`);
  
  const entityResults = {
    entity_name: entityName,
    searches: {},
    urls: [],
    scores: { confidence: 0, fitScore: 0, signals: [] },
    tag: 'EXCLUDE',
    processed_at: new Date().toISOString()
  };
  
  try {
    // Search 1: General digital opportunities
    console.log(`  📊 Searching for digital opportunities...`);
    const digitalQuery = `"${entityName}" football club digital transformation OR app development OR technology partnership`;
    const digitalResults = await searchWithBrightData(digitalQuery);
    
    if (digitalResults) {
      const filteredDigital = filterDigitalOpportunities(digitalResults, entityName);
      entityResults.searches.digital_opportunities = filteredDigital;
      entityResults.urls = entityResults.urls.concat(
        extractURLs({ relevant: filteredDigital.relevant }, 'Digital Opportunity')
      );
      console.log(`    Found ${filteredDigital.digital_only} digital opportunities out of ${filteredDigital.total} results`);
    }
    
    // Search 2: RFP/Tender specific
    console.log(`  📋 Searching for RFP/tender opportunities...`);
    const rfpQuery = `"${entityName}" RFP OR tender OR procurement OR "request for proposal" OR bid digital software`;
    const rfpResults = await searchWithBrightData(rfpQuery);
    
    if (rfpResults) {
      const filteredRFP = filterDigitalOpportunities(rfpResults, entityName);
      entityResults.searches.rfp_opportunities = filteredRFP;
      entityResults.urls = entityResults.urls.concat(
        extractURLs({ relevant: filteredRFP.relevant }, 'RFP Opportunity')
      );
      console.log(`    Found ${filteredRFP.digital_only} RFP opportunities out of ${filteredRFP.total} results`);
    }
    
    // Search 3: Partnership potential
    console.log(`  🤝 Searching for partnership opportunities...`);
    const partnershipQuery = `"${entityName}" football club technology partnership OR digital partner OR software collaboration`;
    const partnershipResults = await searchWithBrightData(partnershipQuery);
    
    if (partnershipResults) {
      const filteredPartnership = filterDigitalOpportunities(partnershipResults, entityName);
      entityResults.searches.partnership_opportunities = filteredPartnership;
      entityResults.urls = entityResults.urls.concat(
        extractURLs({ relevant: filteredPartnership.relevant }, 'Partnership Opportunity')
      );
      console.log(`    Found ${filteredPartnership.digital_only} partnership opportunities out of ${filteredPartnership.total} results`);
    }
    
    // Calculate scores and determine tag
    entityResults.scores = calculateScores(
      entityResults.searches.digital_opportunities,
      entityResults.searches.rfp_opportunities,
      entityResults.searches.partnership_opportunities
    );
    
    // Determine classification
    const hasRFP = entityResults.searches.rfp_opportunities?.digital_only > 0;
    const hasDigital = entityResults.searches.digital_opportunities?.digital_only > 0;
    const hasPartnership = entityResults.searches.partnership_opportunities?.digital_only > 0;
    
    if (hasRFP) {
      entityResults.tag = 'ACTIVE_RFP';
      entityResults.rfp_type = 'direct_rfp';
      entityResults.urgency = 'high';
    } else if (hasDigital || hasPartnership) {
      entityResults.tag = 'SIGNAL';
      entityResults.rfp_type = hasDigital ? 'digital_opportunity' : 'partnership_signal';
      entityResults.urgency = 'medium';
    } else {
      entityResults.tag = 'EXCLUDE';
      entityResults.rfp_type = 'none';
      entityResults.urgency = 'low';
    }
    
    console.log(`  📊 Result: ${entityResults.tag} (Confidence: ${entityResults.scores.confidence}%, Fit: ${entityResults.scores.fitScore}%)`);
    console.log(`  💡 Signals: ${entityResults.scores.signals.join(', ') || 'None detected'}`);
    console.log(`  🔗 Total URLs: ${entityResults.urls.length}`);
    
    // Store in Supabase if not excluded
    if (entityResults.tag !== 'EXCLUDE') {
      const supabaseData = {
        entity_name: entityName,
        detection_strategy: 'brightdata_digital_search',
        tag: entityResults.tag,
        confidence_score: entityResults.scores.confidence,
        fit_score: entityResults.scores.fitScore,
        rfp_type: entityResults.rfp_type,
        urgency: entityResults.urgency,
        brightdata_results: {
          digital_opportunities: entityResults.searches.digital_opportunities,
          rfp_opportunities: entityResults.searches.rfp_opportunities,
          partnership_opportunities: entityResults.searches.partnership_opportunities
        },
        urls: entityResults.urls,
        signals: entityResults.scores.signals,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('rfp_detections')
        .insert([supabaseData]);

      if (error) {
        console.error(`    ❌ Supabase insert failed: ${error.message}`);
      } else {
        console.log(`    ✅ Saved to database`);
      }
    }
    
  } catch (error) {
    console.error(`    ❌ Error processing ${entityName}:`, error.message);
    entityResults.error = error.message;
    entityResults.tag = 'ERROR';
  }
  
  return entityResults;
}

// Main processing function
async function processAllEntities() {
  const results = {
    total_entities_processed: 0,
    total_rfps_detected: 0,
    total_signals_detected: 0,
    total_excluded: 0,
    total_errors: 0,
    entities: [],
    processing_summary: {
      digital_opportunities_found: 0,
      rfp_opportunities_found: 0,
      partnership_opportunities_found: 0
    }
  };

  console.log('🚀 Starting Digital RFP Detection for South American Football Clubs...\n');
  console.log('Focus: Digital transformation, mobile app development, technology partnerships\n');

  for (const entityName of entities) {
    const entityResult = await processEntity(entityName);
    
    results.total_entities_processed++;
    
    // Update counters
    if (entityResult.tag === 'ACTIVE_RFP') {
      results.total_rfps_detected++;
    } else if (entityResult.tag === 'SIGNAL') {
      results.total_signals_detected++;
    } else if (entityResult.tag === 'ERROR') {
      results.total_errors++;
    } else {
      results.total_excluded++;
    }
    
    // Update opportunity counters
    if (entityResult.searches.digital_opportunities?.digital_only > 0) {
      results.processing_summary.digital_opportunities_found++;
    }
    if (entityResult.searches.rfp_opportunities?.digital_only > 0) {
      results.processing_summary.rfp_opportunities_found++;
    }
    if (entityResult.searches.partnership_opportunities?.digital_only > 0) {
      results.processing_summary.partnership_opportunities_found++;
    }
    
    results.entities.push(entityResult);
    
    console.log(''); // Empty line for readability
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print final summary
  console.log('📋 Digital RFP Detection Summary:');
  console.log(`Total entities processed: ${results.total_entities_processed}`);
  console.log(`Active RFPs detected: ${results.total_rfps_detected}`);
  console.log(`Early signals detected: ${results.total_signals_detected}`);
  console.log(`Excluded (no digital opportunities): ${results.total_excluded}`);
  console.log(`Errors: ${results.total_errors}`);
  console.log(`\nOpportunity Summary:`);
  console.log(`- Digital opportunities found: ${results.processing_summary.digital_opportunities_found} entities`);
  console.log(`- RFP opportunities found: ${results.processing_summary.rfp_opportunities_found} entities`);
  console.log(`- Partnership opportunities found: ${results.processing_summary.partnership_opportunities_found} entities`);

  return results;
}

// Run the script
if (require.main === module) {
  processAllEntities()
    .then(results => {
      console.log('\n📊 Final Results:');
      console.log(JSON.stringify(results, null, 2));
      
      // Save results to file
      const fs = require('fs');
      fs.writeFileSync(
        `rfp-detection-results-${new Date().toISOString().split('T')[0]}.json`,
        JSON.stringify(results, null, 2)
      );
      console.log(`\n💾 Results saved to rfp-detection-results-${new Date().toISOString().split('T')[0]}.json`);
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processAllEntities };