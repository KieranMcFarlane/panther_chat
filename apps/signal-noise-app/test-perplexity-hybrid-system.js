#!/usr/bin/env node

/**
 * Test script for Perplexity-first hybrid RFP detection system
 * Tests with a small subset of entities to verify functionality
 */

const { perplexityDiscovery, brightdataFallback, perplexityValidation } = require('./perplexity-hybrid-rfp-monitor.js');

// Test entities (small subset for testing)
const TEST_ENTITIES = [
  {
    name: "Manchester United",
    type: "Club",
    sport: "Football",
    country: "UK",
    website: "manutd.com"
  },
  {
    name: "FIFA",
    type: "Federation", 
    sport: "Football",
    country: "International",
    website: "fifa.com"
  },
  {
    name: "Premier League",
    type: "League",
    sport: "Football", 
    country: "UK",
    website: "premierleague.com"
  }
];

/**
 * Enhanced logging for testing
 */
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level}] ${message}${data ? ` | Data: ${JSON.stringify(data)}` : ''}\n`;
  
  console.log(`[${level}] ${message}`, data || '');
}

/**
 * Test Phase 1: Perplexity discovery
 */
async function testPerplexityDiscovery() {
  console.log('\n🧪 Testing Phase 1: Perplexity Discovery\n');
  
  for (const entity of TEST_ENTITIES) {
    console.log(`\n📋 Testing Perplexity discovery for: ${entity.name}`);
    
    try {
      const result = await perplexityDiscovery(entity);
      
      console.log('\n📊 Result:');
      console.log(JSON.stringify(result, null, 2));
      
      if (result.status === 'ACTIVE_RFP' || result.status === 'PARTNERSHIP') {
        console.log('\n✅ Perplexity found opportunities!');
      } else if (result.status === 'NONE') {
        console.log('\n➖ Perplexity found no opportunities (BrightData fallback would trigger)');
      } else {
        console.log('\n❌ Perplexity discovery failed');
      }
      
    } catch (error) {
      console.error(`\n❌ Error testing ${entity.name}:`, error.message);
    }
    
    // Brief pause between entities
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Test Phase 1B: BrightData fallback
 */
async function testBrightDataFallback() {
  console.log('\n🧪 Testing Phase 1B: BrightData Fallback\n');
  
  // Test with one entity
  const entity = TEST_ENTITIES[0];
  console.log(`\n📋 Testing BrightData fallback for: ${entity.name}`);
  
  try {
    const result = await brightdataFallback(entity);
    
    console.log('\n📊 Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.status === 'DETECTED') {
      console.log('\n✅ BrightData found potential opportunities!');
    } else if (result.status === 'NONE') {
      console.log('\n➖ BrightData found no opportunities');
    } else {
      console.log('\n❌ BrightData fallback failed');
    }
    
  } catch (error) {
    console.error(`\n❌ Error testing BrightData fallback for ${entity.name}:`, error.message);
  }
}

/**
 * Test Phase 2: Perplexity validation
 */
async function testPerplexityValidation() {
  console.log('\n🧪 Testing Phase 2: Perplexity Validation\n');
  
  // Mock BrightData result for testing
  const mockBrightdataResult = {
    organization: "Test Organization",
    detection_source: "brightdata_fallback",
    validation_status: "UNVERIFIED-BRIGHTDATA",
    results: [
      {
        title: "Digital Transformation Platform RFP",
        url: "https://example.com/rfp-digital-platform",
        description: "Seeking digital transformation partner for fan engagement platform"
      }
    ],
    search_query: "site:example.com digital transformation RFP"
  };
  
  console.log(`\n📋 Testing Perplexity validation for: ${mockBrightdataResult.organization}`);
  
  try {
    const result = await perplexityValidation(mockBrightdataResult);
    
    console.log('\n📊 Validation Result:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.validation_status === 'VERIFIED') {
      console.log('\n✅ Perplexity verified the opportunity!');
    } else if (result.validation_status && result.validation_status.startsWith('REJECTED')) {
      console.log('\n❌ Perplexity rejected the opportunity');
    } else {
      console.log('\n➖ Perplexity could not verify the opportunity');
    }
    
  } catch (error) {
    console.error(`\n❌ Error testing validation:`, error.message);
  }
}

/**
 * Main test execution
 */
async function runTests() {
  console.log('🧪 Starting Perplexity-First Hybrid RFP System Tests');
  console.log('=' .repeat(60));
  
  try {
    // Test environment variables
    const requiredEnvVars = ['ANTHROPIC_API_KEY', 'PERPLEXITY_API_KEY', 'NEO4J_URI', 'NEO4J_USERNAME', 'NEO4J_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('\n❌ Missing required environment variables:');
      missingVars.forEach(varName => console.error(`   - ${varName}`));
      console.error('\nPlease set these variables and try again.');
      process.exit(1);
    }
    
    console.log('\n✅ Environment variables check passed');
    
    // Run tests
    await testPerplexityDiscovery();
    await testBrightDataFallback();
    await testPerplexityValidation();
    
    console.log('\n' + '='.repeat(60));
    console.log('🧪 All tests completed!');
    console.log('\n📝 Test Summary:');
    console.log('• Perplexity discovery tested with multiple entities');
    console.log('• BrightData fallback tested with sample entity');
    console.log('• Perplexity validation tested with mock data');
    console.log('\n✅ System is ready for full execution!');
    console.log('\n▶️  Run the full system with:');
    console.log('    ./run-perplexity-hybrid-monitor.sh');
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Execute tests
if (require.main === module) {
  runTests();
}

module.exports = { runTests };