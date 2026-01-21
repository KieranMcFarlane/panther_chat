/**
 * Perplexity-based RFP Detection Processor
 * Process 50 entities for digital RFP opportunities using Perplexity MCP
 */

const fs = require('fs');

// Extract 50 unique sports entities from the existing data
const entities = [
  "Nondescripts Cricket Club", "Colombo Cricket Club", "Singha Sports Club", "Sri Lanka Ports Authority", "Bloomfield Cricket Club",
  "Antwerp Giants", "Anwil Włocławek", "Avaí FC", "Bayern Munich (Women)", "Belenenses",
  "Belgrade Partizan (Basketball)", "Belgrade Partizan (Football)", "Belgrade Water Polo", "Benfica", "Barcelona",
  "Leicester City", "Newcastle United", "Wolverhampton Wanderers", "Southampton FC", "Leeds United",
  "Reading FC", "Stoke City", "Preston North End", "Cardiff City", "Swansea City",
  "Sheffield Wednesday", "Ipswich Town", "Queens Park Rangers", "Fulham FC", "Huddersfield Town",
  "Wigan Athletic", "Sunderland AFC", "Juventus", "Lazio", "Fiorentina",
  "Torino", "Hellas Verona", "Genoa", "Empoli", "Spezia",
  "Salernitana", "Bayern Munich", "Borussia Dortmund", "Eintracht Frankfurt", "Wolfsburg",
  "Union Berlin", "TSG Hoffenheim", "FC Köln", "VfL Bochum", "Fortuna Düsseldorf"
];

// Sports mapping for entities
const sportsMap = {
  "Nondescripts Cricket Club": "cricket",
  "Colombo Cricket Club": "cricket", 
  "Singha Sports Club": "cricket",
  "Sri Lanka Ports Authority": "sports",
  "Bloomfield Cricket Club": "cricket",
  "Antwerp Giants": "basketball",
  "Anwil Włocławek": "basketball",
  "Avaí FC": "football",
  "Bayern Munich (Women)": "football",
  "Belenenses": "football",
  "Belgrade Partizan (Basketball)": "basketball",
  "Belgrade Partizan (Football)": "football",
  "Belgrade Water Polo": "water polo",
  "Benfica": "football",
  "Barcelona": "football",
  "Leicester City": "football",
  "Newcastle United": "football",
  "Wolverhampton Wanderers": "football",
  "Southampton FC": "football",
  "Leeds United": "football",
  "Reading FC": "football",
  "Stoke City": "football",
  "Preston North End": "football",
  "Cardiff City": "football",
  "Swansea City": "football",
  "Sheffield Wednesday": "football",
  "Ipswich Town": "football",
  "Queens Park Rangers": "football",
  "Fulham FC": "football",
  "Huddersfield Town": "football",
  "Wigan Athletic": "football",
  "Sunderland AFC": "football",
  "Juventus": "football",
  "Lazio": "football",
  "Fiorentina": "football",
  "Torino": "football",
  "Hellas Verona": "football",
  "Genoa": "football",
  "Empoli": "football",
  "Spezia": "football",
  "Salernitana": "football",
  "Bayern Munich": "football",
  "Borussia Dortmund": "football",
  "Eintracht Frankfurt": "football",
  "Wolfsburg": "football",
  "Union Berlin": "football",
  "TSG Hoffenheim": "football",
  "FC Köln": "football",
  "VfL Bochum": "football",
  "Fortuna Düsseldorf": "football"
};

console.log(`Starting Perplexity-based RFP detection for ${entities.length} entities...`);
console.log("Entities to process:");
entities.forEach((entity, index) => {
  console.log(`${index + 1}. ${entity} (${sportsMap[entity] || 'sports'})`);
});