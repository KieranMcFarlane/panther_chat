const entities = [
  { name: "Zamalek Basketball", type: "Basketball Club", sport: "Basketball" },
  { name: "Liga ACB (Spain)", type: "Basketball League", sport: null },
  { name: "Umbro", type: "Brand", sport: null },
  { name: "Nike", type: "Brand", sport: "Multi-sport" },
  { name: "Adidas", type: "Brand", sport: "Multi-sport" },
  { name: "Puma", type: "Brand", sport: "Multi-sport" },
  { name: "Molten", type: "Brand", sport: "Basketball" },
  { name: "New Balance", type: "Brand", sport: "Football" },
  { name: "Antonians Sports Club", type: "Club", sport: "Cricket" },
  { name: "Antwerp Giants", type: "Club", sport: "Basketball" },
  { name: "Anwil Włocławek", type: "Club", sport: "Basketball" },
  { name: "Asseco Resovia Rzeszów", type: "Club", sport: "Volleyball" },
  { name: "Bali United", type: "Club", sport: "Football", description: "Indonesian professional football club" },
  { name: "Avaí FC", type: "Club", sport: "Football", description: "Brazilian football club from Santa Catarina" },
  { name: "Bandari FC", type: "Club", sport: "Football", description: "Iranian professional football club" },
  { name: "Baltimore Ravens", type: "Club", sport: "American Football", description: "National Football League franchise" },
  { name: "Bangkok United", type: "Club", sport: "Football", description: "Thai professional football club based in Bangkok" },
  { name: "Barnsley FC", type: "Club", sport: "Football", description: "English professional football club" },
  { name: "Bayer Leverkusen", type: "Club", sport: "Football", description: "German professional football club" },
  { name: "Bayern Munich (Women)", type: "Club", sport: "Football", description: "German women's professional football club" },
  { name: "Paris Saint-Germain Handball", type: "Club", sport: "Handball", description: "" },
  { name: "Belenenses", type: "Club", sport: "Football", description: "Portuguese professional football club" },
  { name: "Belgrade Partizan (Basketball)", type: "Club", sport: "Basketball", description: "Serbian professional basketball club" },
  { name: "Belgrade Partizan (Football)", type: "Club", sport: "Football", description: "Serbian professional football club" },
  { name: "Belfast Giants", type: "Club", sport: "Ice Hockey", description: "Professional ice hockey club based in Belfast" },
  { name: "Belgrade Water Polo", type: "Club", sport: "Water Polo", description: "Professional water polo club based in Belgrade" },
  { name: "Benfica", type: "Club", sport: "Football", description: "Portuguese professional football club" },
  { name: "Benfica (Basketball)", type: "Club", sport: "Basketball", description: "Portuguese professional basketball club" },
  { name: "Betis", type: "Club", sport: "Football", description: "Spanish professional football club" },
  { name: "Berlín FC", type: "Club", sport: "Football", description: "Mexican professional football club" },
  { name: "Benfica Handball", type: "Club", sport: "Handball", description: "Portuguese professional handball club" },
  { name: "Benfica Futsal", type: "Club", sport: "Futsal", description: "Portuguese professional futsal club" },
  { name: "Benfica Volleyball", type: "Club", sport: "Volleyball", description: "Portuguese professional volleyball club" },
  { name: "BFC Baku", type: "Club", sport: "Football", description: "Azerbaijani professional football club" },
  { name: "Manchester United", type: "Club", sport: "Football", description: "" },
  { name: "Brooklyn Nets", type: "Club", sport: "Basketball", description: "" },
  { name: "Budućnost Podgorica", type: "Club", sport: "Basketball", description: "" },
  { name: "Arsenal", type: "Club", sport: "Football", description: null },
  { name: "Manchester City", type: "Club", sport: "Football", description: null },
  { name: "Liverpool", type: "Club", sport: "Football", description: null },
  { name: "Tottenham Hotspur", type: "Club", sport: "Football", description: null },
  { name: "Everton", type: "Club", sport: "Football", description: null },
  { name: "Nottingham Forest", type: "Club", sport: "Football", description: null },
  { name: "West Ham United", type: "Club", sport: "Football", description: null },
  { name: "Fulham", type: "Club", sport: "Football", description: null },
  { name: "Ipswich Town", type: "Club", sport: "Football", description: null },
  { name: "Newcastle United", type: "Club", sport: "Football", description: null },
  { name: "Birmingham City", type: "Club", sport: "Football", description: null },
  { name: "Bolton Wanderers", type: "Club", sport: "Football", description: null },
  { name: "Charlton Athletic", type: "Club", sport: "Football", description: null }
];

// Critical exclusions - DO NOT DETECT
const CRITICAL_EXCLUSIONS = [
  "stadium", "construction", "hospitality", "apparel", "equipment", 
  "F&B", "catering", "merchandise", "event management", "transportation",
  "logistics", "security", "physical products"
];

// Digital transformation keywords
const DIGITAL_KEYWORDS = [
  "digital transformation", "mobile app", "software development", 
  "web development", "technology platform", "RFP", "tender", "procurement",
  "digital", "software", "app development", "web application", "technology"
];

async function searchBrightDataForEntity(entity) {
  try {
    const searchQueries = [
      `${entity.name} ${entity.sport || ''} digital transformation RFP filetype:pdf`,
      `${entity.name} ${entity.sport || ''} mobile app tender filetype:pdf`,
      `${entity.name} ${entity.sport || ''} software development RFP filetype:pdf`,
      `${entity.name} ${entity.sport || ''} web development RFP filetype:pdf`,
      `${entity.name} ${entity.sport || ''} technology platform RFP filetype:pdf`
    ];

    // For this demo, we'll simulate BrightData results with realistic data
    // In production, this would call actual BrightData API
    const mockResults = generateMockBrightDataResults(entity);
    
    return {
      entity: entity.name,
      results: mockResults,
      hasDigitalOpportunities: mockResults.some(r => r.isDigital)
    };
  } catch (error) {
    console.error(`Error searching for ${entity.name}:`, error);
    return {
      entity: entity.name,
      results: [],
      hasDigitalOpportunities: false,
      error: error.message
    };
  }
}

function generateMockBrightDataResults(entity) {
  // Simulated realistic results for demo purposes
  const mockData = {
    "Manchester United": [
      {
        title: "Manchester United Digital Transformation RFP 2024",
        url: "https://manutd.com/rfp/digital-transformation-2024.pdf",
        snippet: "Seeking partners for comprehensive digital platform modernization",
        isDigital: true,
        hasPDF: true,
        confidence: 85
      },
      {
        title: "Old Trafford Stadium Renovation - Construction Services",
        url: "https://manutd.com/rfp/stadium-renovation.pdf",
        snippet: "Construction and renovation services for stadium infrastructure",
        isDigital: false,
        hasPDF: true,
        confidence: 90
      }
    ],
    "Arsenal": [
      {
        title: "Arsenal Mobile App Development Tender",
        url: "https://arsenal.com/tenders/mobile-app-2024.pdf",
        snippet: "Official mobile application development for fan engagement",
        isDigital: true,
        hasPDF: true,
        confidence: 80
      }
    ],
    "Bayern Munich (Women)": [
      {
        title: "FC Bayern Women's Digital Platform RFP",
        url: "https://fcbayern.com/women/digital-platform-rfp.pdf",
        snippet: "Digital fan engagement and content platform development",
        isDigital: true,
        hasPDF: true,
        confidence: 75
      }
    ],
    "Baltimore Ravens": [
      {
        title: "Ravens Technology Platform Procurement",
        url: "https://baltimoreravens.com/procurement/tech-platform-2024.pdf",
        snippet: "Game day technology and fan experience platform",
        isDigital: true,
        hasPDF: true,
        confidence: 82
      }
    ],
    "Bali United": [
      {
        title: "Bali United Digital Transformation Initiative",
        url: "https://baliunited.com/digital-transformation.pdf",
        snippet: "Comprehensive digital transformation for football operations",
        isDigital: true,
        hasPDF: true,
        confidence: 70
      }
    ]
  };

  const results = mockData[entity.name] || [];
  
  // Filter out non-digital results
  return results.filter(result => {
    if (!result.isDigital) return false;
    
    // Check for critical exclusions
    const textToCheck = `${result.title} ${result.snippet}`.toLowerCase();
    return !CRITICAL_EXCLUSIONS.some(exclusion => 
      textToCheck.includes(exclusion.toLowerCase())
    );
  });
}

function calculateFitScore(result) {
  let score = 0;
  
  // +40: Digital/software project
  if (result.isDigital) score += 40;
  
  // +20: Has .pdf document
  if (result.hasPDF) score += 20;
  
  // +15: Open RFP with deadline (mock for demo)
  if (result.title.toLowerCase().includes('rfp') || 
      result.title.toLowerCase().includes('tender')) {
    score += 15;
  }
  
  // +10: UK/EU location (mock detection)
  const ukEuIndicators = ['united', 'london', 'manchester', 'munich', 'bayer', 'paris'];
  if (ukEuIndicators.some(indicator => 
      result.title.toLowerCase().includes(indicator.toLowerCase()))) {
    score += 10;
  }
  
  // -50: Non-digital project (already filtered out)
  
  return Math.min(100, Math.max(0, score));
}

function classifyRFPType(result) {
  if (result.hasPDF && 
      (result.title.toLowerCase().includes('rfp') || 
       result.title.toLowerCase().includes('tender'))) {
    return 'ACTIVE_RFP';
  }
  
  if (result.snippet.toLowerCase().includes('transformation') || 
      result.snippet.toLowerCase().includes('development')) {
    return 'SIGNAL';
  }
  
  return 'EXCLUDE';
}

async function processEntities() {
  const results = {
    total_rfps_detected: 0,
    entities_checked: entities.length,
    detection_strategy: 'brightdata',
    highlights: [],
    scoring_summary: {
      avg_confidence: 0,
      avg_fit_score: 0,
      top_opportunity: ""
    }
  };
  
  let totalConfidence = 0;
  let totalFitScore = 0;
  let maxFitScore = 0;
  let topOpportunity = "";
  
  for (const entity of entities) {
    console.log(`[PROCESSING] ${entity.name}`);
    
    const searchResult = await searchBrightDataForEntity(entity);
    
    if (searchResult.hasDigitalOpportunities) {
      console.log(`[ENTITY-FOUND] ${entity.name}`);
      
      for (const result of searchResult.results) {
        const fitScore = calculateFitScore(result);
        const rfpType = classifyRFPType(result);
        
        if (rfpType !== 'EXCLUDE') {
          results.highlights.push({
            organization: entity.name,
            src_link: result.url,
            detection_strategy: 'brightdata',
            summary_json: {
              title: result.title,
              confidence: result.confidence,
              urgency: fitScore > 70 ? 'HIGH' : fitScore > 50 ? 'MEDIUM' : 'LOW',
              fit_score: fitScore,
              rfp_type: rfpType
            }
          });
          
          results.total_rfps_detected++;
          totalConfidence += result.confidence;
          totalFitScore += fitScore;
          
          if (fitScore > maxFitScore) {
            maxFitScore = fitScore;
            topOpportunity = entity.name;
          }
        }
      }
    } else {
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
    
    // Small delay to avoid overwhelming the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Calculate averages
  if (results.total_rfps_detected > 0) {
    results.scoring_summary.avg_confidence = Math.round(
      totalConfidence / results.total_rfps_detected
    );
    results.scoring_summary.avg_fit_score = Math.round(
      totalFitScore / results.total_rfps_detected
    );
  }
  
  results.scoring_summary.top_opportunity = topOpportunity;
  
  return results;
}

// Run the process
processEntities()
  .then(results => {
    console.log("\n=== FINAL RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
  })
  .catch(error => {
    console.error("Error in processing:", error);
  });

module.exports = { processEntities, searchBrightDataForEntity };