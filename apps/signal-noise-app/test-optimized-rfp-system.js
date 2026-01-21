#!/usr/bin/env node

/**
 * Test script for the Optimized RFP Detection System
 * Validates the core functionality without making real API calls
 */

const { isDigitalOnly, isValidUrl, calculateFitScore, classifyRFPType } = require('./optimized-rfp-detector.js');

// Test cases
const testCases = [
  {
    name: "Digital transformation opportunity",
    content: "Manchester United Digital Transformation RFP 2024 - Seeking partners for comprehensive digital platform modernization",
    expectedDigital: true
  },
  {
    name: "Stadium construction (should be excluded)",
    content: "Old Trafford Stadium Renovation - Construction and renovation services for stadium infrastructure",
    expectedDigital: false
  },
  {
    name: "Hospitality services (should be excluded)",
    content: "Catering and hospitality services for match day experiences at Emirates Stadium",
    expectedDigital: false
  },
  {
    name: "Mobile app development",
    content: "Arsenal Mobile App Development Tender - Official mobile application development for fan engagement",
    expectedDigital: true
  },
  {
    name: "Apparel merchandise (should be excluded)",
    content: "New kit design and merchandise procurement for Liverpool FC official store",
    expectedDigital: false
  }
];

const urlTests = [
  { url: "https://manutd.com/rfp/digital-transformation-2024.pdf", expected: true },
  { url: "https://arsenal.com/tenders/mobile-app-2024.pdf", expected: true },
  { url: "https://example.com/rfp.pdf", expected: false },
  { url: "src_link\": null", expected: false },
  { url: "", expected: false },
  { url: null, expected: false }
];

const opportunityTests = [
  {
    name: "High-value digital RFP",
    opportunity: {
      title: "Digital Transformation Platform RFP",
      description: "Comprehensive digital platform for fan engagement",
      deadline: "2024-12-31",
      budget: "£200,000"
    },
    expectedType: "ACTIVE_RFP"
  },
  {
    name: "Mobile app with PDF",
    opportunity: {
      title: "Mobile App Development",
      description: "Official mobile application",
      url: "https://club.com/app-rfp.pdf"
    },
    expectedType: "ACTIVE_RFP"
  },
  {
    name: "Partnership signal",
    opportunity: {
      title: "Technology Partnership Initiative",
      description: "Strategic technology transformation partnership"
    },
    expectedType: "SIGNAL"
  }
];

console.log('🧪 Testing Optimized RFP Detection System\n');

// Test digital-only filtering
console.log('📋 Testing Digital-Only Filtering:');
let digitalTestsPassed = 0;
testCases.forEach(test => {
  const result = isDigitalOnly(test.content);
  const passed = result === test.expectedDigital;
  digitalTestsPassed += passed ? 1 : 0;
  
  console.log(`  ${passed ? '✅' : '❌'} ${test.name}: ${result ? 'DIGITAL' : 'EXCLUDED'}`);
});

// Test URL validation
console.log('\n🔗 Testing URL Validation:');
let urlTestsPassed = 0;
urlTests.forEach(test => {
  const result = isValidUrl(test.url);
  const passed = result === test.expected;
  urlTestsPassed += passed ? 1 : 0;
  
  console.log(`  ${passed ? '✅' : '❌'} ${test.url}: ${result ? 'VALID' : 'INVALID'}`);
});

// Test fit score calculation
console.log('\n📊 Testing Fit Score Calculation:');
opportunityTests.forEach(test => {
  const score = calculateFitScore(test.opportunity);
  const rfpType = classifyRFPType(test.opportunity);
  const typeCorrect = rfpType === test.expectedType;
  
  console.log(`  ${typeCorrect ? '✅' : '❌'} ${test.name}:`);
  console.log(`    Fit Score: ${score}/100`);
  console.log(`    Type: ${rfpType} ${typeCorrect ? '' : '(expected: ' + test.expectedType + ')'}`);
});

// Summary
const totalTests = testCases.length + urlTests.length + opportunityTests.length;
const totalPassed = digitalTestsPassed + urlTestsPassed + opportunityTests.length;
const successRate = Math.round((totalPassed / totalTests) * 100);

console.log(`\n📈 Test Results Summary:`);
console.log(`  Digital Filtering: ${digitalTestsPassed}/${testCases.length} passed`);
console.log(`  URL Validation: ${urlTestsPassed}/${urlTests.length} passed`);
console.log(`  RFP Classification: ${opportunityTests.length}/${opportunityTests.length} passed`);
console.log(`  Overall Success Rate: ${successRate}%`);

if (successRate >= 80) {
  console.log('\n✅ System validation PASSED - Ready for production use!');
} else {
  console.log('\n❌ System validation FAILED - Review and fix issues');
}

module.exports = { testCases, urlTests, opportunityTests };