#!/usr/bin/env node

/**
 * Quick test script to verify enhanced RFP analysis system
 */

const reliableClaudeService = require('./src/services/ReliableClaudeService.ts');

async function testRFPAnalysis() {
  console.log('🚀 Testing Enhanced RFP Analysis System');
  console.log('=====================================\n');

  const testEntities = [
    'Real Madrid CF',
    'Manchester United', 
    'Chelsea FC',
    'Bayern Munich',
    'PSG Paris Saint-Germain'
  ];

  const results = [];

  for (let i = 0; i < testEntities.length; i++) {
    const entity = testEntities[i];
    console.log(`📊 Testing ${i + 1}/${testEntities.length}: ${entity}`);
    
    try {
      const startTime = Date.now();
      
      // Test the enhanced searchForRFPs method
      const searchResults = await reliableClaudeService.searchForRFPs(
        [entity],
        (progress) => {
          console.log(`  ➡️  ${progress.message}`);
        }
      );
      
      const processingTime = Date.now() - startTime;
      
      // Try to parse the results to count RFP opportunities
      let rfpCount = 0;
      let structured = false;
      
      try {
        const parsed = JSON.parse(searchResults);
        if (parsed.rfpOpportunities && Array.isArray(parsed.rfpOpportunities)) {
          rfpCount = parsed.rfpOpportunities.length;
          structured = true;
        }
      } catch (e) {
        // Count text-based opportunities
        const lines = searchResults.split('\n');
        rfpCount = lines.filter(line => 
          line.includes('RFP') || 
          line.includes('tender') || 
          line.includes('procurement')
        ).length;
      }
      
      results.push({
        entity,
        rfpCount,
        structured,
        processingTime,
        success: true
      });
      
      console.log(`  ✅ Found ${rfpCount} RFP opportunities (${structured ? 'structured' : 'text'}) in ${processingTime}ms\n`);
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}\n`);
      results.push({
        entity,
        rfpCount: 0,
        structured: false,
        processingTime: 0,
        success: false,
        error: error.message
      });
    }
  }

  // Summary
  console.log('🎯 TEST RESULTS SUMMARY');
  console.log('=======================');
  
  const totalTests = results.length;
  const successfulTests = results.filter(r => r.success).length;
  const totalRFPs = results.reduce((sum, r) => sum + r.rfpCount, 0);
  const structuredResults = results.filter(r => r.structured).length;
  const avgProcessingTime = results.filter(r => r.success).reduce((sum, r) => sum + r.processingTime, 0) / successfulTests;

  console.log(`✅ Success Rate: ${successfulTests}/${totalTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`🎯 Total RFPs Found: ${totalRFPs}`);
  console.log(`📊 Structured Results: ${structuredResults}/${successfulTests} (${structuredResults > 0 ? '✅' : '❌'})`);
  console.log(`⏱️  Avg Processing Time: ${avgProcessingTime.toFixed(0)}ms`);
  
  console.log('\n📋 DETAILED RESULTS:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const structure = result.structured ? '📊' : '📝';
    console.log(`${status} ${structure} ${result.entity}: ${result.rfpCount} RFPs (${result.processingTime}ms)`);
    if (!result.success) {
      console.log(`    Error: ${result.error}`);
    }
  });

  // Overall assessment
  console.log('\n🔍 SYSTEM ASSESSMENT:');
  if (successfulTests === totalTests && totalRFPs > 0 && structuredResults > 0) {
    console.log('🎉 EXCELLENT: Enhanced RFP analysis system is working perfectly!');
    console.log('   ✅ All tests passed');
    console.log('   ✅ RFP opportunities detected');  
    console.log('   ✅ Structured output working');
  } else if (successfulTests === totalTests) {
    console.log('⚠️  GOOD: System working but may need RFP detection improvements');
    console.log(`   ✅ All tests passed`);
    console.log(`   ${totalRFPs > 0 ? '✅' : '⚠️'} RFP opportunities: ${totalRFPs} found`);
    console.log(`   ${structuredResults > 0 ? '✅' : '⚠️'} Structured output: ${structuredResults > 0 ? 'Working' : 'Needs improvement'}`);
  } else {
    console.log('❌ NEEDS WORK: System has technical issues to resolve');
    console.log(`   ❌ Success rate: ${((successfulTests/totalTests)*100).toFixed(1)}%`);
  }
}

// Run the test
testRFPAnalysis().catch(console.error);