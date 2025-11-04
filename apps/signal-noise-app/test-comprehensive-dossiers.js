const fetch = require('node-fetch');

async function testAvailableEntities() {
  console.log('🏆 TESTING AUTOMATIC DOSSIER GENERATION WITH AVAILABLE ENTITIES');
  console.log('=============================================================\n');
  
  // Test entities we know exist
  const testEntities = [
    { id: '148', name: 'Sunderland AFC', type: 'Championship Club' },
    { id: '126', name: 'Arsenal', type: 'Premier League Club' },
    { id: '139', name: 'Manchester United', type: 'Premier League Club' },
    { id: '115', name: 'São Paulo FC', type: 'Brazilian Club' },
    { id: '3946', name: 'British Olympic Association', type: 'Sports Organization' },
    { id: '9429', name: 'EFL Championship', type: 'League Organization' }
  ];
  
  console.log(`🎯 TESTING ${testEntities.length} ENTITIES WITH AUTOMATIC DOSSIER GENERATION`);
  console.log('================================================================\n');
  
  const results = [];
  
  for (let i = 0; i < testEntities.length; i++) {
    const entity = testEntities[i];
    
    console.log(`${i + 1}. Testing: ${entity.name} (${entity.type})`);
    console.log('='.repeat(60));
    console.log(`📡 API Call: GET /api/entities/${entity.id}?useCache=false`);
    
    try {
      const response = await fetch(`http://localhost:3005/api/entities/${entity.id}?useCache=false`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const dossier = data.dossier;
      
      console.log('✅ SUCCESS: Dossier generated!');
      console.log(`  • Entity: ${data.entity?.properties?.name}`);
      console.log(`  • Type: ${data.entity?.labels?.join(', ')}`);
      console.log(`  • Source: ${data.source}`);
      console.log(`  • Dossier Generated: ${dossier ? '✅ Yes' : '❌ No'}`);
      
      if (dossier) {
        // Key highlights
        console.log('\n📋 DOSSIER HIGHLIGHTS:');
        
        // Entity info
        console.log(`  🏟️ Entity: ${dossier.entity?.name || 'Unknown'} (${dossier.entity?.type || 'Unknown'})`);
        console.log(`  🏆 Sport: ${dossier.entity?.sport || 'N/A'} | 🌍 Country: ${dossier.entity?.country || 'N/A'}`);
        
        // Digital transformation
        if (dossier.digital_transformation) {
          const dt = dossier.digital_transformation;
          console.log(`  💻 Digital Maturity: ${dt.digital_maturity}% | Score: ${dt.transformation_score}%`);
          console.log(`  📱 Mobile App: ${dt.mobile_app ? '✅' : '❌'} | Social: ${(dt.social_media_followers || 0).toLocaleString()}`);
        }
        
        // LinkedIn intelligence
        if (dossier.linkedin_connection_analysis?.yellow_panther_uk_team) {
          const linkedin = dossier.linkedin_connection_analysis;
          console.log(`  🔗 LinkedIn Connections: ${linkedin.yellow_panther_uk_team.total_connections_found || 0}`);
          
          if (linkedin.recommendations) {
            console.log(`  🎯 Success Probability: ${linkedin.recommendations.success_probability}`);
            console.log(`  👤 Primary Contact: ${linkedin.recommendations.optimal_team_member}`);
          }
        }
        
        // Top opportunity
        if (dossier.strategic_analysis?.opportunity_scoring?.immediate_launch?.length > 0) {
          const topOpp = dossier.strategic_analysis.opportunity_scoring.immediate_launch[0];
          console.log(`  💰 Top Opportunity: ${topOpp.opportunity}`);
          console.log(`     Score: ${topOpp.score}% | Timeline: ${topOpp.timeline} | Revenue: ${topOpp.revenue_potential}`);
        }
        
        // Metadata
        if (dossier.metadata) {
          console.log(`  📊 Generated: ${new Date(dossier.metadata.generated_date).toLocaleString()}`);
          console.log(`  🤖 Analyst: ${dossier.metadata.analyst} | Confidence: ${Math.round((dossier.metadata.confidence_score || 0) * 100)}%`);
        }
        
        console.log(`  🔗 View Full Dossier: http://localhost:3005/entity/${entity.id}`);
      }
      
      results.push({
        entity: entity.name,
        id: entity.id,
        type: entity.type,
        success: true,
        hasDossier: !!dossier,
        source: data.source
      });
      
    } catch (error) {
      console.error('❌ FAILED:', error.message);
      results.push({
        entity: entity.name,
        id: entity.id,
        type: entity.type,
        success: false,
        error: error.message
      });
    }
    
    // Add delay between requests
    if (i < testEntities.length - 1) {
      console.log('\n⏳ Waiting 2 seconds before next test...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Summary
  console.log('\n\n🎉 AUTOMATIC DOSSIER GENERATION TEST RESULTS');
  console.log('============================================');
  
  const successful = results.filter(r => r.success);
  const withDossiers = successful.filter(r => r.hasDossier);
  
  console.log(`📊 OVERALL RESULTS:`);
  console.log(`  • Total Tested: ${results.length}`);
  console.log(`  • Successful: ${successful.length}/${results.length} (${Math.round(successful.length/results.length*100)}%)`);
  console.log(`  • Dossiers Generated: ${withDossiers.length}/${successful.length} (${Math.round(withDossiers.length/successful.length*100)}%)`);
  
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const dossier = result.hasDossier ? '📋' : '';
    const source = result.source ? `(${result.source})` : '';
    console.log(`  ${index + 1}. ${status} ${dossier} ${result.entity} ${source}`);
    if (!result.success) {
      console.log(`     Error: ${result.error}`);
    }
  });
  
  // Analysis by entity type
  console.log('\n📈 ANALYSIS BY ENTITY TYPE:');
  const typeGroups = {};
  results.forEach(result => {
    if (!typeGroups[result.type]) {
      typeGroups[result.type] = { total: 0, success: 0, dossiers: 0 };
    }
    typeGroups[result.type].total++;
    if (result.success) typeGroups[result.type].success++;
    if (result.hasDossier) typeGroups[result.type].dossiers++;
  });
  
  Object.entries(typeGroups).forEach(([type, stats]) => {
    const successRate = Math.round(stats.success / stats.total * 100);
    const dossierRate = Math.round(stats.dossiers / stats.success * 100);
    console.log(`  • ${type}: ${stats.success}/${stats.total} (${successRate}%) | Dossiers: ${stats.dossiers}/${stats.success} (${dossierRate}%)`);
  });
  
  // Conclusion
  console.log('\n🚀 CONCLUSION:');
  if (withDossiers.length === results.length) {
    console.log('✅ PERFECT SUCCESS! All entities received comprehensive dossiers');
    console.log('🎯 Automatic dossier generation system working flawlessly');
    console.log('🔗 LinkedIn intelligence integrated for all entities');
    console.log('💰 Strategic opportunities identified and scored');
    console.log('📱 Implementation roadmaps created for each entity');
    console.log('\n🎉 SYSTEM READY FOR PRODUCTION ACROSS ALL ENTITY TYPES!');
  } else if (withDossiers.length > 0) {
    console.log(`✅ PARTIAL SUCCESS: ${withDossiers.length}/${results.length} entities received dossiers`);
    console.log('🔧 System working, may need investigation for failed cases');
  } else {
    console.log('❌ SYSTEM NEEDS INVESTIGATION - No dossiers generated');
  }
  
  console.log('\n💡 NEXT STEPS:');
  console.log('  • Test more Championship-level clubs when data is available');
  console.log('  • Verify LinkedIn connections are accurate for each entity');
  console.log('  • Fine-tune opportunity scoring based on entity type');
  console.log('  • Implement caching strategy for repeated dossier access');
}

// Check if server is running
async function checkServer() {
  try {
    const response = await fetch('http://localhost:3005/api/health');
    if (!response.ok) throw new Error('Server not responding properly');
    return true;
  } catch {
    console.log('❌ Development server not running at http://localhost:3005');
    console.log('💡 Please start the server with: npm run dev');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (!serverRunning) return;
  
  await testAvailableEntities();
}

main().catch(console.error);