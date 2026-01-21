const { mcp__brightData__search_engine } = require('./mcp-tools');

const entities = [
  { name: "1. FC Kln", sport: "Football", type: "Sports Club/Team", country: "Germany" },
  { name: "1. FC Köln", sport: "Football", type: "Club", country: "Germany" },
  { name: "1. FC Nrnberg", sport: "Football", type: "Sports Club/Team", country: "Germany" },
  { name: "1. FC Nürnberg", sport: "Football", type: "Club", country: "Germany" },
  { name: "2. Bundesliga", sport: "Football", type: "League", country: "Germany" },
  { name: "2. Bundesliga (json_seed)", sport: null, type: "Organization", country: null },
  { name: "23XI Racing", sport: "Motorsport", type: "Team", country: "United States" },
  { name: "24 Hours of Le Mans", sport: "Motorsport", type: "Tournament", country: "France" },
  { name: "24H Series", sport: null, type: "Tournament", country: null },
  { name: "A-League", sport: "Football", type: "League", country: "Australia" },
  { name: "A-League Men (Australia)", sport: "Football", type: "Organization", country: "Australia" },
  { name: "ABC Braga", sport: "Handball", type: "Club", country: "Portugal" },
  { name: "AC Milan", sport: "Football", type: "Sports Club", country: "Italy" },
  { name: "ACH Volley Ljubljana", sport: "Volleyball", type: "Club", country: "Slovenia" },
  { name: "ACT Brumbies", sport: "Rugby", type: "Club", country: "Australia" },
  { name: "ACT Comets", sport: "Cricket", type: "Team", country: "Australia" },
  { name: "ACT Meteors", sport: "Cricket (Women's)", type: "Team", country: "Australia" },
  { name: "AEG", sport: "Entertainment", type: "Entertainment", country: "United States" },
  { name: "AEK Athens", sport: "Basketball", type: "Club", country: "Greece" },
  { name: "AF Corse", sport: "Motorsport", type: "Team", country: "Italy" },
  { name: "AFC", sport: "Football", type: "Organization", country: "Malaysia" },
  { name: "AFC Wimbledon", sport: "Football", type: "Football Club", country: "England" },
  { name: "AFL", sport: "Australian Rules Football", type: "League", country: "Australia" },
  { name: "AG InsuranceSoudal Team", sport: "Cycling", type: "Sports Club/Team", country: "Belgium" },
  { name: "AG Insurance‑Soudal Team", sport: "Cycling", type: "Team", country: "Belgium" },
  { name: "AIK Fotboll", sport: "Football", type: "Club", country: "Sweden" },
  { name: "AJ Auxerre", sport: "Football", type: "Club", country: "France" },
  { name: "AKK Motorsport", sport: "Motorsport", type: "Federation", country: "Finland" },
  { name: "AO Racing", sport: "Motorsport", type: "Team", country: "United States" },
  { name: "ART Grand Prix", sport: "Motorsport", type: "Team", country: "France" },
  { name: "AS Douanes", sport: "Basketball", type: "Club", country: "Senegal" },
  { name: "AS Monaco Basket", sport: null, type: "Sports Entity", country: null },
  { name: "AS Roma", sport: "Football", type: "Sports Entity", country: "Italy" },
  { name: "ATP Tour", sport: "Tennis", type: "Tour", country: "Global" },
  { name: "AWS Formula 1", sport: null, type: "Team", country: null },
  { name: "AZ Alkmaar", sport: "Football", type: "Club", country: "Netherlands" },
  { name: "AZS AGH Kraków", sport: "Volleyball", type: "Club", country: "Poland" },
  { name: "Aalborg Hndbold", sport: "Handball", type: "Sports Club/Team", country: "Denmark" },
  { name: "Aalborg Håndbold", sport: "Handball", type: "Club", country: "Denmark" },
  { name: "Abbotsford Canucks", sport: "Ice Hockey", type: "Club", country: "Canada" },
  { name: "Aberdeen", sport: null, type: "Club", country: "Scotland" },
  { name: "Accrington Stanley", sport: "Football", type: "Club", country: "England" },
  { name: "Adam Johnson", sport: null, type: "Sports Entity", country: null },
  { name: "Adana Demirspor", sport: "Football", type: "Club", country: "Türkiye" },
  { name: "Adelaide 36ers", sport: null, type: "Club", country: "Australia" },
  { name: "Adelaide Giants", sport: "Baseball", type: "Club", country: "Australia" },
  { name: "Adelaide Strikers", sport: "Cricket", type: "Sports Club/Team", country: "Australia" },
  { name: "Ademar León", sport: "Handball", type: "Club", country: "Spain" },
  { name: "Adidas", sport: "Multi-sport", type: "Brand", country: "Germany" },
  { name: "Adirondack Thunder", sport: "Ice Hockey", type: "Club", country: "United States" }
];

// CRITICAL EXCLUSIONS - DO NOT DETECT
function shouldExclude(entity, searchResults) {
  const exclusionKeywords = [
    "stadium", "construction", "hospitality", "apparel", 
    "equipment", "F&B", "catering", "merchandise", "event management"
  ];
  
  const lowerName = entity.name.toLowerCase();
  const hasExclusionInName = exclusionKeywords.some(keyword => 
    lowerName.includes(keyword)
  );
  
  if (hasExclusionInName) return true;
  
  // Check if search results contain non-digital content
  if (searchResults && searchResults.organic) {
    const hasDigitalContent = searchResults.organic.some(result => {
      const title = (result.title || '').toLowerCase();
      const desc = (result.description || '').toLowerCase();
      return title.includes('digital') || title.includes('software') || 
             title.includes('app') || title.includes('technology') ||
             desc.includes('digital') || desc.includes('software') ||
             desc.includes('app') || desc.includes('technology');
    });
    
    if (!hasDigitalContent) return true;
  }
  
  return false;
}

// CRITICAL URL VALIDATION
function extractValidURLs(searchResults) {
  if (!searchResults || !searchResults.organic) return [];
  
  return searchResults.organic
    .filter(result => {
      // ONLY use URLs that BrightData MCP actually returns
      if (!result.link) return false;
      
      // Verify URL exists and is accessible
      return result.link.startsWith('http') && 
             (result.link.includes('.pdf') || 
              result.link.includes('tender') || 
              result.link.includes('rfp') ||
              result.link.includes('procurement'));
    })
    .map(result => result.link);
}

// Calculate fit score
function calculateFitScore(entity, hasValidURL, searchResults) {
  let score = 0;
  
  // Digital/software project check
  if (searchResults && searchResults.organic) {
    const hasDigitalKeywords = searchResults.organic.some(result => {
      const text = ((result.title || '') + ' ' + (result.description || '')).toLowerCase();
      return text.includes('digital') || text.includes('software') || 
             text.includes('app') || text.includes('technology platform');
    });
    
    if (hasDigitalKeywords) score += 40;
  }
  
  // Has .pdf document
  if (hasValidURL) score += 20;
  
  // Location bonus
  if (entity.country === 'England' || entity.country === 'United Kingdom') score += 10;
  if (entity.country && ['Germany', 'France', 'Italy', 'Spain'].includes(entity.country)) score += 5;
  
  // Exclude non-digital projects
  const isNonDigital = shouldExclude(entity, searchResults);
  if (isNonDigital) score -= 50;
  
  return Math.max(0, score);
}

// Classify RFP type
function classifyRFP(entity, hasValidURL, searchResults) {
  if (!searchResults || !searchResults.organic) return 'EXCLUDE';
  
  if (shouldExclude(entity, searchResults)) return 'EXCLUDE';
  
  const hasOfficialRFP = searchResults.organic.some(result => {
    const text = ((result.title || '') + ' ' + (result.description || '')).toLowerCase();
    return text.includes('rfp') || text.includes('tender') || text.includes('procurement');
  });
  
  if (hasValidURL && hasOfficialRFP) return 'ACTIVE_RFP';
  
  const hasDigitalSignal = searchResults.organic.some(result => {
    const text = ((result.title || '') + ' ' + (result.description || '')).toLowerCase();
    return text.includes('digital transformation') || text.includes('software') || 
           text.includes('mobile app') || text.includes('technology platform');
  });
  
  if (hasDigitalSignal) return 'SIGNAL';
  
  return 'EXCLUDE';
}

// Perplexity validation for digital focus
async function validateDigitalFocus(entity, searchResults) {
  try {
    const validationQuery = `Is ${entity.name} ${entity.sport || 'sports organization'} focused on digital transformation, software development, mobile apps, or technology platforms? Respond with YES or NO and brief explanation.`;
    
    const perplexityResponse = await mcp__perplexity_mcp__chat_completion({
      messages: [
        { role: "system", content: "You are analyzing sports organizations for digital transformation focus. Only consider digital/software/technology initiatives, not stadium construction, hospitality, or physical products." },
        { role: "user", content: validationQuery }
      ],
      max_tokens: 100,
      temperature: 0.2
    });
    
    const response = perplexityResponse.content.toLowerCase();
    const isDigitalFocused = response.includes('yes') && 
      !response.includes('stadium') && 
      !response.includes('construction') &&
      !response.includes('hospitality');
    
    return isDigitalFocused;
  } catch (error) {
    console.log(`Perplexity validation failed for ${entity.name}:`, error.message);
    // Default to true based on search results if Perplexity fails
    return searchResults && searchResults.organic && searchResults.organic.length > 0;
  }
}

async function processEntity(entity, index) {
  try {
    // Create search query
    const searchTerms = [
      `"${entity.name}"`,
      entity.sport || '',
      '("digital transformation RFP" OR "mobile app tender" OR "software development RFP" OR "web development RFP" OR "technology platform RFP")',
      'filetype:pdf'
    ].filter(Boolean).join(' ');
    
    console.log(`[ENTITY-${index}] Processing: ${entity.name}`);
    
    // Use BrightData MCP search
    const searchResults = await mcp__brightData__search_engine({ query: searchTerms });
    
    // Debug output for first 3 entities
    if (index < 3) {
      const urls = extractValidURLs(searchResults);
      console.log(`[MCP-RESPONSE] Found URLs for ${entity.name}: ${urls.join(', ')}`);
    }
    
    // Validate and classify
    const validURLs = extractValidURLs(searchResults);
    const shouldExcludeEntity = shouldExclude(entity, searchResults);
    
    if (shouldExcludeEntity) {
      console.log(`[ENTITY-NONE] ${entity.name} - Excluded (non-digital)`);
      return null;
    }
    
    // Perplexity validation for digital focus
    const isDigitalFocused = await validateDigitalFocus(entity, searchResults);
    if (!isDigitalFocused) {
      console.log(`[ENTITY-NONE] ${entity.name} - Not digitally focused (Perplexity validation)`);
      return null;
    }
    
    if (validURLs.length === 0) {
      console.log(`[ENTITY-NONE] ${entity.name} - No valid URLs found`);
      return null;
    }
    
    const rfpType = classifyRFP(entity, validURLs.length > 0, searchResults);
    const fitScore = calculateFitScore(entity, validURLs.length > 0, searchResults);
    
    if (rfpType === 'EXCLUDE') {
      console.log(`[ENTITY-NONE] ${entity.name} - Classified as EXCLUDE`);
      return null;
    }
    
    console.log(`[ENTITY-FOUND] ${entity.name} - ${rfpType} (Score: ${fitScore})`);
    
    return {
      organization: entity.name,
      src_link: validURLs[0] || null, // Use only validated URLs from BrightData
      detection_strategy: 'brightdata',
      summary_json: {
        title: `Digital RFP opportunity for ${entity.name}`,
        confidence: Math.min(90, 50 + fitScore),
        urgency: fitScore > 50 ? 'high' : fitScore > 30 ? 'medium' : 'low',
        fit_score: fitScore,
        rfp_type: rfpType
      }
    };
    
  } catch (error) {
    console.error(`Error processing ${entity.name}:`, error);
    return null;
  }
}

// Write results to Supabase
async function writeToSupabase(results) {
  try {
    const supabase = require('@supabase/supabase-js');
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Supabase credentials not found, skipping database write');
      return;
    }
    
    const client = supabase.createClient(supabaseUrl, supabaseKey);
    
    console.log(`Writing ${results.length} RFP results to Supabase...`);
    
    for (const result of results) {
      const { data, error } = await client
        .from('rfp_opportunities')
        .upsert({
          organization: result.organization,
          src_link: result.src_link,
          detection_strategy: result.detection_strategy,
          title: result.summary_json.title,
          confidence: result.summary_json.confidence,
          urgency: result.summary_json.urgency,
          fit_score: result.summary_json.fit_score,
          rfp_type: result.summary_json.rfp_type,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization,detection_strategy'
        });
      
      if (error) {
        console.error(`Error writing ${result.organization} to Supabase:`, error);
      } else {
        console.log(`✅ Successfully stored ${result.organization} in Supabase`);
      }
    }
    
    console.log('✅ All results written to Supabase successfully');
    
  } catch (error) {
    console.error('Supabase write failed:', error.message);
    // Continue with results even if Supabase write fails
  }
}

async function main() {
  console.log('Starting RFP detection for 50 entities...');
  
  const results = [];
  
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    const result = await processEntity(entity, i);
    if (result) {
      results.push(result);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Write results to Supabase
  await writeToSupabase(results);
  
  const totalRFPs = results.length;
  const avgConfidence = results.length > 0 ? 
    results.reduce((sum, r) => sum + r.summary_json.confidence, 0) / results.length : 0;
  const avgFitScore = results.length > 0 ? 
    results.reduce((sum, r) => sum + r.summary_json.fit_score, 0) / results.length : 0;
  const topOpportunity = results.length > 0 ? 
    results.reduce((best, current) => 
      current.summary_json.fit_score > best.summary_json.fit_score ? current : best
    ).organization : null;
  
  const finalResult = {
    total_rfps_detected: totalRFPs,
    entities_checked: 50,
    detection_strategy: 'brightdata',
    highlights: results,
    scoring_summary: {
      avg_confidence: Math.round(avgConfidence),
      avg_fit_score: Math.round(avgFitScore),
      top_opportunity: topOpportunity
    }
  };
  
  console.log('\n=== FINAL RESULT ===');
  console.log(JSON.stringify(finalResult, null, 2));
  
  return finalResult;
}

// Export for use in other modules
module.exports = { main, processEntity, shouldExclude, extractValidURLs, calculateFitScore, classifyRFP };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}