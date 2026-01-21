const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yzewjamvbcqmgjognfnv.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6ZXdqYW12YmNxbWdqb2duZm52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNTA0MDYxMiwiZXhwIjoyMDUwNjE2NjEyfQ.P7F6yBMMaXSG_ntjOn3CrFzLYxEf9O1niF-IzwbCVxw';

const supabase = createClient(supabaseUrl, supabaseKey);

// Entity data from Neo4j
const entities = [
  {"name": "Argentine Football Association (AFA) (json_seed)", "sport": "", "type": "Organization", "id": null},
  {"name": "Argentine Primera División (Liga Profesional de Fútbol) (json_seed)", "sport": "", "type": "Organization", "id": null},
  {"name": "Asian Football Confederation (AFC) (json_seed_2)", "sport": "", "type": "Organization", "id": null},
  {"name": "Asian Football Confederation (json_seed_2)", "sport": "", "type": "Organization", "id": null},
  {"name": "Asian Games (json_seed)", "sport": "", "type": "Organization", "id": null},
  {"name": "Athletics Australia (Little Athletics Program) (json_seed)", "sport": "", "type": "Organization", "id": null},
  {"name": "Australian Football League (AFL) (json_seed)", "sport": "", "type": "Organization", "id": null},
  {"name": "British Swimming", "sport": "", "type": "Organization", "id": null},
  {"name": "International Biathlon Union (IBU) (json_seed)", "sport": "", "type": "Organization", "id": "740"},
  {"name": "World Bridge Federation (WBF) (json_seed)", "sport": "", "type": "Organization", "id": "750"},
  {"name": "Copenhagen Suborbital", "sport": "Aerospace", "type": "Organization", "id": null},
  {"name": "Baltimore Ravens", "sport": "American Football", "type": "Club", "id": 348},
  {"name": "Belgrade Warriors", "sport": "American Football", "type": "Team", "id": 374},
  {"name": "Cleveland Browns", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Clinton Portis Jets", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Dallas Cowboys", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Denver Broncos", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Detroit Lions", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "East Kilbride Pirates", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Erlangen Sharks", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "Ersal Spartans", "sport": "American Football", "type": "Sports Club/Team", "id": null},
  {"name": "FINA", "sport": "Aquatics", "type": "International Federation", "id": null},
  {"name": "World Aquatics", "sport": "Aquatics", "type": "International Federation", "id": null},
  {"name": "International Archery Federation", "sport": "Archery", "type": "Federation", "id": null},
  {"name": "World Archery", "sport": "Archery", "type": "International Federation", "id": null},
  {"name": "World Armwrestling Federation (WAF)", "sport": "Arm Wrestling", "type": "Sports Federation", "id": null},
  {"name": "Best of the Best Athletics", "sport": "Athletics", "type": "Organization", "id": 388},
  {"name": "European Athletics", "sport": "Athletics", "type": "Federation", "id": null},
  {"name": "World Athletics", "sport": "Athletics", "type": "International Federation", "id": null},
  {"name": "Australian Football League (AFL)", "sport": "Australian Football", "type": "Organization", "id": 330},
  {"name": "AFL", "sport": "Australian Rules Football", "type": "League", "id": null},
  {"name": "Badminton World Federation", "sport": "Badminton", "type": "International Federation", "id": null},
  {"name": "Badminton World Federation (BWF)", "sport": "Badminton", "type": "International Federation", "id": null},
  {"name": "Aruba Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Baseball Australia", "sport": "Baseball", "type": "Organization", "id": 359},
  {"name": "Baseball Federation of Germany (BFG)", "sport": "Baseball", "type": "Organization", "id": 398},
  {"name": "New York Mets", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Philadelphia Phillies", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Houston Astros", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Washington Nationals", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Minnesota Twins", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Chicago Cubs", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "British Virgin Islands Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Bulgarian Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Cambodian Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Canadian Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Cayman Islands Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Chilean Baseball Federation", "sport": "Baseball", "type": "Federation", "id": null},
  {"name": "Buffalo Bisons", "sport": "Baseball", "type": "Sports Club/Team", "id": null},
  {"name": "Yakult Swallows", "sport": "Baseball", "type": "Club", "id": null}
];

// Helper function to call Perplexity API through MCP
async function searchPerplexity(query) {
  try {
    const result = await fetch('http://localhost:3000/api/perplexity-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `Search for current RFP opportunities, tenders, solicitations, or procurement requests related to: ${query}`
          }
        ],
        include_sources: true,
        format: 'json'
      })
    });

    if (!result.ok) {
      throw new Error(`Perplexity API error: ${result.status}`);
    }

    return await result.json();
  } catch (error) {
    console.error('Perplexity search error:', error);
    return null;
  }
}

// Helper function to call BrightData API through MCP
async function searchBrightData(entityName, sourceUrl) {
  try {
    const result = await fetch('http://localhost:3000/api/brightdata-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${entityName} RFP tender PDF`,
        sources: ['google']
      })
    });

    if (!result.ok) {
      throw new Error(`BrightData API error: ${result.status}`);
    }

    return await result.json();
  } catch (error) {
    console.error('BrightData search error:', error);
    return null;
  }
}

// Helper function to determine RFP tag based on content
function determineRfpTag(content, title) {
  const lowerContent = content.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // ACTIVE_RFP indicators
  const activeIndicators = [
    'deadline', 'submission', 'due date', 'solicitation', 'bid', 'tender', 'proposal',
    'rfp', 'request for proposal', 'contract', 'procurement', 'application due',
    'closing date', 'submit by', 'apply now', 'opportunity', 'funding'
  ];
  
  // SIGNAL indicators (partnership/news)
  const signalIndicators = [
    'partnership', 'collaboration', 'agreement', 'sponsorship', 'joint venture',
    'alliance', 'memorandum', 'mou', 'strategic partnership', 'collaborate'
  ];
  
  // Check for active RFP indicators
  const hasActiveIndicator = activeIndicators.some(indicator => 
    lowerContent.includes(indicator) || lowerTitle.includes(indicator)
  );
  
  // Check for signal indicators
  const hasSignalIndicator = signalIndicators.some(indicator => 
    lowerContent.includes(indicator) || lowerTitle.includes(indicator)
  );
  
  if (hasActiveIndicator) {
    return 'ACTIVE_RFP';
  } else if (hasSignalIndicator) {
    return 'SIGNAL';
  }
  
  // Default to SIGNAL if unsure
  return 'SIGNAL';
}

// Helper function to calculate confidence score
function calculateConfidence(content, title, entityName, sport) {
  let confidence = 0;
  const lowerContent = content.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Exact name match
  if (lowerContent.includes(entityName.toLowerCase()) || lowerTitle.includes(entityName.toLowerCase())) {
    confidence += 0.4;
  }
  
  // Sport relevance
  if (sport && (lowerContent.includes(sport.toLowerCase()) || lowerTitle.includes(sport.toLowerCase()))) {
    confidence += 0.2;
  }
  
  // RFP-related keywords
  const rfpKeywords = ['rfp', 'tender', 'solicitation', 'bid', 'proposal', 'contract', 'procurement'];
  const rfpMatches = rfpKeywords.filter(keyword => 
    lowerContent.includes(keyword) || lowerTitle.includes(keyword)
  ).length;
  confidence += Math.min(rfpMatches * 0.1, 0.3);
  
  // Recent indicators
  const recentIndicators = ['2025', 'deadline', 'apply now', 'accepting applications'];
  const hasRecentIndicator = recentIndicators.some(indicator => 
    lowerContent.includes(indicator) || lowerTitle.includes(indicator)
  );
  if (hasRecentIndicator) {
    confidence += 0.1;
  }
  
  return Math.min(confidence, 1.0);
}

// Helper function to calculate fit score
function calculateFitScore(content, entityName, entitySport) {
  let fitScore = 0;
  const lowerContent = content.toLowerCase();
  
  // Entity relevance
  if (lowerContent.includes(entityName.toLowerCase())) {
    fitScore += 0.5;
  }
  
  // Industry relevance
  const industryKeywords = ['sports', 'athletics', 'football', 'baseball', 'basketball', 'soccer'];
  const hasIndustryKeyword = industryKeywords.some(keyword => lowerContent.includes(keyword));
  if (hasIndustryKeyword) {
    fitScore += 0.3;
  }
  
  // Technical requirements match
  const technicalKeywords = ['technology', 'software', 'digital', 'analytics', 'data', 'innovation'];
  const hasTechnicalKeyword = technicalKeywords.some(keyword => lowerContent.includes(keyword));
  if (hasTechnicalKeyword) {
    fitScore += 0.2;
  }
  
  return Math.min(fitScore, 1.0);
}

// Helper function to determine urgency level
function determineUrgency(content, title) {
  const lowerContent = content.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Urgent indicators
  if (lowerContent.includes('urgent') || lowerTitle.includes('urgent')) return 'HIGH';
  if (lowerContent.includes('immediate') || lowerTitle.includes('immediate')) return 'HIGH';
  
  // Deadline indicators
  const deadlineKeywords = ['deadline', 'due date', 'closing soon', 'limited time'];
  const hasDeadlineKeyword = deadlineKeywords.some(keyword => 
    lowerContent.includes(keyword) || lowerTitle.includes(keyword)
  );
  if (hasDeadlineKeyword) return 'HIGH';
  
  // Medium urgency
  const mediumKeywords = ['accepting applications', 'open until', 'review begins'];
  const hasMediumKeyword = mediumKeywords.some(keyword => 
    lowerContent.includes(keyword) || lowerTitle.includes(keyword)
  );
  if (hasMediumKeyword) return 'MEDIUM';
  
  return 'LOW';
}

// Helper function to determine RFP type
function determineRfpType(content, title) {
  const lowerContent = content.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  if (lowerContent.includes('sponsorship') || lowerTitle.includes('sponsorship')) {
    return 'SPONSORSHIP';
  }
  if (lowerContent.includes('partnership') || lowerTitle.includes('partnership')) {
    return 'PARTNERSHIP';
  }
  if (lowerContent.includes('technology') || lowerTitle.includes('technology')) {
    return 'TECHNOLOGY';
  }
  if (lowerContent.includes('services') || lowerTitle.includes('services')) {
    return 'SERVICES';
  }
  if (lowerContent.includes('consulting') || lowerTitle.includes('consulting')) {
    return 'CONSULTING';
  }
  
  return 'GENERAL';
}

// Main processing function
async function processEntity(entity, index) {
  const cleanName = entity.name.replace(/\s*\([^)]*\)/g, '').trim();
  const sport = entity.sport || 'sports';
  const searchQuery = `${cleanName} ${sport} RFP OR tender`;
  
  console.log(`Processing ${index + 1}/50: ${cleanName} (${sport})`);
  
  try {
    // Perplexity search
    const perplexityResult = await searchPerplexity(searchQuery);
    
    if (!perplexityResult || !perplexityResult.content) {
      console.log(`[ENTITY-NONE] ${cleanName} - No results found`);
      return null;
    }
    
    const searchContent = perplexityResult.content;
    const sources = perplexityResult.sources || [];
    
    // Determine if this is actually relevant
    const hasRelevantContent = searchContent.toLowerCase().includes(cleanName.toLowerCase()) ||
                               searchContent.toLowerCase().includes(sport.toLowerCase());
    
    if (!hasRelevantContent) {
      console.log(`[ENTITY-NONE] ${cleanName} - Content not relevant`);
      return null;
    }
    
    // Extract title from first source or generate one
    const title = sources[0]?.title || `RFP Opportunity: ${cleanName}`;
    const srcLink = sources[0]?.url || '';
    
    // Calculate metrics
    const confidence = calculateConfidence(searchContent, title, cleanName, sport);
    const fitScore = calculateFitScore(searchContent, cleanName, sport);
    const urgency = determineUrgency(searchContent, title);
    const rfpTag = determineRfpTag(searchContent, title);
    const rfpType = determineRfpType(searchContent, title);
    
    // BrightData search for PDFs
    let pdfLinks = [];
    if (confidence > 0.5) {
      const brightDataResult = await searchBrightData(cleanName, srcLink);
      if (brightDataResult && brightDataResult.results) {
        pdfLinks = brightDataResult.results
          .filter(result => result.link && result.link.includes('.pdf'))
          .map(result => result.link);
      }
    }
    
    const result = {
      organization: cleanName,
      sport: sport,
      src_link: srcLink,
      detection_strategy: 'perplexity',
      summary_json: {
        title: title,
        confidence: confidence,
        urgency: urgency,
        fit_score: fitScore,
        rfp_type: rfpType,
        pdf_links: pdfLinks,
        tag: rfpTag,
        content_summary: searchContent.substring(0, 500) + '...'
      }
    };
    
    console.log(`[ENTITY-FOUND] ${cleanName} - ${rfpType} (${(confidence * 100).toFixed(1)}% confidence)`);
    
    // Write to Supabase
    try {
      const { data, error } = await supabase
        .from('rfp_opportunities')
        .insert([{
          organization: result.organization,
          sport: result.sport,
          src_link: result.src_link,
          detection_strategy: result.detection_strategy,
          summary_json: result.summary_json,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
      
      if (error) {
        console.error(`Supabase insert error for ${cleanName}:`, error);
      } else {
        console.log(`✓ Stored in Supabase: ${cleanName}`);
      }
    } catch (supabaseError) {
      console.error(`Supabase connection error for ${cleanName}:`, supabaseError);
    }
    
    return result;
    
  } catch (error) {
    console.error(`Error processing ${cleanName}:`, error);
    return null;
  }
}

// Main execution function
async function main() {
  console.log('🚀 Starting RFP Detection for 50 entities using Perplexity...\n');
  
  const results = [];
  const startTime = Date.now();
  
  // Process entities in batches of 5 to avoid overwhelming APIs
  const batchSize = 5;
  for (let i = 0; i < entities.length; i += batchSize) {
    const batch = entities.slice(i, i + batchSize);
    console.log(`\n📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entities.length / batchSize)}...`);
    
    const batchPromises = batch.map((entity, index) => 
      processEntity(entity, i + index)
    );
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.filter(result => result !== null));
    
    // Brief delay between batches
    if (i + batchSize < entities.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const endTime = Date.now();
  const processingTime = ((endTime - startTime) / 1000).toFixed(1);
  
  // Calculate final statistics
  const totalRfpsDetected = results.length;
  const avgConfidence = results.length > 0 ? 
    (results.reduce((sum, r) => sum + r.summary_json.confidence, 0) / results.length).toFixed(2) : 0;
  const avgFitScore = results.length > 0 ? 
    (results.reduce((sum, r) => sum + r.summary_json.fit_score, 0) / results.length).toFixed(2) : 0;
  
  const topOpportunity = results.length > 0 ? 
    results.reduce((best, current) => 
      current.summary_json.fit_score > best.summary_json.fit_score ? current : best
    ).organization : 'None';
  
  // Final report
  const finalReport = {
    total_rfps_detected: totalRfpsDetected,
    entities_checked: entities.length,
    detection_strategy: 'perplexity',
    processing_time_seconds: parseFloat(processingTime),
    scoring_summary: {
      avg_confidence: parseFloat(avgConfidence),
      avg_fit_score: parseFloat(avgFitScore),
      top_opportunity: topOpportunity
    },
    highlights: results.map(result => ({
      organization: result.organization,
      src_link: result.src_link,
      detection_strategy: result.detection_strategy,
      summary_json: result.summary_json
    }))
  };
  
  // Save results to file
  fs.writeFileSync('perplexity-rfp-results.json', JSON.stringify(finalReport, null, 2));
  
  console.log('\n🎯 FINAL REPORT');
  console.log('================');
  console.log(`Total RFPs Detected: ${totalRfpsDetected}/${entities.length}`);
  console.log(`Detection Strategy: perplexity`);
  console.log(`Processing Time: ${processingTime}s`);
  console.log(`Average Confidence: ${avgConfidence}`);
  console.log(`Average Fit Score: ${avgFitScore}`);
  console.log(`Top Opportunity: ${topOpportunity}`);
  console.log(`\n💾 Results saved to: perplexity-rfp-results.json`);
  
  console.log('\n📋 HIGH CONFIDENCE OPPORTUNITIES (70%+):');
  results
    .filter(result => result.summary_json.confidence >= 0.7)
    .forEach(result => {
      console.log(`  • ${result.organization} - ${result.summary_json.rfp_type} (${(result.summary_json.confidence * 100).toFixed(1)}% confidence)`);
    });
  
  // Output JSON as requested
  console.log('\n📄 JSON OUTPUT:');
  console.log(JSON.stringify(finalReport, null, 2));
  
  return finalReport;
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main, processEntity };