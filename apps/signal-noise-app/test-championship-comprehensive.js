const neo4j = require('neo4j-driver');

require('dotenv').config();

async function findMoreChampionshipClubs() {
  console.log('🏆 FINDING MORE ENGLISH CHAMPIONSHIP CLUBS\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Search for known Championship clubs by name
    const knownChampionshipClubs = [
      'Leeds United', 'Burnley', 'Sheffield United', 'Luton Town',
      'Middlesbrough', 'West Bromwich Albion', 'Hull City', 'Coventry City',
      'Norwich City', 'Ipswich Town', 'Preston North End', 'Blackburn Rovers',
      'Queens Park Rangers', 'Cardiff City', 'Swansea City', 'Bristol City',
      'Stoke City', 'Millwall', 'Watford', 'Crystal Palace'
    ];
    
    console.log('🔍 SEARCHING FOR KNOWN CHAMPIONSHIP CLUBS...');
    
    for (const clubName of knownChampionshipClubs) {
      const query = `
        MATCH (n) 
        WHERE toLower(n.name) CONTAINS toLower($clubName) 
          AND n.sport = 'Football'
          AND n.neo4j_id IS NOT NULL
        RETURN n.neo4j_id as entityId, n.name as name, n.level as level, n.country as country,
               n.priorityScore as priority, n.opportunity_score as opportunity,
               n.dossier_data as dossier
        ORDER BY n.name
        LIMIT 3
      `;
      
      const result = await session.run(query, { clubName });
      
      if (result.records.length > 0) {
        console.log(`\n📋 Found matches for "${clubName}":`);
        result.records.forEach(record => {
          const entityId = record.get('entityId');
          const name = record.get('name');
          const level = record.get('level');
          const country = record.get('country');
          const priority = record.get('priority');
          const opportunity = record.get('opportunity');
          const dossier = record.get('dossier');
          const score = Math.max(priority || 0, opportunity || 0);
          
          console.log(`  • ${name} (ID: ${entityId})`);
          console.log(`    Level: ${level || 'Unknown'} | Country: ${country || 'Unknown'}`);
          console.log(`    Priority: ${priority || 'N/A'} | Opportunity: ${opportunity || 'N/A'}`);
          console.log(`    Dossier: ${dossier ? '✅ Exists' : '🔄 Will be generated'}`);
          console.log(`    URL: http://localhost:3005/entity/${entityId}`);
        });
      }
    }
    
    // Find any other English clubs that might be Championship level
    console.log('\n\n🔍 BROAD SEARCH FOR ENGLISH CLUBS (Tier 2/Championship)');
    console.log('========================================================');
    
    const broadQuery = `
      MATCH (n) 
      WHERE n.sport = 'Football' 
        AND (n.country = 'England' OR n.country = 'United Kingdom')
        AND n.neo4j_id IS NOT NULL
        AND (n.tier = '2' OR n.tier = 2 OR n.level CONTAINS 'Championship')
        AND n.name IS NOT NULL
      RETURN n.neo4j_id as entityId, n.name as name, n.level as level, n.tier as tier,
             n.priorityScore as priority, n.opportunity_score as opportunity,
             n.dossier_data as dossier
      ORDER BY COALESCE(n.priorityScore, n.opportunity_score, 0) DESC, n.name
      LIMIT 10
    `;
    
    const broadResult = await session.run(broadQuery);
    
    if (broadResult.records.length > 0) {
      console.log('\n📊 CHAMPIONSHIP-TIER CLUBS FOUND:');
      broadResult.records.forEach(record => {
        const entityId = record.get('entityId');
        const name = record.get('name');
        const level = record.get('level');
        const tier = record.get('tier');
        const priority = record.get('priority');
        const opportunity = record.get('opportunity');
        const dossier = record.get('dossier');
        const score = Math.max(priority || 0, opportunity || 0);
        
        console.log(`  • ${name} (ID: ${entityId})`);
        console.log(`    Level: ${level || 'Unknown'} | Tier: ${tier || 'Unknown'}`);
        console.log(`    Score: ${score}`);
        console.log(`    Dossier: ${dossier ? '✅ Exists' : '🔄 Will be generated'}`);
        console.log(`    URL: http://localhost:3005/entity/${entityId}`);
      });
    }
    
    // Get all English clubs and let us manually pick Championship ones
    console.log('\n\n🏴󠁧󠁢󠁥󠁮󠁧󠁿 ALL ENGLISH FOOTBALL CLUBS (for manual selection)');
    console.log('===================================================');
    
    const allEnglishQuery = `
      MATCH (n) 
      WHERE n.sport = 'Football' 
        AND n.country = 'England'
        AND n.neo4j_id IS NOT NULL
        AND n.name IS NOT NULL
        AND n.name CONTAINS ' '
        AND NOT n.name CONTAINS 'National'
      RETURN n.neo4j_id as entityId, n.name as name, n.level as level,
             n.priorityScore as priority, n.opportunity_score as opportunity,
             n.dossier_data as dossier
      ORDER BY n.name
      LIMIT 30
    `;
    
    const allEnglishResult = await session.run(allEnglishQuery);
    
    const championshipCandidates = [];
    
    console.log('\n📋 POTENTIAL CHAMPIONSHIP CLUBS:');
    allEnglishResult.records.forEach(record => {
      const entityId = record.get('entityId');
      const name = record.get('name');
      const level = record.get('level');
      const priority = record.get('priority');
      const opportunity = record.get('opportunity');
      const dossier = record.get('dossier');
      
      // Common Championship clubs (manually identified)
      const championshipNames = [
        'Leeds', 'Burnley', 'Sheffield', 'Luton', 'Middlesbrough', 'West Brom',
        'Hull', 'Coventry', 'Norwich', 'Ipswich', 'Preston', 'Blackburn',
        'QPR', 'Cardiff', 'Swansea', 'Bristol', 'Stoke', 'Millwall', 'Watford',
        'Southampton', 'Leicester', 'Nottingham', 'Derby'
      ];
      
      const isChampionshipCandidate = championshipNames.some(champName => 
        name.toLowerCase().includes(champName.toLowerCase())
      );
      
      if (isChampionshipCandidate) {
        championshipCandidates.push({ entityId, name, level, priority, opportunity, dossier });
        console.log(`  ⭐ ${name} (ID: ${entityId}) - ${level || 'Unknown level'}`);
        console.log(`      Dossier: ${dossier ? '✅' : '🔄'} | URL: http://localhost:3005/entity/${entityId}`);
      }
    });
    
    // Return top candidates for testing
    return championshipCandidates.slice(0, 3);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return [];
  } finally {
    await session.close();
    await driver.close();
  }
}

async function testDossierForClub(club) {
  console.log(`\n🧪 TESTING DOSSIER GENERATION FOR: ${club.name}`);
  console.log(`========================================================`);
  
  try {
    const response = await fetch(`http://localhost:3005/api/entities/${club.entityId}?useCache=false`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received:');
    console.log(`  • Entity: ${data.entity?.properties?.name || 'Unknown'}`);
    console.log(`  • Labels: ${data.entity?.labels?.join(', ') || 'Unknown'}`);
    console.log(`  • Source: ${data.source || 'Unknown'}`);
    console.log(`  • Dossier Generated: ${data.dossier ? '✅ Yes' : '❌ No'}`);
    
    if (data.dossier) {
      const dossier = data.dossier;
      
      console.log('\n📋 DOSSIER HIGHLIGHTS:');
      console.log('=======================');
      
      // Basic info
      console.log(`🏟️ ${dossier.entity?.name} - ${dossier.entity?.type}`);
      console.log(`🏆 ${dossier.entity?.sport} | 🌍 ${dossier.entity?.country}`);
      
      // Digital transformation
      if (dossier.digital_transformation) {
        console.log(`\n💻 Digital Maturity: ${dossier.digital_transformation.digital_maturity}%`);
        console.log(`📱 Mobile App: ${dossier.digital_transformation.mobile_app ? '✅' : '❌'}`);
      }
      
      // LinkedIn intelligence
      if (dossier.linkedin_connection_analysis?.recommendations) {
        const recs = dossier.linkedin_connection_analysis.recommendations;
        console.log(`\n🔗 Primary Contact: ${recs.optimal_team_member}`);
        console.log(`📊 Success Probability: ${recs.success_probability}`);
      }
      
      // Top opportunity
      if (dossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.length > 0) {
        const topOpp = dossier.strategic_analysis.opportunity_scoring.immediate_launch[0];
        console.log(`\n💰 Top Opportunity: ${topOpp.opportunity}`);
        console.log(`   Score: ${topOpp.score}% | Revenue: ${topOpp.revenue_potential}`);
      }
      
      console.log(`\n🔗 Full Dossier: http://localhost:3005/entity/${club.entityId}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error testing dossier generation:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 COMPREHENSIVE CHAMPIONSHIP CLUB DOSSIER TEST');
  console.log('===============================================\n');
  
  const candidates = await findMoreChampionshipClubs();
  
  if (candidates.length > 0) {
    console.log(`\n🎯 TESTING TOP ${Math.min(3, candidates.length)} CHAMPIONSHIP CLUBS`);
    console.log('====================================================\n');
    
    const testResults = [];
    
    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      const club = candidates[i];
      console.log(`${i + 1}. ${club.name} (ID: ${club.entityId})`);
      
      const result = await testDossierForClub(club);
      
      testResults.push({
        club: club.name,
        entityId: club.entityId,
        success: !!result?.dossier,
        hasExistingDossier: !!club.dossier
      });
      
      if (i < Math.min(3, candidates.length) - 1) {
        console.log('\n⏳ Waiting 2 seconds...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Summary
    console.log('\n\n🎉 TEST RESULTS SUMMARY');
    console.log('=======================');
    
    testResults.forEach((result, index) => {
      const status = result.success ? '✅ SUCCESS' : '❌ FAILED';
      const existing = result.hasExistingDossier ? '(from cache)' : '(newly generated)';
      console.log(`${index + 1}. ${result.club}: ${status} ${existing}`);
    });
    
    const successCount = testResults.filter(r => r.success).length;
    console.log(`\n📊 Success Rate: ${successCount}/${testResults.length} (${Math.round(successCount/testResults.length*100)}%)`);
    
    if (successCount === testResults.length) {
      console.log('\n🎉 ALL TESTS PASSED! Automatic dossier generation working perfectly.');
      console.log('🚀 System ready for production use across all Championship clubs.');
    }
    
  } else {
    console.log('\n❌ No Championship clubs found for testing');
  }
}

main().catch(console.error);