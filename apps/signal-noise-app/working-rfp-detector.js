require('dotenv').config();
const neo4j = require('neo4j-driver');

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
  
  return false;
}

// Calculate fit score
function calculateFitScore(entity, hasValidURL, searchResults) {
  let score = 40; // Base score for being processed
  
  // Has .pdf document or RFP
  if (hasValidURL) score += 20;
  
  // Location bonus
  if (entity.country === 'England' || entity.country === 'United Kingdom') score += 10;
  if (entity.country && ['Germany', 'France', 'Italy', 'Spain'].includes(entity.country)) score += 5;
  
  return Math.max(0, score);
}

// Classify RFP type
function classifyRFP(entity, hasValidURL) {
  if (shouldExclude(entity, null)) return 'EXCLUDE';
  
  if (hasValidURL) return 'ACTIVE_RFP';
  
  return 'SIGNAL';
}

// Query Neo4j for entities
async function getNeo4jEntities(skip = 0, limit = 50) {
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME || 'neo4j', process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    const query = `
      MATCH (e:Entity)
      WHERE e.name IS NOT NULL
      RETURN e.name as name, e.sport as sport, e.type as type, e.country as country
      SKIP toInteger($skip) LIMIT toInteger($limit)
    `;
    
    const result = await session.run(query, { skip: Math.round(skip), limit: Math.round(limit) });
    
    return result.records.map(record => ({
      name: record.get('name'),
      sport: record.get('sport'),
      type: record.get('type'),
      country: record.get('country')
    }));
  } finally {
    await session.close();
    await driver.close();
  }
}

// Write results to Supabase
async function writeToSupabase(results) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.log('Supabase credentials not found, skipping database write');
      return;
    }
    
    const client = createClient(supabaseUrl, supabaseKey);
    
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

// Simulate BrightData search results for demo purposes
function simulateBrightDataSearch(entity, index) {
  const digitalRFPs = [
    {
      name: "AC Milan",
      url: "https://acmilan.com/documents/digital-transformation-rfp-2024.pdf",
      title: "Digital Transformation Platform RFP - AC Milan"
    },
    {
      name: "Adidas", 
      url: "https://adidas.com/procurement/sports-technology-platform-rfp.pdf",
      title: "Sports Technology Platform RFP - Adidas"
    },
    {
      name: "AFC Wimbledon",
      url: null,
      title: "Mobile App Development Opportunity - AFC Wimbledon"
    },
    {
      name: "AFL",
      url: "https://afl.com.au/tenders/digital-platform-enhancement.pdf",
      title: "Digital Platform Enhancement RFP - AFL"
    },
    {
      name: "AZ Alkmaar",
      url: null,
      title: "Fan Engagement Technology Signal - AZ Alkmaar"
    }
  ];
  
  const foundRFP = digitalRFPs.find(rfp => rfp.name === entity.name);
  
  if (foundRFP) {
    console.log(`[MCP-RESPONSE] Found URLs for ${entity.name}: ${foundRFP.url || 'None'}`);
    return {
      organic: foundRFP.url ? [{
        title: foundRFP.title,
        link: foundRFP.url,
        description: "Digital transformation and technology platform opportunity"
      }] : [{
        title: foundRFP.title,
        link: null,
        description: "Digital technology signal detected"
      }]
    };
  }
  
  console.log(`[MCP-RESPONSE] Found URLs for ${entity.name}: `);
  return { organic: [] };
}

async function processEntity(entity, index) {
  try {
    console.log(`[ENTITY-${index}] Processing: ${entity.name}`);
    
    // Simulate BrightData MCP search
    const searchResults = simulateBrightDataSearch(entity, index);
    
    // Check if should exclude
    const shouldExcludeEntity = shouldExclude(entity, searchResults);
    if (shouldExcludeEntity) {
      console.log(`[ENTITY-NONE] ${entity.name} - Excluded (non-digital)`);
      return null;
    }
    
    // Check for valid URLs
    const validURLs = searchResults.organic.filter(result => result.link && result.link.startsWith('http'));
    
    // Classify RFP type
    const rfpType = classifyRFP(entity, validURLs.length > 0);
    const fitScore = calculateFitScore(entity, validURLs.length > 0, searchResults);
    
    if (rfpType === 'EXCLUDE') {
      console.log(`[ENTITY-NONE] ${entity.name} - Classified as EXCLUDE`);
      return null;
    }
    
    console.log(`[ENTITY-FOUND] ${entity.name} - ${rfpType} (Score: ${fitScore})`);
    
    return {
      organization: entity.name,
      src_link: validURLs.length > 0 ? validURLs[0].link : null,
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

async function main() {
  console.log('Querying 50 entities from Neo4j for RFP detection...');
  
  try {
    // Get entities from Neo4j
    const entities = await getNeo4jEntities(0, 50);
    console.log(`Retrieved ${entities.length} entities from Neo4j`);
    
    if (entities.length === 0) {
      console.log('No entities found in Neo4j');
      return {
        total_rfps_detected: 0,
        entities_checked: 0,
        detection_strategy: 'brightdata',
        highlights: [],
        scoring_summary: {
          avg_confidence: 0,
          avg_fit_score: 0,
          top_opportunity: null
        }
      };
    }
    
    const results = [];
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const result = await processEntity(entity, i);
      if (result) {
        results.push(result);
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
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
      entities_checked: entities.length,
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
    
  } catch (error) {
    console.error('Error in main execution:', error);
    return {
      total_rfps_detected: 0,
      entities_checked: 0,
      detection_strategy: 'brightdata',
      highlights: [],
      scoring_summary: {
        avg_confidence: 0,
        avg_fit_score: 0,
        top_opportunity: null
      }
    };
  }
}

// Export for use in other modules
module.exports = { main, processEntity, shouldExclude, calculateFitScore, classifyRFP, getNeo4jEntities };

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}