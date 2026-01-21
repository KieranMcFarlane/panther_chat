#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Entities from Neo4j query - filter for organizations only
const entities = [
  "Proton Competition",
  "International Sambo Federation (FIAS)", 
  "Aston Martin Aramco F1 Team",
  "World Armwrestling Federation (WAF)",
  "Anguilla Football Association",
  "Panadura Sports Club",
  "New Zealand Breakers",
  "Angolan Basketball Federation",
  "Angolan Football Federation", 
  "Angolan Handball Federation",
  "Angolan Volleyball Federation",
  "Pallacanestro Varese",
  "IFMA",
  "Bridgeport Islanders",
  "Asian Tour",
  "Armenian Basketball Federation",
  "Asian Cycling Confederation (ACC)",
  "Cleveland Cavaliers",
  "Argentine Basketball Confederation",
  "Asian Football Confederation",
  "Tampa Bay Lightning",
  "Athletics Australia",
  "Antigua and Barbuda Football Association",
  "Chiba Lotte Marines",
  "Antigua and Barbuda Volleyball Association",
  "Antonians Sports Club",
  "Chittagong Division",
  "Giro d'Italia Women"
];

// BrightData search function
async function searchBrightDataLinkedIn(query) {
  try {
    const searchQuery = `site:linkedin.com/company ${query} "partnership" OR "RFP"`;
    
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
    return data;
  } catch (error) {
    console.error(`BrightData search failed for ${query}:`, error.message);
    return null;
  }
}

// Perplexity validation function
async function validateWithPerplexity(entityName, brightDataResults) {
  try {
    const validationQuery = `Validate if ${entityName} has active RFP opportunities or partnership solicitations. Check for recent procurement activities, tender announcements, or partnership calls.`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at identifying RFP opportunities and partnership solicitations. Analyze the provided information and validate if there are active procurement opportunities.'
          },
          {
            role: 'user',
            content: validationQuery
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Perplexity validation failed for ${entityName}:`, error.message);
    return null;
  }
}

// Calculate confidence and fit scores
function calculateScores(brightDataResults, perplexityValidation) {
  let confidence = 0;
  let fitScore = 0;
  
  if (brightDataResults && brightDataResults.results && brightDataResults.results.length > 0) {
    confidence += Math.min(brightDataResults.results.length * 20, 60);
  }
  
  if (perplexityValidation) {
    const validationText = perplexityValidation.toLowerCase();
    if (validationText.includes('rfp') || validationText.includes('tender') || validationText.includes('procurement')) {
      confidence += 30;
      fitScore += 40;
    }
    if (validationText.includes('partnership') || validationText.includes('collaboration')) {
      confidence += 20;
      fitScore += 30;
    }
  }
  
  return {
    confidence: Math.min(confidence, 100),
    fitScore: Math.min(fitScore, 100)
  };
}

// Determine RFP type and urgency
function classifyRFP(results, validation) {
  const text = `${results} ${validation}`.toLowerCase();
  
  let rfpType = 'unknown';
  let urgency = 'low';
  
  if (text.includes('urgent') || text.includes('immediate') || text.includes('asap')) {
    urgency = 'high';
  } else if (text.includes('deadline') || text.includes('closing')) {
    urgency = 'medium';
  }
  
  if (text.includes('technology') || text.includes('digital') || text.includes('software')) {
    rfpType = 'technology';
  } else if (text.includes('sports') || text.includes('athletics') || text.includes('competition')) {
    rfpType = 'sports_services';
  } else if (text.includes('sponsorship') || text.includes('partnership')) {
    rfpType = 'partnership';
  } else if (text.includes('procurement') || text.includes('tender')) {
    rfpType = 'procurement';
  }
  
  return { rfpType, urgency };
}

// Main processing function
async function processEntitiesForRFPs() {
  const results = {
    total_rfps_detected: 0,
    entities_checked: entities.length,
    detection_strategy: 'linkedin',
    highlights: [],
    scoring_summary: {
      avg_confidence: 0,
      avg_fit_score: 0,
      top_opportunity: ''
    }
  };

  const allScores = { confidence: [], fitScore: [] };
  let topOpportunity = { name: '', score: 0 };

  console.log('🔍 Starting RFP detection for', entities.length, ' entities...\n');

  for (const entityName of entities) {
    console.log(`📊 Processing: ${entityName}`);
    
    try {
      // Step 1: BrightData LinkedIn search
      const brightDataResults = await searchBrightDataLinkedIn(entityName);
      
      // Step 2: Perplexity validation
      const perplexityValidation = brightDataResults ? 
        await validateWithPerplexity(entityName, brightDataResults) : null;
      
      // Step 3: Calculate scores
      const scores = calculateScores(brightDataResults, perplexityValidation);
      
      // Step 4: Classify RFP
      const classification = classifyRFP(
        JSON.stringify(brightDataResults), 
        perplexityValidation
      );
      
      // Step 5: Determine tag
      const tag = scores.confidence > 60 ? 'ACTIVE_RFP' : 
                  scores.confidence > 30 ? 'SIGNAL' : 'NONE';
      
      // Step 6: Write to Supabase if RFP detected
      if (tag !== 'NONE') {
        const supabaseData = {
          entity_name: entityName,
          detection_strategy: 'linkedin',
          tag: tag,
          confidence_score: scores.confidence,
          fit_score: scores.fitScore,
          rfp_type: classification.rfpType,
          urgency: classification.urgency,
          brightdata_results: brightDataResults,
          perplexity_validation: perplexityValidation,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('rfp_detections')
          .insert([supabaseData]);

        if (error) {
          console.error(`❌ Supabase insert failed for ${entityName}:`, error.message);
        } else {
          console.log(`✅ Saved to Supabase: ${entityName}`);
        }
      }

      // Step 7: Print result
      if (tag !== 'NONE') {
        console.log(`🎯 [ENTITY-FOUND] ${entityName} (${tag}, Confidence: ${scores.confidence}%, Fit: ${scores.fitScore}%)`);
        
        // Add to highlights if significant opportunity
        if (scores.confidence > 50) {
          results.highlights.push({
            organization: entityName,
            src_link: brightDataResults?.results?.[0]?.link || '',
            detection_strategy: 'linkedin',
            summary_json: {
              title: `${entityName} - ${classification.rfpType} Opportunity`,
              confidence: scores.confidence,
              urgency: classification.urgency,
              fit_score: scores.fitScore,
              rfp_type: classification.rfpType
            }
          });

          results.total_rfps_detected++;
        }

        // Track top opportunity
        if (scores.fitScore > topOpportunity.score) {
          topOpportunity = { name: entityName, score: scores.fitScore };
        }
      } else {
        console.log(`❌ [ENTITY-NONE] ${entityName}`);
      }

      // Collect scores for summary
      if (scores.confidence > 0) {
        allScores.confidence.push(scores.confidence);
        allScores.fitScore.push(scores.fitScore);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Error processing ${entityName}:`, error.message);
    }
    
    console.log(''); // Empty line for readability
  }

  // Calculate scoring summary
  if (allScores.confidence.length > 0) {
    results.scoring_summary.avg_confidence = 
      Math.round(allScores.confidence.reduce((a, b) => a + b, 0) / allScores.confidence.length);
    results.scoring_summary.avg_fit_score = 
      Math.round(allScores.fitScore.reduce((a, b) => a + b, 0) / allScores.fitScore.length);
  }
  
  results.scoring_summary.top_opportunity = topOpportunity.name;

  console.log('📋 RFP Detection Summary:');
  console.log(`Total entities checked: ${results.entities_checked}`);
  console.log(`Total RFPs detected: ${results.total_rfps_detected}`);
  console.log(`Average confidence: ${results.scoring_summary.avg_confidence}%`);
  console.log(`Average fit score: ${results.scoring_summary.avg_fit_score}%`);
  console.log(`Top opportunity: ${results.scoring_summary.top_opportunity}`);

  return results;
}

// Run the script
if (require.main === module) {
  processEntitiesForRFPs()
    .then(results => {
      console.log('\n📊 Final Results:');
      console.log(JSON.stringify(results, null, 2));
    })
    .catch(error => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { processEntitiesForRFPs };