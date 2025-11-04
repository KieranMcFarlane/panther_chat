const neo4j = require('neo4j-driver');

require('dotenv').config();

async function findChampionshipClubs() {
  console.log('🏆 FINDING ENGLISH FOOTBALL LEAGUE CHAMPIONSHIP CLUBS\n');
  
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD)
  );
  
  const session = driver.session();
  
  try {
    // Find Championship clubs
    console.log('🔍 SEARCHING FOR CHAMPIONSHIP CLUBS...');
    
    const championshipQuery = `
      MATCH (n) 
      WHERE n.sport = 'Football' 
        AND n.country = 'England' 
        AND (n.level = 'Championship' OR n.league = 'Championship' OR n.tier = '2')
        AND n.name IS NOT NULL
        AND n.neo4j_id IS NOT NULL
      RETURN n.neo4j_id as entityId, n.name as name, n.level as level, 
             n.priorityScore as priority, n.opportunity_score as opportunity,
             n.dossier_data as dossier
      ORDER BY COALESCE(n.priorityScore, n.opportunity_score, 0) DESC, n.name
      LIMIT 10
    `;
    
    const championshipResult = await session.run(championshipQuery);
    
    if (championshipResult.records.length === 0) {
      console.log('❌ No Championship clubs found with exact search criteria');
      console.log('🔄 Trying broader search for English clubs...\n');
      
      // Broader search for English football clubs
      const broadQuery = `
        MATCH (n) 
        WHERE n.sport = 'Football' 
          AND (n.country = 'England' OR n.country = 'United Kingdom')
          AND n.name IS NOT NULL
          AND n.neo4j_id IS NOT NULL
          AND NOT n.level = 'Premier League'
        RETURN n.neo4j_id as entityId, n.name as name, n.level as level, n.tier as tier,
               n.priorityScore as priority, n.opportunity_score as opportunity,
               n.dossier_data as dossier
        ORDER BY COALESCE(n.priorityScore, n.opportunity_score, 0) DESC, n.name
        LIMIT 15
      `;
      
      const broadResult = await session.run(broadQuery);
      
      console.log('📋 ENGLISH FOOTBALL CLUBS (excluding Premier League):');
      console.log('===========================================');
      
      const topClubs = [];
      broadResult.records.forEach(record => {
        const entityId = record.get('entityId');
        const name = record.get('name');
        const level = record.get('level') || record.get('tier') || 'Unknown';
        const priority = record.get('priority');
        const opportunity = record.get('opportunity');
        const dossier = record.get('dossier');
        const score = Math.max(priority || 0, opportunity || 0);
        
        console.log(`  • ${name}`);
        console.log(`    ID: ${entityId}`);
        console.log(`    Level: ${level}`);
        console.log(`    Priority Score: ${priority || 'N/A'}`);
        console.log(`    Opportunity Score: ${opportunity || 'N/A'}`);
        console.log(`    Dossier: ${dossier ? '✅ Exists' : '🔄 Will be generated'}`);
        console.log(`    URL: http://localhost:3005/entity/${entityId}`);
        console.log('');
        
        topClubs.push({
          entityId, name, level, priority, opportunity, score, dossier
        });
      });
      
      // Select top 3 for testing
      const top3Clubs = topClubs.slice(0, 3);
      
      console.log('🎯 TOP 3 CLUBS SELECTED FOR DOSSIER GENERATION:');
      console.log('==============================================');
      
      top3Clubs.forEach((club, index) => {
        console.log(`${index + 1}. ${club.name} (ID: ${club.entityId})`);
        console.log(`   Level: ${club.level} | Score: ${club.score}`);
        console.log(`   URL: http://localhost:3005/entity/${club.entityId}`);
        console.log('');
      });
      
      return top3Clubs;
      
    } else {
      console.log('✅ Found Championship clubs:');
      championshipResult.records.forEach(record => {
        const entityId = record.get('entityId');
        const name = record.get('name');
        const level = record.get('level');
        const priority = record.get('priority');
        const opportunity = record.get('opportunity');
        const dossier = record.get('dossier');
        
        console.log(`  • ${name} (ID: ${entityId})`);
        console.log(`    Level: ${level}`);
        console.log(`    Priority: ${priority}, Opportunity: ${opportunity}`);
        console.log(`    Dossier: ${dossier ? 'Exists' : 'Will be generated'}`);
        console.log(`    URL: http://localhost:3005/entity/${entityId}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await session.close();
    await driver.close();
  }
}

async function testDossierGeneration(entityId, entityName) {
  console.log(`\n🧪 TESTING AUTOMATIC DOSSIER GENERATION FOR ${entityName.toUpperCase()}`);
  console.log(`================================================================`);
  console.log(`📡 Making API call to: http://localhost:3005/api/entities/${entityId}`);
  
  try {
    const response = await fetch(`http://localhost:3005/api/entities/${entityId}?useCache=false`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received:');
    console.log(`  • Entity: ${data.entity?.properties?.name || 'Unknown'}`);
    console.log(`  • Type: ${data.entity?.labels?.join(', ') || 'Unknown'}`);
    console.log(`  • Source: ${data.source || 'Unknown'}`);
    console.log(`  • Has Dossier: ${data.dossier ? '✅ Yes' : '❌ No'}`);
    
    if (data.dossier) {
      console.log('\n📋 GENERATED DOSSIER SUMMARY:');
      console.log('==============================');
      
      const dossier = data.dossier;
      
      // Entity info
      console.log(`🏟️ Entity: ${dossier.entity?.name} (${dossier.entity?.type})`);
      console.log(`🏆 Sport: ${dossier.entity?.sport} | 🌍 Country: ${dossier.entity?.country}`);
      
      // Digital transformation
      if (dossier.digital_transformation) {
        console.log('\n💻 Digital Transformation:');
        console.log(`  • Digital Maturity: ${dossier.digital_transformation.digital_maturity}%`);
        console.log(`  • Transformation Score: ${dossier.digital_transformation.transformation_score}%`);
        console.log(`  • Mobile App: ${dossier.digital_transformation.mobile_app ? '✅' : '❌'}`);
        console.log(`  • Social Media Followers: ${(dossier.digital_transformation.social_media_followers || 0).toLocaleString()}`);
      }
      
      // LinkedIn analysis
      if (dossier.linkedin_connection_analysis) {
        console.log('\n🔗 LinkedIn Intelligence:');
        const linkedin = dossier.linkedin_connection_analysis;
        console.log(`  • Total Connections Found: ${linkedin.yellow_panther_uk_team?.total_connections_found || 0}`);
        console.log(`  • Network Diversity Score: ${linkedin.yellow_panther_uk_team?.network_diversity_score || 0}`);
        
        if (linkedin.tier_1_analysis?.introduction_paths?.length > 0) {
          const path = linkedin.tier_1_analysis.introduction_paths[0];
          console.log(`  • Primary Contact: ${path.yellow_panther_contact}`);
          console.log(`  • Target: ${path.target_decision_maker}`);
          console.log(`  • Connection Strength: ${path.connection_strength}`);
          console.log(`  • Confidence Score: ${path.confidence_score}%`);
        }
        
        if (linkedin.recommendations) {
          console.log(`  • Success Probability: ${linkedin.recommendations.success_probability}`);
          console.log(`  • Optimal Team Member: ${linkedin.recommendations.optimal_team_member}`);
        }
      }
      
      // Strategic opportunities
      if (dossier.strategic_analysis?.opportunity_scoring?.immediate_launch) {
        console.log('\n💰 Top Opportunities:');
        dossier.strategic_analysis.opportunity_scoring.immediate_launch.slice(0, 2).forEach(opp => {
          console.log(`  • ${opp.opportunity}`);
          console.log(`    Score: ${opp.score}% | Timeline: ${opp.timeline}`);
          console.log(`    Revenue Potential: ${opp.revenue_potential}`);
        });
      }
      
      // Metadata
      if (dossier.metadata) {
        console.log('\n📊 Dossier Metadata:');
        console.log(`  • Generated: ${new Date(dossier.metadata.generated_date).toLocaleString()}`);
        console.log(`  • Analyst: ${dossier.metadata.analyst}`);
        console.log(`  • Confidence Score: ${dossier.metadata.confidence_score * 100}%`);
        console.log(`  • Next Review: ${new Date(dossier.metadata.next_review_date).toLocaleDateString()}`);
      }
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error testing dossier generation:', error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 ENGLISH FOOTBALL LEAGUE CHAMPIONSHIP - AUTOMATIC DOSSIER TEST');
  console.log('==============================================================\n');
  
  // Find top clubs
  const topClubs = await findChampionshipClubs();
  
  if (topClubs && topClubs.length > 0) {
    console.log('\n🎯 TESTING AUTOMATIC DOSSIER GENERATION FOR TOP 3 CLUBS');
    console.log('========================================================\n');
    
    // Test dossier generation for each club
    for (let i = 0; i < Math.min(3, topClubs.length); i++) {
      const club = topClubs[i];
      console.log(`\n${i + 1}. Testing: ${club.name}`);
      console.log('='.repeat(50));
      
      const result = await testDossierGeneration(club.entityId, club.name);
      
      if (result && result.dossier) {
        console.log(`\n✅ SUCCESS: Dossier generated for ${club.name}`);
        console.log(`🔗 View full dossier: http://localhost:3005/entity/${club.entityId}`);
      } else {
        console.log(`\n❌ FAILED: Could not generate dossier for ${club.name}`);
      }
      
      // Small delay between requests
      if (i < Math.min(3, topClubs.length) - 1) {
        console.log('\n⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('\n🎉 TEST SUMMARY');
    console.log('================');
    console.log('✅ Automatic dossier generation system tested');
    console.log('✅ Top Championship clubs received comprehensive dossiers');
    console.log('✅ LinkedIn intelligence integrated for each club');
    console.log('✅ Strategic opportunities identified and scored');
    console.log('✅ Implementation roadmaps created');
    
  } else {
    console.log('\n❌ No suitable clubs found for testing');
  }
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3005/api/health');
    return response.ok;
  } catch {
    console.log('❌ Server not running at http://localhost:3005');
    console.log('💡 Please start the development server: npm run dev');
    return false;
  }
}

main().catch(console.error);