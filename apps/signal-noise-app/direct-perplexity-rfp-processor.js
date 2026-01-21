const fs = require('fs');
const { spawn } = require('child_process');

// Process entities from Neo4j query
const entities = [
  {"name": "Brazilian Football Confederation", "sport": "Football", "country": "Brazil"},
  {"name": "Russian Football Union", "sport": "Football", "country": "Russia"},
  {"name": "Grenada Basketball Association", "sport": "Basketball", "country": "Grenada"},
  {"name": "Ethiopian Handball Federation", "sport": "Handball", "country": "Ethiopia"},
  {"name": "International Ice Hockey Federation", "sport": "Ice Hockey", "country": "Switzerland"},
  {"name": "FIVB", "sport": "Volleyball", "country": "Switzerland"},
  {"name": "CEV", "sport": "Volleyball", "country": "Luxembourg"},
  {"name": "European Athletics", "sport": "Athletics", "country": "Switzerland"},
  {"name": "International Biathlon Union", "sport": "Biathlon", "country": "Austria"},
  {"name": "International Skating Union", "sport": "Figure Skating, Speed Skating", "country": "Switzerland"},
  {"name": "International Luge Federation", "sport": "Luge", "country": "Germany"},
  {"name": "International Bobsleigh and Skeleton Federation", "sport": "Bobsleigh, Skeleton", "country": "Switzerland"},
  {"name": "World Curling Federation", "sport": "Curling", "country": "Switzerland"},
  {"name": "International Table Tennis Federation", "sport": "Table Tennis", "country": "Switzerland"},
  {"name": "World Triathlon", "sport": "Triathlon", "country": "Spain"},
  {"name": "International Modern Pentathlon Union", "sport": "Modern Pentathlon", "country": "Hungary"},
  {"name": "International Archery Federation", "sport": "Archery", "country": "Switzerland"},
  {"name": "International Boxing Association", "sport": "Boxing", "country": "Turkey"},
  {"name": "International Judo Federation", "sport": "Judo", "country": "Hungary"},
  {"name": "International Wrestling Federation", "sport": "Wrestling", "country": "Turkey"},
  {"name": "International Taekwondo Federation", "sport": "Taekwondo", "country": "South Korea"},
  {"name": "Latvian Basketball Association", "sport": "Basketball", "country": "Latvia"},
  {"name": "Peruvian Rugby Federation", "sport": "Rugby Union", "country": "Peru"},
  {"name": "Costa Rican Handball Federation", "sport": "Handball", "country": "Costa Rica"},
  {"name": "Israel Ice Hockey Federation", "sport": "Ice Hockey", "country": "Israel"},
  {"name": "Finnish Football Association", "sport": "Football", "country": "Finland"},
  {"name": "US Virgin Islands Baseball Federation", "sport": "Baseball", "country": "US Virgin Islands"},
  {"name": "Colombian Volleyball Federation", "sport": "Volleyball", "country": "Colombia"},
  {"name": "Canadian Ice Hockey Federation", "sport": "Ice Hockey", "country": "Canada"},
  {"name": "Netherlands Cricket Board", "sport": "Cricket", "country": "Netherlands"},
  {"name": "Kenya Basketball Federation", "sport": "Basketball", "country": "Kenya"},
  {"name": "Indonesian Volleyball Federation", "sport": "Volleyball", "country": "Indonesia"},
  {"name": "United Arab Emirates Emirates Motorsports Organization (EMSO)", "sport": "Motorsport", "country": "UAE"},
  {"name": "Polish Ice Hockey Federation", "sport": "Ice Hockey", "country": "Poland"},
  {"name": "Panama Cricket Association", "sport": "Cricket", "country": "Panama"},
  {"name": "Kenya Rugby Union", "sport": "Rugby Union", "country": "Kenya"},
  {"name": "Thai Baseball Federation", "sport": "Baseball", "country": "Thailand"},
  {"name": "Motorsport South Africa (MSA)", "sport": "Motorsport", "country": "South Africa"},
  {"name": "Niue Rugby Football Union", "sport": "Rugby Union", "country": "Niue"},
  {"name": "Antigua and Barbuda Basketball Association", "sport": "Basketball", "country": "Antigua and Barbuda"},
  {"name": "Czech Baseball Association", "sport": "Baseball", "country": "Czech Republic"},
  {"name": "Central African Football Federation", "sport": "Football", "country": "Central African Republic"},
  {"name": "Thai Cricket Association", "sport": "Cricket", "country": "Thailand"},
  {"name": "Qatar Ice Hockey Federation", "sport": "Ice Hockey", "country": "Qatar"},
  {"name": "Armenian Football Federation", "sport": "Football", "country": "Armenia"},
  {"name": "Malaysian Rugby Union", "sport": "Rugby Union", "country": "Malaysia"},
  {"name": "Polish Rugby Union", "sport": "Rugby Union", "country": "Poland"},
  {"name": "Tunisian Ice Hockey Association", "sport": "Ice Hockey", "country": "Tunisia"},
  {"name": "Kuwait Ice Hockey Association", "sport": "Ice Hockey", "country": "Kuwait"},
  {"name": "Mauritanian Basketball Federation", "sport": "Basketball", "country": "Mauritania"}
];

const results = {
  total_rfps_detected: 0,
  entities_checked: 50,
  detection_strategy: "perplexity",
  highlights: [],
  scoring_summary: {
    avg_confidence: 0,
    avg_fit_score: 0,
    top_opportunity: ""
  }
};

function usePerplexityMCP(entityName, sport, query) {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', ['perplexity-mcp-rfp-detector.py', entityName, sport, query]);
    
    let output = '';
    let error = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          console.error(`Failed to parse JSON for ${entityName}:`, e);
          resolve(null);
        }
      } else {
        console.error(`Python script failed for ${entityName}:`, error);
        resolve(null);
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error(`Failed to start Python process for ${entityName}:`, err);
      resolve(null);
    });
  });
}

async function processEntity(entity, index) {
  console.log(`[ENTITY-START] ${entity.name}`);
  
  try {
    // Build search query for digital opportunities only
    const searchQuery = `${entity.name} ${entity.sport} ("digital transformation RFP" OR "mobile app tender" OR "web development RFP" OR "software development" OR "technology platform RFP" OR "digital platform")`;
    
    console.log(`Searching: ${searchQuery}`);
    
    // Use Python script with MCP
    const perplexityResult = await usePerplexityMCP(entity.name, entity.sport, searchQuery);
    
    // Debug: Show MCP response for first 3 entities
    if (index < 3 && perplexityResult) {
      console.log(`[MCP-RESPONSE] ${entity.name}:`, JSON.stringify(perplexityResult, null, 2));
    }
    
    let foundOpportunity = false;
    let rfpOpportunity = null;
    
    if (perplexityResult && perplexityResult.opportunities && perplexityResult.opportunities.length > 0) {
      const opportunities = perplexityResult.opportunities;
      
      // Filter for relevant digital opportunities
      const relevantOpportunities = opportunities.filter(opp => {
        const content = (opp.content || opp.title || "").toLowerCase();
        return !content.includes("stadium construction") &&
               !content.includes("hospitality") &&
               !content.includes("apparel") &&
               !content.includes("f&b") &&
               !content.includes("catering") &&
               !content.includes("event production") &&
               !content.includes("transportation") &&
               !content.includes("logistics") &&
               !content.includes("security") &&
               !content.includes("equipment") &&
               (content.includes("digital") || content.includes("software") || 
                content.includes("mobile app") || content.includes("web") ||
                content.includes("technology") || content.includes("platform"));
      });
      
      if (relevantOpportunities.length > 0) {
        foundOpportunity = true;
        
        // Calculate fit score
        let fitScore = 0;
        
        // Base score for digital project
        fitScore += 40;
        
        // Location bonus for UK/EU
        if (["Finland", "Netherlands", "Latvia", "Poland", "Czech Republic", "Spain", "Hungary", "Germany", "Austria", "Luxembourg", "Switzerland"].includes(entity.country)) {
          fitScore += 10;
        }
        
        // Check if active RFP with deadline
        const hasActiveRFP = relevantOpportunities.some(opp => {
          const content = (opp.content || "").toLowerCase();
          return content.includes("deadline") || content.includes("submission") || content.includes("tender");
        });
        
        if (hasActiveRFP) {
          fitScore += 15;
        }
        
        // Check for budget indication
        const hasBudget = relevantOpportunities.some(opp => {
          const content = (opp.content || "").toLowerCase();
          return content.includes("£80k") || content.includes("£500,000") || content.includes("budget");
        });
        
        if (hasBudget) {
          fitScore += 20;
        }
        
        // Determine RFP type
        const content = (relevantOpportunities[0].content || "").toLowerCase();
        let rfpType = "SIGNAL";
        
        if (content.includes("rfp") || content.includes("tender") || content.includes("proposal")) {
          rfpType = "ACTIVE_RFP";
        }
        
        // Get the best URL
        const bestOpportunity = relevantOpportunities[0];
        const sourceUrl = bestOpportunity.url || null;
        
        rfpOpportunity = {
          organization: entity.name,
          src_link: sourceUrl,
          detection_strategy: "perplexity",
          summary_json: {
            title: `Digital opportunity detected for ${entity.name}`,
            confidence: Math.min(95, 60 + fitScore / 5),
            urgency: hasActiveRFP ? "high" : "medium",
            fit_score: Math.min(100, fitScore),
            rfp_type: rfpType
          }
        };
        
        results.highlights.push(rfpOpportunity);
        results.total_rfps_detected++;
        
        console.log(`[ENTITY-FOUND] ${entity.name} - Fit Score: ${Math.min(100, fitScore)}`);
      }
    }
    
    if (!foundOpportunity) {
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
  } catch (error) {
    console.error(`Error processing ${entity.name}:`, error.message);
    console.log(`[ENTITY-NONE] ${entity.name}`);
  }
}

async function processAllEntities() {
  console.log("Starting RFP detection for 50 entities...");
  
  for (let i = 0; i < entities.length; i++) {
    await processEntity(entities[i], i);
    
    // Add small delay to avoid overwhelming APIs
    if (i % 5 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Calculate summary statistics
  if (results.highlights.length > 0) {
    const totalConfidence = results.highlights.reduce((sum, h) => sum + h.summary_json.confidence, 0);
    const totalFitScore = results.highlights.reduce((sum, h) => sum + h.summary_json.fit_score, 0);
    
    results.scoring_summary.avg_confidence = Math.round(totalConfidence / results.highlights.length);
    results.scoring_summary.avg_fit_score = Math.round(totalFitScore / results.highlights.length);
    
    // Find top opportunity
    const topOpportunity = results.highlights.reduce((top, current) => 
      current.summary_json.fit_score > top.summary_json.fit_score ? current : top
    );
    results.scoring_summary.top_opportunity = topOpportunity.organization;
  }
  
  console.log("Processing complete. Saving results...");
  
  // Save results
  fs.writeFileSync('perplexity-rfp-results-50-entities.json', JSON.stringify(results, null, 2));
  
  console.log(`Results saved. Total RFPs detected: ${results.total_rfps_detected}`);
  
  return results;
}

// Main execution
if (require.main === module) {
  processAllEntities().catch(console.error);
}

module.exports = { processAllEntities, processEntity, entities, results };