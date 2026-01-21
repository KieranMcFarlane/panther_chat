#!/usr/bin/env node

// Manual classification based on known sports entities research
const manualClassifications = [
  // Football Executives and Personalities
  {
    name: "Peter Ridsdale",
    type: "Person",
    confidence: 0.9,
    reasoning: "Former football chairman, known for his roles at Leeds United, Barnsley, and other clubs"
  },
  {
    name: "Vinai Venkatesham OBE", 
    type: "Person",
    confidence: 0.9,
    reasoning: "Chief Executive Officer of Arsenal Football Club, sports executive"
  },
  {
    name: "Garth Lagerwey",
    type: "Person", 
    confidence: 0.9,
    reasoning: "President of Atlanta United FC, former GM of Seattle Sounders, soccer executive"
  },
  {
    name: "Claudio Reyna",
    type: "Person",
    confidence: 0.9,
    reasoning: "Former USMNT captain, former NYCFC sporting director, soccer figure"
  },
  {
    name: "Sharon Brittan",
    type: "Person",
    confidence: 0.8,
    reasoning: "Chairwoman of Sheffield United, football executive"
  },
  
  // Football Club Personnel
  {
    name: "Nick Cox",
    type: "Person",
    confidence: 0.8,
    reasoning: "Academy director or similar role at football clubs"
  },
  {
    name: "Martyn Starnes",
    type: "Person", 
    confidence: 0.8,
    reasoning: "Chief Executive or similar executive role at football clubs"
  },
  {
    name: "Andy Coleman",
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "Gareth Busson",
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "James Turton", 
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "Mark Gonnella",
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "Chris Allen",
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "Bob Symms",
    type: "Person", 
    confidence: 0.7,
    reasoning: "Football executive or director"
  },
  {
    name: "Luke Searle",
    type: "Person",
    confidence: 0.7,
    reasoning: "Football executive or director"
  },

  // Sports Disciplines (already identified but confirming)
  {
    name: "Luge",
    type: "Federation",
    confidence: 0.8,
    reasoning: "Winter sport discipline, would be governed by federation"
  },

  // Football Clubs (these should be clubs)
  {
    name: "Bristol Rovers",
    type: "Club", 
    confidence: 0.9,
    reasoning: "Professional football club in England"
  },
  {
    name: "Northampton Town",
    type: "Club",
    confidence: 0.9,
    reasoning: "Professional football club in England"
  },
  {
    name: "Shrewsbury Town",
    type: "Club",
    confidence: 0.9,
    reasoning: "Professional football club in England"
  },

  // Business/Tech Entities
  {
    name: "Wagmi",
    type: "Technology",
    confidence: 0.6,
    reasoning: "Web3/crypto related term, likely technology company or platform"
  },

  // Countries/Regions (if any remain)
  {
    name: "Global",
    type: "Organization",
    confidence: 0.6,
    reasoning: "Business scope indicator, likely organization"
  }
];

// Generate SQL updates for manual classification
function generateSQLUpdates() {
  console.log("-- Manual Classification Updates for Unknown Entities");
  console.log("-- Generated from research-based classification");
  console.log("");

  manualClassifications.forEach((entity, index) => {
    const updateSQL = `
UPDATE cached_entities 
SET properties = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        properties,
        '{type}',
        '"${entity.type}"'
      ),
      '{classification_confidence}',
      '${entity.confidence}'
    ),
    '{classification_reasoning}',
    '"${entity.reasoning.replace(/'/g, "''")}"'
  ),
  '{classified_at}',
  '"${new Date().toISOString()}"'
)
WHERE properties->>'name' = '${entity.name}'
  AND (properties->>'type' = 'Unknown' OR properties->>'type' IS NULL);
`;

    console.log(updateSQL);
    console.log(`-- Classification ${index + 1}/${manualClassifications.length}: ${entity.name} → ${entity.type}`);
    console.log("");
  });

  console.log(`-- Total: ${manualClassifications.length} manual classifications`);
  console.log("-- Run this SQL to apply all classifications");
}

// Show classification summary
function showClassificationSummary() {
  const summary = manualClassifications.reduce((acc, entity) => {
    acc[entity.type] = (acc[entity.type] || 0) + 1;
    return acc;
  }, {});

  console.log("📊 Classification Summary:");
  console.log("");
  Object.entries(summary).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} entities`);
  });
  console.log("");
  console.log(`Total entities to classify: ${manualClassifications.length}`);
}

if (require.main === module) {
  console.log("🔍 Manual Classification Generator for Unknown Entities");
  console.log("Based on research of sports personalities and organizations");
  console.log("");
  
  showClassificationSummary();
  console.log("");
  console.log("📝 Generated SQL Updates:");
  console.log("");
  
  generateSQLUpdates();
}

module.exports = { manualClassifications, generateSQLUpdates };