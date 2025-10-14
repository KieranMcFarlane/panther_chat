const neo4j = require('neo4j-driver');

/**
 * Relationship Weighting System for Knowledge Graph
 * 
 * This script adds strength/weight properties to all existing relationships
 * to enable more intelligent graph analysis and scoring.
 */

async function implementRelationshipWeights() {
  console.log('🚀 Implementing Relationship Weights for Knowledge Graph');
  console.log('📊 Adding strength properties to 38,258 relationships across 7 types');
  
  // Neo4j configuration
  const NEO4J_URI = process.env.NEO4J_URI || 'neo4j+s://cce1f84b.databases.neo4j.io';
  const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
  const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'llNASCzMWGT-nTt-JkD9Qk_4W6PpJrv39X0PuYAIKV0';
  
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );
  
  await driver.verifyConnectivity();
  console.log('✅ Connected to Neo4j AuraDB');
  
  const session = driver.session();
  
  try {
    // Get current relationship counts for baseline
    const currentRelCountResult = await session.run('MATCH ()-[r]->() RETURN count(r) as count');
    const currentRelCount = currentRelCountResult.records[0].get('count').toNumber();
    console.log(`📊 Current relationships: ${currentRelCount}`);
    
    const weightStats = {
      PLAYS_IN: { count: 0, totalWeight: 0 },
      LOCATED_IN: { count: 0, totalWeight: 0 },
      PARTICIPATES_IN: { count: 0, totalWeight: 0 },
      COMPETES_WITH: { count: 0, totalWeight: 0 },
      MEMBER_OF: { count: 0, totalWeight: 0 },
      AFFILIATED_WITH: { count: 0, totalWeight: 0 },
      GOVERNED_BY: { count: 0, totalWeight: 0 },
      totalWeighted: 0
    };
    
    // 1. Weight PLAYS_IN relationships (Entity -> Sport)
    console.log('\n🏃 Weighting PLAYS_IN relationships...');
    const playsInWeighted = await weightPlaysInRelationships(session, weightStats);
    
    // 2. Weight LOCATED_IN relationships (Entity -> Country) 
    console.log('\n🌍 Weighting LOCATED_IN relationships...');
    const locatedInWeighted = await weightLocatedInRelationships(session, weightStats);
    
    // 3. Weight PARTICIPATES_IN relationships (Entity -> Tournament)
    console.log('\n🏆 Weighting PARTICIPATES_IN relationships...');
    const participatesInWeighted = await weightParticipatesInRelationships(session, weightStats);
    
    // 4. Weight COMPETES_WITH relationships (League -> League)
    console.log('\n⚔️ Weighting COMPETES_WITH relationships...');
    const competesWithWeighted = await weightCompetesWithRelationships(session, weightStats);
    
    // 5. Weight MEMBER_OF relationships (Club -> League)
    console.log('\n🏢 Weighting MEMBER_OF relationships...');
    const memberOfWeighted = await weightMemberOfRelationships(session, weightStats);
    
    // 6. Weight AFFILIATED_WITH relationships (General affiliations)
    console.log('\n🤝 Weighting AFFILIATED_WITH relationships...');
    const affiliatedWithWeighted = await weightAffiliatedWithRelationships(session, weightStats);
    
    // 7. Weight GOVERNED_BY relationships (Entity -> Federation)
    console.log('\n🏛️ Weighting GOVERNED_BY relationships...');
    const governedByWeighted = await weightGovernedByRelationships(session, weightStats);
    
    // Calculate final statistics
    const totalWeighted = Object.values(weightStats).reduce((sum, stat) => sum + (stat.count || 0), 0) - weightStats.totalWeighted;
    
    console.log('\n🎉 RELATIONSHIP WEIGHTING COMPLETE!');
    console.log(`📊 Total relationships weighted: ${totalWeighted}`);
    
    console.log('\n📋 Weighting Summary by Relationship Type:');
    console.log(`  🏃 PLAYS_IN: ${weightStats.PLAYS_IN.count} relationships, avg weight: ${(weightStats.PLAYS_IN.totalWeight / Math.max(weightStats.PLAYS_IN.count, 1)).toFixed(2)}`);
    console.log(`  🌍 LOCATED_IN: ${weightStats.LOCATED_IN.count} relationships, avg weight: ${(weightStats.LOCATED_IN.totalWeight / Math.max(weightStats.LOCATED_IN.count, 1)).toFixed(2)}`);
    console.log(`  🏆 PARTICIPATES_IN: ${weightStats.PARTICIPATES_IN.count} relationships, avg weight: ${(weightStats.PARTICIPATES_IN.totalWeight / Math.max(weightStats.PARTICIPATES_IN.count, 1)).toFixed(2)}`);
    console.log(`  ⚔️ COMPETES_WITH: ${weightStats.COMPETES_WITH.count} relationships, avg weight: ${(weightStats.COMPETES_WITH.totalWeight / Math.max(weightStats.COMPETES_WITH.count, 1)).toFixed(2)}`);
    console.log(`  🏢 MEMBER_OF: ${weightStats.MEMBER_OF.count} relationships, avg weight: ${(weightStats.MEMBER_OF.totalWeight / Math.max(weightStats.MEMBER_OF.count, 1)).toFixed(2)}`);
    console.log(`  🤝 AFFILIATED_WITH: ${weightStats.AFFILIATED_WITH.count} relationships, avg weight: ${(weightStats.AFFILIATED_WITH.totalWeight / Math.max(weightStats.AFFILIATED_WITH.count, 1)).toFixed(2)}`);
    console.log(`  🏛️ GOVERNED_BY: ${weightStats.GOVERNED_BY.count} relationships, avg weight: ${(weightStats.GOVERNED_BY.totalWeight / Math.max(weightStats.GOVERNED_BY.count, 1)).toFixed(2)}`);
    
    // Verify weighting results
    console.log('\n🔍 Verifying weighting results...');
    await verifyWeightingResults(session);
    
    await session.close();
    await driver.close();
    
    console.log('\n💡 Enhanced Knowledge Graph Capabilities:');
    console.log('✅ Weighted pathfinding for optimal business connections');
    console.log('✅ Relationship strength scoring for opportunity assessment');
    console.log('✅ Enhanced network analysis with weighted centrality measures');
    console.log('✅ Improved entity recommendations based on connection strength');
    
    return {
      success: true,
      stats: {
        totalRelationshipsWeighted: totalWeighted,
        breakdown: weightStats,
        averageWeight: Object.values(weightStats).reduce((sum, stat) => sum + (stat.totalWeight || 0), 0) / Math.max(totalWeighted, 1)
      }
    };
    
  } catch (error) {
    console.error('❌ Relationship weighting failed:', error);
    await session.close();
    throw error;
  }
}

async function weightPlaysInRelationships(session, stats) {
  // Sport importance weights based on global popularity and market size
  const sportWeights = {
    'Football': 0.95, 'Basketball': 0.85, 'Cricket': 0.80, 'Tennis': 0.75,
    'Golf': 0.70, 'Athletics': 0.65, 'Swimming': 0.60, 'Cycling': 0.55,
    'Boxing': 0.50, 'Formula 1': 0.90, 'Motorsport': 0.70, 'Rugby': 0.60,
    'Baseball': 0.75, 'American Football': 0.80, 'Ice Hockey': 0.65,
    'Volleyball': 0.55, 'Handball': 0.45, 'Badminton': 0.40, 'Table Tennis': 0.35,
    'Skiing': 0.50, 'Wrestling': 0.30, 'Archery': 0.25, 'Shooting': 0.25,
    'Fencing': 0.20, 'Karate': 0.40, 'Taekwondo': 0.35, 'Judo': 0.30,
    'Triathlon': 0.45, 'Surfing': 0.40, 'Climbing': 0.30, 'Skateboarding': 0.35,
    'Breaking': 0.25, 'Canoe': 0.20, 'Rowing': 0.35, 'Sailing': 0.30
  };
  
  const result = await session.run(`
    MATCH (e:Entity)-[r:PLAYS_IN]->(s:Sport)
    RETURN r, e.name as entityName, s.name as sportName
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const sportName = record.get('sportName');
    const baseWeight = sportWeights[sportName] || 0.5;
    
    // Adjust weight based on entity tier/prestige
    const entityProperties = relationship.start.properties || {};
    const entityTier = entityProperties.tier || '';
    let tierMultiplier = 1.0;
    if (entityTier.includes('Tier 1') || entityTier.includes('Premier')) tierMultiplier = 1.2;
    else if (entityTier.includes('Tier 2')) tierMultiplier = 1.0;
    else if (entityTier.includes('Tier 3')) tierMultiplier = 0.8;
    
    const finalWeight = Math.min(1.0, baseWeight * tierMultiplier);
    
    await session.run(`
      MATCH ()-[r:PLAYS_IN]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.PLAYS_IN.count = weightedCount;
  stats.PLAYS_IN.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} PLAYS_IN relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightLocatedInRelationships(session, stats) {
  // Country weights based on sports market size and GDP
  const countryWeights = {
    'United States': 0.95, 'China': 0.90, 'United Kingdom': 0.85, 'Germany': 0.80,
    'France': 0.75, 'Japan': 0.75, 'Spain': 0.70, 'Italy': 0.70,
    'Canada': 0.65, 'Australia': 0.65, 'Brazil': 0.60, 'India': 0.85,
    'Netherlands': 0.60, 'Switzerland': 0.55, 'Belgium': 0.50, 'Sweden': 0.50,
    'Norway': 0.45, 'Denmark': 0.45, 'Finland': 0.40, 'Poland': 0.55,
    'Russia': 0.60, 'Turkey': 0.50, 'Mexico': 0.55, 'Argentina': 0.45,
    'South Africa': 0.40, 'Egypt': 0.35, 'Nigeria': 0.30, 'Kenya': 0.35,
    'Ghana': 0.25, 'Ivory Coast': 0.25, 'Morocco': 0.30, 'Tunisia': 0.25,
    'Senegal': 0.25, 'Cameroon': 0.25, 'Algeria': 0.30, 'Libya': 0.20,
    'Sudan': 0.20, 'Ethiopia': 0.25, 'Uganda': 0.20, 'Tanzania': 0.20,
    'Zambia': 0.20, 'Zimbabwe': 0.20, 'Botswana': 0.20, 'Namibia': 0.20,
    'Mozambique': 0.20, 'Angola': 0.25, 'Madagascar': 0.15, 'Mauritius': 0.30,
    'Réunion': 0.15, 'Global': 1.0, 'Europe': 0.85, 'Asia': 0.80,
    'Africa': 0.60, 'Americas': 0.75, 'Oceania': 0.55
  };
  
  const result = await session.run(`
    MATCH (e:Entity)-[r:LOCATED_IN]->(c:Entity)
    WHERE c.type = 'Country' OR c:Country
    RETURN r, e.name as entityName, c.name as countryName
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const countryName = record.get('countryName');
    const baseWeight = countryWeights[countryName] || 0.5;
    
    // Adjust for entity type (clubs, leagues, federations)
    const entityProperties = relationship.start.properties || {};
    const entityType = entityProperties.type || '';
    let typeMultiplier = 1.0;
    if (entityType === 'League' || entityType === 'International Federation') typeMultiplier = 1.1;
    else if (entityType === 'Club') typeMultiplier = 1.0;
    else typeMultiplier = 0.9;
    
    const finalWeight = Math.min(1.0, baseWeight * typeMultiplier);
    
    await session.run(`
      MATCH ()-[r:LOCATED_IN]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.LOCATED_IN.count = weightedCount;
  stats.LOCATED_IN.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} LOCATED_IN relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightParticipatesInRelationships(session, stats) {
  // Tournament weights based on prestige and media value
  const tournamentWeights = {
    'FIFA World Cup': 1.0, 'Olympics': 1.0, 'UEFA Champions League': 0.95,
    'Super Bowl': 0.90, 'NBA Finals': 0.85, 'World Series': 0.80,
    'Wimbledon': 0.85, 'The Masters': 0.80, 'Tour de France': 0.75,
    'Cricket World Cup': 0.80, 'Rugby World Cup': 0.75, 'F1 Championship': 0.85
  };
  
  const result = await session.run(`
    MATCH (e:Entity)-[r:PARTICIPATES_IN]->(t:Entity)
    WHERE t.type = 'Tournament' OR t.name CONTAINS 'Championship' OR t.name CONTAINS 'Cup' OR t.name CONTAINS 'World'
    RETURN r, e.name as entityName, t.name as tournamentName, t.level as level
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const tournamentName = record.get('tournamentName');
    const level = record.get('level');
    
    let baseWeight = 0.5;
    // Check for major tournaments
    for (const [major, weight] of Object.entries(tournamentWeights)) {
      if (tournamentName.includes(major)) {
        baseWeight = weight;
        break;
      }
    }
    
    // Adjust for tournament level
    if (level) {
      if (level.includes('World') || level.includes('International')) baseWeight = Math.min(1.0, baseWeight * 1.2);
      else if (level.includes('Continental')) baseWeight = Math.min(1.0, baseWeight * 1.1);
      else if (level.includes('National')) baseWeight = baseWeight * 1.0;
      else baseWeight = baseWeight * 0.8;
    }
    
    const finalWeight = Math.min(1.0, baseWeight);
    
    await session.run(`
      MATCH ()-[r:PARTICIPATES_IN]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.PARTICIPATES_IN.count = weightedCount;
  stats.PARTICIPATES_IN.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} PARTICIPATES_IN relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightCompetesWithRelationships(session, stats) {
  // League competition weights based on media value and competitive intensity
  const result = await session.run(`
    MATCH (l1:Entity)-[r:COMPETES_WITH]->(l2:Entity)
    WHERE l1.type = 'League' AND l2.type = 'League'
    RETURN r, l1.name as league1, l2.name as league2, l1.sport as sport, l1.tier as tier1, l2.tier as tier2
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const sport = record.get('sport');
    const tier1 = record.get('tier1');
    const tier2 = record.get('tier2');
    
    // Base weight by sport popularity
    const sportWeights = {
      'Football': 0.9, 'Basketball': 0.8, 'Cricket': 0.75, 'Formula 1': 0.85,
      'Tennis': 0.7, 'Golf': 0.65, 'Rugby': 0.6, 'Baseball': 0.7
    };
    let baseWeight = sportWeights[sport] || 0.5;
    
    // Adjust for tier levels (same-tier competitions are more intense)
    if (tier1 && tier2 && tier1 === tier2) {
      if (tier1.includes('Tier 1')) baseWeight *= 1.2;
      else if (tier1.includes('Tier 2')) baseWeight *= 1.1;
      else baseWeight *= 1.0;
    } else {
      baseWeight *= 0.8; // Different tier competitions are less intense
    }
    
    const finalWeight = Math.min(1.0, baseWeight);
    
    await session.run(`
      MATCH ()-[r:COMPETES_WITH]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.COMPETES_WITH.count = weightedCount;
  stats.COMPETES_WITH.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} COMPETES_WITH relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightMemberOfRelationships(session, stats) {
  // Club-league membership weights based on league prestige
  const result = await session.run(`
    MATCH (club:Entity)-[r:MEMBER_OF]->(league:Entity)
    WHERE club.type = 'Club' AND league.type = 'League'
    RETURN r, club.name as clubName, league.name as leagueName, league.tier as leagueTier
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const leagueTier = record.get('leagueTier');
    
    let baseWeight = 0.5;
    if (leagueTier) {
      if (leagueTier.includes('Tier 1')) baseWeight = 0.8;
      else if (leagueTier.includes('Tier 2')) baseWeight = 0.6;
      else if (leagueTier.includes('Tier 3')) baseWeight = 0.4;
      else baseWeight = 0.5;
    }
    
    const finalWeight = Math.min(1.0, baseWeight);
    
    await session.run(`
      MATCH ()-[r:MEMBER_OF]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.MEMBER_OF.count = weightedCount;
  stats.MEMBER_OF.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} MEMBER_OF relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightAffiliatedWithRelationships(session, stats) {
  // General affiliation weights - usually moderate strength
  const result = await session.run(`
    MATCH (e1:Entity)-[r:AFFILIATED_WITH]->(e2:Entity)
    RETURN r, e1.name as entity1, e2.name as entity2, e1.type as type1, e2.type as type2
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const type1 = record.get('type1');
    const type2 = record.get('type2');
    
    let baseWeight = 0.4; // Moderate base weight for affiliations
    
    // Adjust based on entity types
    if (type1 === 'International Federation' || type2 === 'International Federation') {
      baseWeight = 0.7; // Federation affiliations are stronger
    }
    
    const finalWeight = Math.min(1.0, baseWeight);
    
    await session.run(`
      MATCH ()-[r:AFFILIATED_WITH]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.AFFILIATED_WITH.count = weightedCount;
  stats.AFFILIATED_WITH.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} AFFILIATED_WITH relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

async function weightGovernedByRelationships(session, stats) {
  // Governance relationships based on federation authority and scope
  const federationWeights = {
    'FIFA': 1.0, 'UEFA': 0.95, 'IOC': 1.0, 'FIBA': 0.85, 'ICC': 0.80,
    'World Athletics': 0.80, 'FINA': 0.75, 'UCI': 0.70, 'FIVB': 0.65,
    'NHL': 0.75, 'NBA': 0.80, 'NFL': 0.85, 'MLB': 0.75, 'PGA': 0.70
  };
  
  const result = await session.run(`
    MATCH (e:Entity)-[r:GOVERNED_BY]->(f:Entity)
    WHERE f.type = 'International Federation' OR f.type = 'Federation'
    RETURN r, e.name as entityName, f.name as federationName
  `);
  
  let weightedCount = 0;
  let totalWeight = 0;
  
  for (const record of result.records) {
    const relationship = record.get('r');
    const federationName = record.get('federationName');
    
    let baseWeight = 0.6;
    // Check for major federations
    for (const [federation, weight] of Object.entries(federationWeights)) {
      if (federationName.includes(federation)) {
        baseWeight = weight;
        break;
      }
    }
    
    const finalWeight = Math.min(1.0, baseWeight);
    
    await session.run(`
      MATCH ()-[r:GOVERNED_BY]->()
      WHERE id(r) = $relId
      SET r.strength = $weight, r.weight_category = $category
    `, { relId: relationship.identity, weight: finalWeight, category: getWeightCategory(finalWeight) });
    
    weightedCount++;
    totalWeight += finalWeight;
  }
  
  stats.GOVERNED_BY.count = weightedCount;
  stats.GOVERNED_BY.totalWeight = totalWeight;
  console.log(`  ✅ Weighted ${weightedCount} GOVERNED_BY relationships (avg: ${(totalWeight/weightedCount).toFixed(2)})`);
  
  return weightedCount;
}

function getWeightCategory(weight) {
  if (weight >= 0.8) return 'HIGH';
  if (weight >= 0.6) return 'MEDIUM_HIGH';
  if (weight >= 0.4) return 'MEDIUM';
  if (weight >= 0.2) return 'MEDIUM_LOW';
  return 'LOW';
}

async function verifyWeightingResults(session) {
  const verification = await session.run(`
    MATCH ()-[r]->()
    WHERE r.strength IS NOT NULL
    RETURN type(r) as relType, r.weight_category as category, count(*) as count, avg(r.strength) as avgWeight
    ORDER BY relType, avgWeight DESC
  `);
  
  console.log('  📊 Weight verification results:');
  verification.records.forEach(record => {
    console.log(`    ${record.get('relType')}: ${record.get('category')} - ${record.get('count')} relationships (avg: ${record.get('avgWeight').toFixed(2)})`);
  });
}

// Run the weighting implementation
if (require.main === module) {
  implementRelationshipWeights()
    .then((result) => {
      console.log('\n🎉 Relationship weighting completed successfully!');
      console.log('Knowledge graph now has weighted relationships for enhanced analysis.');
      console.log(`Total relationships weighted: ${result.stats.totalRelationshipsWeighted}`);
      console.log(`Average relationship strength: ${result.stats.averageWeight.toFixed(2)}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Relationship weighting failed:', error);
      process.exit(1);
    });
}

module.exports = { implementRelationshipWeights };