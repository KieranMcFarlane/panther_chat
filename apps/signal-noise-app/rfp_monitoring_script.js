#!/usr/bin/env node

const crypto = require('crypto');

// Entities from Neo4j
const entities = [
  { name: "Botafogo", sport: "Football", country: "Brazil" },
  { name: "Bourg-en-Bresse", sport: "Rugby", country: "France" },
  { name: "Bourgoin", sport: "Rugby", country: "France" },
  { name: "Brentford FC", sport: "Football", country: "England" },
  { name: "Brighton & Hove Albion FC", sport: "Football", country: "England" },
  { name: "Bristol City FC", sport: "Football", country: "England" },
  { name: "Bristol Rovers FC", sport: "Football", country: "England" },
  { name: "Brisbane Bandits", sport: "Baseball", country: "Australia" },
  { name: "Brisbane Bullets", sport: "Basketball", country: "Australia" },
  { name: "Brisbane Heat", sport: "Cricket", country: "Australia" },
  { name: "Bristol Bears", sport: "Rugby Union", country: "England" },
  { name: "Chambéry Savoie Mont Blanc", sport: "Handball", country: "France" },
  { name: "Orlando Pirates Basketball", sport: "Basketball", country: "South Africa" },
  { name: "Cocodrilos de Caracas", sport: "Basketball", country: "Venezuela" },
  { name: "Joventut Badalona", sport: "Basketball", country: "Spain" },
  { name: "Magnolia Hotshots", sport: "Basketball", country: "Philippines" },
  { name: "Ryukyu Golden Kings", sport: "Basketball", country: "Japan" },
  { name: "Florida Panthers", sport: "Ice Hockey", country: "United States" },
  { name: "Jämtland Basket", sport: "Basketball", country: "Sweden" },
  { name: "Kansas City Mavericks", sport: "Ice Hockey", country: "United States" },
  { name: "Al-Rayyan", sport: "Handball", country: "Qatar" },
  { name: "Minaur Baia Mare", sport: "Handball", country: "Romania" },
  { name: "Lyon", sport: "Rugby", country: "France" },
  { name: "NC Dinos", sport: "Baseball", country: "South Korea" },
  { name: "RK Partizan", sport: "Handball", country: "Serbia" },
  { name: "Allianz Milano", sport: "Volleyball", country: "Italy" },
  { name: "OGC Nice", sport: "Football", country: "France" },
  { name: "US Dunkerque HB", sport: "Handball", country: "France" },
  { name: "Motherwell", sport: "Football", country: "Scotland" },
  { name: "Toulouse FC", sport: "Football", country: "France" },
  { name: "Los Angeles Lakers", sport: "Basketball", country: "USA" },
  { name: "NEC Nijmegen", sport: "Football", country: "Netherlands" },
  { name: "Peñarol de Mar del Plata", sport: "Basketball", country: "Argentina" },
  { name: "Mainz 05", sport: "Football", country: "Germany" },
  { name: "Gwinnett Stripers", sport: "Baseball", country: "United States" },
  { name: "Utica Comets", sport: "Ice Hockey", country: "United States" },
  { name: "Providence Bruins", sport: "Ice Hockey", country: "United States" },
  { name: "Al Sadd SC", sport: "Basketball", country: "Qatar" },
  { name: "Cleveland Guardians", sport: "Baseball", country: "United States" },
  { name: "Alvark Tokyo", sport: "Basketball", country: "Japan" },
  { name: "Pyramids FC", sport: "Football", country: "Egypt" },
  { name: "Rouen", sport: "Rugby", country: "France" },
  { name: "Hawke's Bay Magpies", sport: "Rugby", country: "New Zealand" },
  { name: "TSV Hannover-Burgdorf", sport: "Handball", country: "Germany" },
  { name: "Toronto Marlies", sport: "Ice Hockey", country: "Canada" },
  { name: "Zenit St. Petersburg", sport: "Basketball", country: "Russia" },
  { name: "VC Long Beach", sport: "Volleyball", country: "United States" },
  { name: "Rugby Rovigo Delta", sport: "Rugby", country: "Italy" },
  { name: "Luleå HF", sport: "Ice Hockey", country: "Sweden" },
  { name: "Incheon United", sport: "Football", country: "South Korea" },
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
  { name: "Unics Kazan", sport: "Basketball", country: "Russia" },
  { name: "FC Seoul", sport: "Football", country: "South Korea" },
  { name: "Porto Robur Costa Ravenna", sport: "Volleyball", country: "Italy" },
  { name: "RK Maribor Branik", sport: "Handball", country: "Slovenia" },
  { name: "Rangers", sport: "Football", country: "Scotland" },
  { name: "TP Mazembe", sport: "Football", country: "DR Congo" },
  { name: "JT Thunders Hiroshima", sport: "Volleyball", country: "Japan" },
  { name: "Raja Casablanca", sport: "Football", country: "Morocco" },
  { name: "Greenville Swamp Rabbits", sport: "Ice Hockey", country: "United States" },
  { name: "Castres Olympique", sport: "Rugby", country: "France" },
  { name: "Barça Handbol", sport: "Handball", country: "Spain" },
  { name: "Dinamo Pancevo", sport: "Handball", country: "Serbia" },
  { name: "Hearts", sport: "Football", country: "Scotland" },
  { name: "Fenerbahçe Beko", sport: "Basketball", country: "Turkey" },
  { name: "Telekom Veszprém", sport: "Handball", country: "Hungary" },
  { name: "Rugby Calvisano", sport: "Rugby", country: "Italy" },
  { name: "Hapoel Holon", sport: "Basketball", country: "Israel" },
  { name: "Kandy Customs Cricket Club", sport: "Cricket", country: "Sri Lanka" },
  { name: "Volley Näfels", sport: "Volleyball", country: "Switzerland" },
  { name: "Detroit Tigers", sport: "Baseball", country: "United States" },
  { name: "Olympique Lyonnais", sport: "Football", country: "France" },
  { name: "Al Ittihad", sport: "Football", country: "Saudi Arabia" },
  { name: "Lube Civitanova", sport: "Volleyball", country: "Italy" },
  { name: "Blumenau", sport: "Volleyball", country: "Brazil" },
  { name: "OK Merkur Maribor", sport: "Volleyball", country: "Slovenia" },
  { name: "Budivelnyk Kyiv", sport: "Basketball", country: "Ukraine" },
  { name: "Tahoe Knight Monsters", sport: "Ice Hockey", country: "United States" },
  { name: "Chilaw Marians Cricket Club", sport: "Cricket", country: "Sri Lanka" },
  { name: "Lehigh Valley IronPigs", sport: "Baseball", country: "United States" },
  { name: "Volley Lube", sport: "Volleyball", country: "Italy" },
  { name: "Bnei Herzliya", sport: "Basketball", country: "Israel" },
  { name: "Al Wasl SC", sport: "Basketball", country: "UAE" },
  { name: "TNT Tropang Giga", sport: "Basketball", country: "Philippines" },
  { name: "Anadolu Efes", sport: "Basketball", country: "Europe" },
  { name: "RK Nexe", sport: "Handball", country: "Croatia" },
  { name: "Guangzhou Loong Lions", sport: "Basketball", country: "China" },
  { name: "Maccabi Tel Aviv", sport: "Basketball", country: "Israel" },
  { name: "Orlando Magic", sport: "Basketball", country: "USA" },
  { name: "Geelong-Korea", sport: "Baseball", country: "Australia" },
  { name: "Cesson Rennes Métropole HB", sport: "Handball", country: "France" },
  { name: "Los Angeles Dodgers", sport: "Baseball", country: "USA" },
  { name: "Ajax", sport: "Football", country: "Netherlands" },
  { name: "Växjö Lakers", sport: "Ice Hockey", country: "Sweden" },
  { name: "Orlando City SC", sport: "Football", country: "United States" },
  { name: "Toledo Mud Hens", sport: "Baseball", country: "United States" },
  { name: "Estudiantes", sport: "Football", country: "Argentina" },
  { name: "Middlesex", sport: "Cricket", country: "England" },
  { name: "Club Brugge", sport: "Football", country: "Belgium" },
  { name: "Canterbury Cricket Club", sport: "Cricket", country: "New Zealand" },
  { name: "Petkim Spor", sport: "Basketball", country: "Turkey" },
  { name: "Al Ahli Saudi FC", sport: "Football", country: "Saudi Arabia" },
  { name: "RC Celta de Vigo", sport: "Football", country: "Spain" },
  { name: "Royal Antwerp FC", sport: "Football", country: "Belgium" },
  { name: "Gamba Osaka", sport: "Football", country: "Japan" },
  { name: "Western Sydney Wanderers FC", sport: "Football", country: "Australia" },
  { name: "Urawa Red Diamonds", sport: "Football", country: "Japan" },
  { name: "Al Hilal Saudi FC", sport: "Football", country: "Saudi Arabia" },
  { name: "Jeonbuk Hyundai Motors FC", sport: "Football", country: "South Korea" },
  { name: "Kashima Antlers", sport: "Football", country: "Japan" },
  { name: "EWE Baskets Oldenburg", sport: "Basketball", country: "Germany" },
  { name: "Exeter Chiefs", sport: "Rugby", country: "England" },
  { name: "Fakel Novy Urengoy", sport: "Volleyball", country: "Russia" },
  { name: "Färjestad BK", sport: "Ice Hockey", country: "Sweden" },
  { name: "Farma Conde São José", sport: "Volleyball", country: "Brazil" },
  { name: "FC Augsburg", sport: "Football", country: "Germany" },
  { name: "FC Barcelona Basket", sport: "Basketball", country: "Europe" },
  { name: "FC Basel", sport: "Football", country: "Switzerland" },
  { name: "FC Famalicão", sport: "Football", country: "Portugal" },
  { name: "FC Lorient", sport: "Football", country: "France" },
  { name: "FC Metz", sport: "Football", country: "France" },
  { name: "FC Midtjylland", sport: "Football", country: "Denmark" },
  { name: "FC Porto", sport: "Football", country: "Portugal" },
  { name: "FC Porto (Handball)", sport: "Handball", country: "Portugal" },
  { name: "FC Twente", sport: "Football", country: "Netherlands" },
  { name: "FC Utrecht", sport: "Football", country: "Netherlands" },
  { name: "FC Zürich", sport: "Football", country: "Switzerland" },
  { name: "Fenerbahçe", sport: "Football", country: "Türkiye" },
  { name: "Ferencvárosi TC", sport: "Handball", country: "Hungary" },
  { name: "Ferroviário de Maputo", sport: "Basketball", country: "Mozambique" },
  { name: "Fiamme Oro Rugby", sport: "Rugby", country: "Italy" },
  { name: "Fijian Drua", sport: "Rugby", country: "Fiji" },
  { name: "Fiorentina", sport: "Football", country: "Italy" },
  { name: "Flamengo Basketball", sport: "Basketball", country: "Brazil" },
  { name: "Florida Everblades", sport: "Ice Hockey", country: "United States" },
  { name: "Fluminense", sport: "Football", country: "Brazil" },
  { name: "Fort Wayne Komets", sport: "Ice Hockey", country: "United States" },
  { name: "Franca Basquete", sport: "Basketball", country: "Brazil" },
  { name: "Fredericia HK 1990", sport: "Handball", country: "Denmark" },
  { name: "Free State", sport: "Cricket", country: "South Africa" },
  { name: "Fribourg Olympic", sport: "Basketball", country: "Switzerland" },
  { name: "Frölunda HC", sport: "Ice Hockey", country: "Sweden" },
  { name: "Fubon Guardians", sport: "Baseball", country: "Taiwan" },
  { name: "Füchse Berlin", sport: "Handball", country: "Germany" },
  { name: "Fujitsu Kawasaki", sport: "Volleyball", country: "Japan" },
  { name: "Fukuoka SoftBank Hawks", sport: "Baseball", country: "Japan" },
  { name: "Galatasaray", sport: "Football", country: "Türkiye" },
  { name: "Galatasaray Basketbol", sport: "Basketball", country: "Türkiye" },
  { name: "Galatasaray HDI Sigorta", sport: "Volleyball", country: "Turkey" },
  { name: "Gas Sales Bluenergy Piacenza", sport: "Volleyball", country: "Italy" },
  { name: "Gauteng", sport: "Cricket", country: "South Africa" },
  { name: "Genoa", sport: "Football", country: "Italy" },
  { name: "Getafe CF", sport: "Football", country: "Spain" },
  { name: "Gil Vicente FC", sport: "Football", country: "Portugal" },
  { name: "Gioiella Prisma Taranto", sport: "Volleyball", country: "Italy" },
  { name: "Vélez Sarsfield", sport: "Football", country: "Argentina" },
  { name: "Middlesbrough", sport: "Football", country: "England" },
  { name: "Clermont Foot", sport: "Football", country: "France" },
  { name: "RB Leipzig", sport: "Football", country: "Germany" },
  { name: "Eintracht Frankfurt", sport: "Football", country: "Germany" },
  { name: "VfL Wolfsburg", sport: "Football", country: "Germany" },
  { name: "Borussia Mönchengladbach", sport: "Football", country: "Germany" },
  { name: "Hamburger SV", sport: "Football", country: "Germany" },
  { name: "Torino", sport: "Football", country: "Italy" },
  { name: "Udinese", sport: "Football", country: "Italy" },
  { name: "Yokohama F. Marinos", sport: "Football", country: "Japan" },
  { name: "Go Ahead Eagles", sport: "Football", country: "Netherlands" },
  { name: "RKC Waalwijk", sport: "Football", country: "Netherlands" }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function calculateConfidence(results) {
  if (!results || results.length === 0) return 0.0;
  
  const rfpKeywords = [
    'rfp', 'request for proposal', 'tender', 'procurement', 'bid', 
    'digital transformation', 'mobile app', 'website development', 
    'fan engagement platform', 'digital rfp', 'technology partnership',
    'rfi', 'request for information', 'eoi', 'expression of interest',
    'vendor', 'supplier', 'contract', 'sourcing', 'acquisition'
  ];
  
  let totalScore = 0;
  let matchCount = 0;
  
  results.forEach(result => {
    const text = (result.title + ' ' + result.description).toLowerCase();
    const matches = rfpKeywords.filter(keyword => text.includes(keyword)).length;
    if (matches > 0) {
      matchCount++;
      totalScore += Math.min(matches / 3, 1.0); // Cap at 1.0 per result
    }
  });
  
  return matchCount > 0 ? (totalScore / results.length) : 0.0;
}

function calculateFitScore(confidence, entity) {
  let score = Math.round(confidence * 100);
  
  // Boost for major entities
  const majorEntities = [
    'Los Angeles Lakers', 'Real Madrid', 'Barcelona', 'Manchester United',
    'Ajax', 'Liverpool', 'Bayern Munich', 'PSG', 'Juventus'
  ];
  
  if (majorEntities.some(major => entity.name.toLowerCase().includes(major.toLowerCase()))) {
    score += 15;
  }
  
  // Boost for entities from countries with high digital adoption
  const highTechCountries = ['USA', 'United States', 'England', 'Germany', 'Netherlands', 'Japan'];
  if (highTechCountries.includes(entity.country)) {
    score += 10;
  }
  
  // Boost for certain sports that are more digitally advanced
  const digitalSports = ['Football', 'Basketball', 'Baseball'];
  if (digitalSports.includes(entity.sport)) {
    score += 8;
  }
  
  return Math.min(Math.round(score), 100);
}

function determineUrgency(fitScore, confidence) {
  if (fitScore >= 80 || confidence >= 0.8) return 'high';
  if (fitScore >= 60 || confidence >= 0.6) return 'medium';
  return 'low';
}

async function processEntities() {
  const results = {
    total_rfps_detected: 0,
    entities_checked: entities.length,
    highlights: [],
    scoring_summary: {
      avg_confidence: 0,
      avg_fit_score: 0,
      top_opportunity: ""
    }
  };
  
  let totalConfidence = 0;
  let totalFitScore = 0;
  let topScore = 0;
  let topOpportunity = "";
  
  console.log(`Starting RFP monitoring for ${entities.length} entities...`);
  
  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    console.log(`[ENTITY-START] ${i + 1} ${entity.name}`);
    
    try {
      // Build digital-first search query
      const searchQuery = `${entity.name} ${entity.sport || ''} ("digital transformation" OR "mobile app" OR "website development" OR "fan engagement platform" OR "digital RFP" OR "technology partnership")`;
      
      // Call BrightData MCP
      const brightDataResult = await mcp__brightData__search_engine({
        query: searchQuery,
        engine: "google"
      });
      
      await sleep(1000); // Rate limiting
      
      if (brightDataResult && brightDataResult.results && brightDataResult.results.length > 0) {
        const confidence = calculateConfidence(brightDataResult.results);
        
        if (confidence > 0.1) { // Threshold for RFP detection
          const fitScore = calculateFitScore(confidence, entity);
          const urgency = determineUrgency(fitScore, confidence);
          
          console.log(`[ENTITY-FOUND] ${entity.name} (${brightDataResult.results.length} hits, confidence=${confidence.toFixed(2)})`);
          
          // Add to highlights if it's a significant opportunity
          if (confidence > 0.3 || fitScore > 50) {
            const topResult = brightDataResult.results[0];
            results.highlights.push({
              organization: entity.name,
              src_link: topResult.link || '',
              summary_json: {
                title: topResult.title || `${entity.name} Digital Opportunity`,
                confidence: Math.round(confidence * 100) / 100,
                urgency: urgency,
                fit_score: fitScore
              }
            });
          }
          
          results.total_rfps_detected++;
          totalConfidence += confidence;
          totalFitScore += fitScore;
          
          if (fitScore > topScore) {
            topScore = fitScore;
            topOpportunity = entity.name;
          }
        } else {
          console.log(`[ENTITY-NONE] ${entity.name}`);
        }
      } else {
        console.log(`[ENTITY-NONE] ${entity.name}`);
      }
      
    } catch (error) {
      console.error(`[ENTITY-ERROR] ${entity.name}: ${error.message}`);
      console.log(`[ENTITY-NONE] ${entity.name}`);
    }
  }
  
  // Calculate summary statistics
  if (results.total_rfps_detected > 0) {
    results.scoring_summary.avg_confidence = Math.round((totalConfidence / results.total_rfps_detected) * 100) / 100;
    results.scoring_summary.avg_fit_score = Math.round(totalFitScore / results.total_rfps_detected);
  }
  
  results.scoring_summary.top_opportunity = topOpportunity;
  
  // Sort highlights by fit score descending
  results.highlights.sort((a, b) => b.summary_json.fit_score - a.summary_json.fit_score);
  
  console.log(`\nRFP Monitoring Complete:`);
  console.log(`- Entities checked: ${results.entities_checked}`);
  console.log(`- RFPs detected: ${results.total_rfps_detected}`);
  console.log(`- Average confidence: ${results.scoring_summary.avg_confidence}`);
  console.log(`- Average fit score: ${results.scoring_summary.avg_fit_score}`);
  console.log(`- Top opportunity: ${results.scoring_summary.top_opportunity}`);
  
  return results;
}

// Execute the main function
processEntities().then(results => {
  console.log('\n=== FINAL JSON OUTPUT ===');
  console.log(JSON.stringify(results, null, 2));
}).catch(error => {
  console.error('Error in RFP monitoring:', error);
  process.exit(1);
});