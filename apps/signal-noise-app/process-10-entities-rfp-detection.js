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

// RFP keyword search terms for digital opportunities
const rfpKeywords = [
  "RFP", "tender", "procurement", "bid", "proposal", "solicitation",
  "request for proposal", "invitation to bid", "ITB", "RFQ"
];

// Digital role keywords for early signals
const digitalRoleKeywords = [
  "digital manager", "product manager", "app development", "software development",
  "IT manager", "technology manager", "digital transformation", "innovation manager",
  "mobile app", "web development", "software engineer", "CTO", "head of technology"
];

// Partnership keywords
const partnershipKeywords = [
  "technology partnership", "digital partnership", "software partnership", 
  "app development partnership", "innovation partnership", "technology collaboration",
  "digital transformation partner", "mobile app partner"
];

// Exclusion keywords - non-digital opportunities to skip
const exclusionKeywords = [
  "stadium construction", "hospitality", "catering", "apparel", "kit", "merchandise",
  "event management", "ticketing", "security", "cleaning", "maintenance", "construction",
  "infrastructure", "architectural", "engineering", "consulting", "legal", "accounting"
];

// Phase 1: LinkedIn posts search for RFP keywords
async function searchLinkedInPosts(entityName) {
  try {
    const keywordQuery = rfpKeywords.join(' OR ');
    const searchQuery = `site:linkedin.com/company "${entityName}" (${keywordQuery})`;
    
    const response = await fetch('https://api.brightdata.com/serp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: 'linkedin_posts_monitor',
        query: searchQuery,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();
    return filterAndValidateResults(data, entityName, 'posts');
  } catch (error) {
    console.error(`Phase 1 failed for ${entityName}:`, error.message);
    return null;
  }
}

// Phase 2: LinkedIn jobs search for PM/digital roles
async function searchLinkedInJobs(entityName) {
  try {
    const roleQuery = digitalRoleKeywords.join(' OR ');
    const searchQuery = `site:linkedin.com/jobs "${entityName}" (${roleQuery})`;
    
    const response = await fetch('https://api.brightdata.com/serp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: 'google_search',
        query: searchQuery,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();
    return filterAndValidateResults(data, entityName, 'jobs');
  } catch (error) {
    console.error(`Phase 2 failed for ${entityName}:`, error.message);
    return null;
  }
}

// Phase 3: LinkedIn company search for partnerships
async function searchLinkedInPartnerships(entityName) {
  try {
    const partnershipQuery = partnershipKeywords.join(' OR ');
    const searchQuery = `site:linkedin.com/company "${entityName}" (${partnershipQuery})`;
    
    const response = await fetch('https://api.brightdata.com/serp', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.BRIGHTDATA_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        zone: 'linkedin_posts_monitor',
        query: searchQuery,
        format: 'json'
      })
    });

    if (!response.ok) {
      throw new Error(`BrightData API error: ${response.status}`);
    }

    const data = await response.json();
    return filterAndValidateResults(data, entityName, 'partnerships');
  } catch (error) {
    console.error(`Phase 3 failed for ${entityName}:`, error.message);
    return null;
  }
}

// Filter results based on exclusion rules
function filterAndValidateResults(data, entityName, phase) {
  if (!data || !data.results || !Array.isArray(data.results)) {
    return { ...data, filtered_results: [], exclusion_applied: true };
  }

  const filteredResults = data.results.filter(result => {
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
      'IT', 'development', 'platform', 'system', 'innovation'
    ].some(indicator => content.includes(indicator));
    
    // Include only if no exclusion keywords AND has digital indicators
    return !hasExclusion && hasDigitalIndicators;
  });

  return {
    ...data,
    filtered_results: filteredResults,
    original_count: data.results.length,
    filtered_count: filteredResults.length,
    exclusion_applied: true,
    phase: phase
  };
}

// Calculate confidence and fit scores based on 3-phase results
function calculateScores(phase1Results, phase2Results, phase3Results) {
  let confidence = 0;
  let fitScore = 0;
  let signals = [];
  
  // Phase 1: Direct RFP detection (highest weight)
  if (phase1Results && phase1Results.filtered_results && phase1Results.filtered_results.length > 0) {
    confidence += 50;
    fitScore += 40;
    signals.push('Direct RFP keywords found');
  }
  
  // Phase 2: Digital hiring signals (medium weight)
  if (phase2Results && phase2Results.filtered_results && phase2Results.filtered_results.length > 0) {
    confidence += 30;
    fitScore += 35;
    signals.push('Digital role hiring detected');
  }
  
  // Phase 3: Partnership opportunities (lower weight)
  if (phase3Results && phase3Results.filtered_results && phase3Results.filtered_results.length > 0) {
    confidence += 20;
    fitScore += 25;
    signals.push('Partnership opportunities identified');
  }
  
  return {
    confidence: Math.min(confidence, 100),
    fitScore: Math.min(fitScore, 100),
    signals: signals
  };
}

// Determine classification and tag
function classifyOpportunity(phase1Results, phase2Results, phase3Results, scores) {
  const hasDirectRFP = phase1Results && phase1Results.filtered_results && phase1Results.filtered_results.length > 0;
  const hasHiringSignals = phase2Results && phase2Results.filtered_results && phase2Results.filtered_results.length > 0;
  const hasPartnershipSignals = phase3Results && phase3Results.filtered_results && phase3Results.filtered_results.length > 0;
  
  let tag, rfpType, urgency;
  
  if (hasDirectRFP) {
    tag = 'ACTIVE_RFP';
    rfpType = 'direct_rfp';
    urgency = 'high';
  } else if (hasHiringSignals || hasPartnershipSignals) {
    tag = 'SIGNAL';
    rfpType = hasHiringSignals ? 'hiring_signal' : 'partnership_signal';
    urgency = 'medium';
  } else {
    tag = 'EXCLUDE';
    rfpType = 'none';
    urgency = 'low';
  }
  
  return { tag, rfpType, urgency };
}

// Extract URLs from search results
function extractURLs(phase1Results, phase2Results, phase3Results) {
  const urls = [];
  
  [phase1Results, phase2Results, phase3Results].forEach((phaseResults, index) => {
    const phaseName = ['Phase 1 (RFP Posts)', 'Phase 2 (Digital Jobs)', 'Phase 3 (Partnerships)'][index];
    
    if (phaseResults && phaseResults.filtered_results) {
      phaseResults.filtered_results.forEach(result => {
        if (result.link) {
          urls.push({
            url: result.link,
            title: result.title || 'No title',
            source: phaseName,
            type: 'search_result'
          });
        }
      });
    }
  });
  
  return urls;
}

// Main processing function
async function processEntitiesWith3PhaseStrategy() {
  const results = {
    total_entities_processed: 0,
    total_rfps_detected: 0,
    total_signals_detected: 0,
    total_excluded: 0,
    entities: [],
    processing_summary: {
      phase_1_success: 0,
      phase_2_success: 0,
      phase_3_success: 0
    }
  };

  console.log('🚀 Starting 3-Phase LinkedIn RFP Detection for South American Football Clubs...\n');

  for (const entityName of entities) {
    console.log(`🔍 Processing: ${entityName}`);
    
    try {
      // Phase 1: LinkedIn posts search for RFP keywords
      console.log(`  📋 Phase 1: Searching LinkedIn posts for RFP keywords...`);
      const phase1Results = await searchLinkedInPosts(entityName);
      if (phase1Results) results.processing_summary.phase_1_success++;
      
      // Phase 2: LinkedIn jobs search for PM/digital roles
      console.log(`  💼 Phase 2: Searching LinkedIn jobs for digital roles...`);
      const phase2Results = await searchLinkedInJobs(entityName);
      if (phase2Results) results.processing_summary.phase_2_success++;
      
      // Phase 3: LinkedIn company search for partnerships
      console.log(`  🤝 Phase 3: Searching LinkedIn for partnership opportunities...`);
      const phase3Results = await searchLinkedInPartnerships(entityName);
      if (phase3Results) results.processing_summary.phase_3_success++;
      
      // Calculate scores
      const scores = calculateScores(phase1Results, phase2Results, phase3Results);
      
      // Classify opportunity
      const classification = classifyOpportunity(phase1Results, phase2Results, phase3Results, scores);
      
      // Extract URLs
      const urls = extractURLs(phase1Results, phase2Results, phase3Results);
      
      // Create entity result
      const entityResult = {
        entity_name: entityName,
        tag: classification.tag,
        confidence_score: scores.confidence,
        fit_score: scores.fitScore,
        rfp_type: classification.rfpType,
        urgency: classification.urgency,
        signals: scores.signals,
        urls: urls,
        phase_results: {
          phase_1: {
            success: !!phase1Results,
            results_found: phase1Results?.filtered_results?.length || 0,
            original_results: phase1Results?.original_count || 0
          },
          phase_2: {
            success: !!phase2Results,
            results_found: phase2Results?.filtered_results?.length || 0,
            original_results: phase2Results?.original_count || 0
          },
          phase_3: {
            success: !!phase3Results,
            results_found: phase3Results?.filtered_results?.length || 0,
            original_results: phase3Results?.original_count || 0
          }
        },
        processed_at: new Date().toISOString()
      };
      
      // Update counters
      results.total_entities_processed++;
      if (classification.tag === 'ACTIVE_RFP') {
        results.total_rfps_detected++;
      } else if (classification.tag === 'SIGNAL') {
        results.total_signals_detected++;
      } else {
        results.total_excluded++;
      }
      
      // Store in Supabase if not excluded
      if (classification.tag !== 'EXCLUDE') {
        const supabaseData = {
          entity_name: entityName,
          detection_strategy: 'linkedin_3phase',
          tag: classification.tag,
          confidence_score: scores.confidence,
          fit_score: scores.fitScore,
          rfp_type: classification.rfpType,
          urgency: classification.urgency,
          brightdata_results: {
            phase_1: phase1Results,
            phase_2: phase2Results,
            phase_3: phase3Results
          },
          urls: urls,
          signals: scores.signals,
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
      
      results.entities.push(entityResult);
      
      // Print result summary
      console.log(`  📊 Result: ${classification.tag} (Confidence: ${scores.confidence}%, Fit: ${scores.fitScore}%)`);
      if (urls.length > 0) {
        console.log(`  🔗 URLs found: ${urls.length}`);
        urls.slice(0, 2).forEach(urlObj => {
          console.log(`     - ${urlObj.title} (${urlObj.source})`);
        });
      }
      console.log(`  💡 Signals: ${scores.signals.join(', ') || 'None detected'}`);
      
    } catch (error) {
      console.error(`    ❌ Error processing ${entityName}:`, error.message);
      
      results.entities.push({
        entity_name: entityName,
        tag: 'ERROR',
        confidence_score: 0,
        fit_score: 0,
        error: error.message,
        processed_at: new Date().toISOString()
      });
    }
    
    console.log(''); // Empty line for readability
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // Print final summary
  console.log('📋 3-Phase LinkedIn RFP Detection Summary:');
  console.log(`Total entities processed: ${results.total_entities_processed}`);
  console.log(`Active RFPs detected: ${results.total_rfps_detected}`);
  console.log(`Early signals detected: ${results.total_signals_detected}`);
  console.log(`Excluded (non-digital): ${results.total_excluded}`);
  console.log(`Phase success rates - Posts: ${results.processing_summary.phase_1_success}/10, Jobs: ${results.processing_summary.phase_2_success}/10, Partnerships: ${results.processing_summary.phase_3_success}/10`);

  return results;
}

// Run the script
if (require.main === module) {
  processEntitiesWith3PhaseStrategy()
    .then(results => {
      console.log('\n📊 Final Results:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processEntitiesWith3PhaseStrategy };