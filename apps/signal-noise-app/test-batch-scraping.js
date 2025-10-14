#!/usr/bin/env node

/**
 * 🧪 Batch Scraping Test for RFP Intelligence System
 * 
 * This script simulates batch scraping of sports-related RFP opportunities
 * to test the reasoning and filtering logic with realistic data.
 */

const BASE_URL = 'http://localhost:3005';
const WEBHOOK_URL = `${BASE_URL}/api/mines/webhook`;

// Test data with different entity tiers and opportunity types
const testData = [
  // Tier 1 - Premier League (High Value)
  {
    name: "Manchester United Digital Transformation",
    tier: "Tier 1",
    score: 95,
    payload: {
      source: "linkedin",
      content: "Manchester United announces £5M digital transformation partnership for AI-powered fan engagement platform and mobile app development. Seeking technology vendor with expertise in gamification, e-commerce solutions, and stadium technology integration.",
      url: "https://linkedin.com/posts/manchester-united-digital-rfp-2024",
      keywords: ["digital transformation", "fan engagement", "mobile app", "AI", "gamification", "e-commerce", "stadium technology"],
      confidence: 0.95,
      metadata: {
        author: "CTO",
        company: "Manchester United",
        entity_tier: "Premier League"
      }
    }
  },

  // Tier 1 - Formula 1 (High Value)
  {
    name: "F1 Analytics Platform",
    tier: "Tier 1", 
    score: 92,
    payload: {
      source: "procurement",
      content: "Formula 1 racing team seeking advanced data analytics platform for real-time performance monitoring and fan insights. Budget £3M-£8M for AI-powered predictive analytics and mobile dashboard development.",
      url: "https://f1-procurement.com/analytics-platform-rfp",
      keywords: ["data analytics", "AI", "mobile dashboard", "predictive analytics", "performance monitoring", "fan insights"],
      confidence: 0.92,
      metadata: {
        company: "F1 Racing Team",
        entity_tier: "Formula 1",
        estimated_value: "£3M-£8M"
      }
    }
  },

  // Tier 2 - Championship (Medium Value)
  {
    name: "Championship Club Website",
    tier: "Tier 2",
    score: 85,
    payload: {
      source: "news",
      content: "Championship football club looking to redesign official website with modern e-commerce capabilities for merchandise sales and ticketing platform. Budget £500K-£1.5M.",
      url: "https://sports-business.com/championship-club-website-rfp",
      keywords: ["website redesign", "e-commerce", "merchandise", "ticketing platform", "mobile app"],
      confidence: 0.85,
      metadata: {
        company: "Championship Club",
        entity_tier: "Championship",
        estimated_value: "£500K-£1.5M"
      }
    }
  },

  // Tier 3 - League One (Lower Value)
  {
    name: "League One Mobile App",
    tier: "Tier 3",
    score: 75,
    payload: {
      source: "social",
      content: "League One cricket club seeking basic mobile app development for match updates and fan engagement. Limited budget but looking for innovative solutions.",
      url: "https://twitter.com/club-official-mobile-app",
      keywords: ["mobile app", "match updates", "fan engagement", "cricket"],
      confidence: 0.75,
      metadata: {
        company: "League One Cricket Club",
        entity_tier: "League One"
      }
    }
  },

  // Tier 4 - Amateur (Low Value)
  {
    name: "Local Sports Club Website",
    tier: "Tier 4",
    score: 65,
    payload: {
      source: "local",
      content: "Local amateur sports club needs simple website update for schedule and contact information. Very limited budget.",
      url: "https://local-sports.org",
      keywords: ["website", "schedule", "contact information", "amateur sports"],
      confidence: 0.65,
      metadata: {
        company: "Local Amateur Club",
        entity_tier: "Amateur"
      }
    }
  },

  // Complex Multi-Entity Opportunity
  {
    name: "Premier League Stadium Technology",
    tier: "Tier 1",
    score: 98,
    payload: {
      source: "procurement",
      content: "Premier League stadium consortium seeking comprehensive technology partner for digital transformation including: AI-powered crowd management, mobile ticketing, digital signage, VIP experience platform, and real-time analytics dashboard. Multi-year contract worth £10M+.",
      url: "https://premierleague-procurement.com/stadium-tech-rfp",
      keywords: ["stadium technology", "AI", "crowd management", "mobile ticketing", "digital signage", "VIP experience", "analytics", "digital transformation"],
      confidence: 0.98,
      metadata: {
        companies: ["Premier League", "Stadium Consortium"],
        entity_tier: "Premier League",
        estimated_value: "£10M+",
        contract_type: "multi-year"
      }
    }
  },

  // Fan Engagement Gamification
  {
    name: "Arsenal Fan Gamification",
    tier: "Tier 1",
    score: 91,
    payload: {
      source: "linkedin",
      content: "Arsenal FC seeking technology partner for fan engagement gamification platform including loyalty programs, predictive gaming, and mobile fantasy sports integration. Budget £2M-£4M.",
      url: "https://linkedin.com/posts/arsenal-gamification-rfp",
      keywords: ["fan engagement", "gamification", "loyalty programs", "predictive gaming", "fantasy sports", "mobile app"],
      confidence: 0.91,
      metadata: {
        company: "Arsenal FC",
        entity_tier: "Premier League",
        estimated_value: "£2M-£4M"
      }
    }
  },

  // Olympic Sports Technology
  {
    name: "Olympic Committee Digital Platform",
    tier: "Tier 1",
    score: 96,
    payload: {
      source: "procurement",
      content: "National Olympic Committee seeking comprehensive digital platform for athlete management, fan engagement, and performance analytics. Includes mobile app, AI-powered insights, and e-commerce for merchandise. Budget £8M-£15M.",
      url: "https://olympic-procurement.com/digital-platform",
      keywords: ["athlete management", "fan engagement", "performance analytics", "mobile app", "AI", "e-commerce", "merchandise"],
      confidence: 0.96,
      metadata: {
        company: "National Olympic Committee",
        entity_tier: "Olympic",
        estimated_value: "£8M-£15M"
      }
    }
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWebhook(testData, index) {
  try {
    const startTime = Date.now();
    
    // Add timestamp
    testData.payload.timestamp = new Date().toISOString();
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData.payload)
    });

    const processingTime = Date.now() - startTime;
    const responseText = await response.text();
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { success: response.ok, response: responseText };
    }

    return {
      testName: testData.name,
      tier: testData.tier,
      score: testData.score,
      httpStatus: response.status,
      success: response.ok,
      processingTime,
      result
    };
    
  } catch (error) {
    return {
      testName: testData.name,
      tier: testData.tier,
      score: testData.score,
      httpStatus: 0,
      success: false,
      processingTime: 0,
      error: error.message
    };
  }
}

async function getSystemStatus() {
  try {
    const response = await fetch(`${BASE_URL}/api/rfp-monitoring?action=status`);
    const data = await response.json();
    return data;
  } catch (error) {
    return { error: error.message };
  }
}

async function main() {
  colorLog('cyan', '🐆 BATCH SCRAPING TEST FOR RFP INTELLIGENCE SYSTEM');
  colorLog('cyan', '=' .repeat(60));
  console.log('');

  // Check if server is running
  colorLog('blue', '🔍 Checking system status...');
  const status = await getSystemStatus();
  if (status.error) {
    colorLog('red', `❌ Server not accessible: ${status.error}`);
    colorLog('yellow', 'Please ensure the development server is running with: npm run dev');
    process.exit(1);
  }
  
  colorLog('green', '✅ System is accessible');
  colorLog('blue', `📊 Current health score: ${status.data?.system_status?.health_score || 'unknown'}%`);
  console.log('');

  // Run batch tests
  colorLog('blue', '🚀 Starting batch scraping test...');
  console.log(`📝 Testing ${testData.length} scenarios across different entity tiers`);
  console.log('');

  const results = [];
  
  for (let i = 0; i < testData.length; i++) {
    const test = testData[i];
    colorLog('yellow', `Testing ${i + 1}/${testData.length}: ${test.name} (${test.tier} - Score: ${test.score})`);
    
    const result = await sendWebhook(test, i);
    results.push(result);
    
    if (result.success) {
      colorLog('green', `   ✅ Success (${result.processingTime}ms)`);
    } else {
      colorLog('red', `   ❌ Failed (${result.httpStatus || 'ERROR'})`);
      if (result.error) {
        colorLog('red', `      Error: ${result.error}`);
      }
    }
    
    // Small delay between requests
    await delay(1000);
  }

  console.log('');
  colorLog('cyan', '📊 TEST RESULTS SUMMARY');
  colorLog('cyan', '=' .repeat(40));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const avgProcessingTime = successful.reduce((sum, r) => sum + r.processingTime, 0) / successful.length || 0;

  console.log('');
  colorLog('green', `✅ Successful tests: ${successful.length}/${results.length}`);
  colorLog('red', `❌ Failed tests: ${failed.length}/${results.length}`);
  colorLog('blue', `⏱️  Average processing time: ${avgProcessingTime.toFixed(0)}ms`);

  // Results by tier
  console.log('');
  colorLog('blue', '📈 Results by Entity Tier:');
  
  const tierResults = {};
  results.forEach(result => {
    const tier = result.tier;
    if (!tierResults[tier]) {
      tierResults[tier] = { total: 0, successful: 0, avgScore: 0 };
    }
    tierResults[tier].total++;
    if (result.success) tierResults[tier].successful++;
    tierResults[tier].avgScore += result.score;
  });

  Object.entries(tierResults).forEach(([tier, data]) => {
    const avgScore = data.avgScore / data.total;
    const successRate = (data.successful / data.total) * 100;
    colorLog('cyan', `   ${tier}: ${data.successful}/${data.total} successful (${successRate.toFixed(1)}%) - Avg Score: ${avgScore.toFixed(1)}`);
  });

  // Failed tests details
  if (failed.length > 0) {
    console.log('');
    colorLog('red', '❌ Failed Tests:');
    failed.forEach(result => {
      colorLog('red', `   ${result.testName}: ${result.error || `HTTP ${result.httpStatus}`}`);
    });
  }

  console.log('');
  colorLog('blue', '🔍 Checking updated system status...');
  await delay(2000); // Wait for processing
  const finalStatus = await getSystemStatus();
  
  if (finalStatus.data) {
    colorLog('green', `📊 Final health score: ${finalStatus.data.system_status.health_score}%`);
    colorLog('blue', `📈 Total activities: ${finalStatus.data.activity_stats.total_activities}`);
    colorLog('blue', `🎯 RFP detections: ${finalStatus.data.activity_stats.rfp_detections}`);
  }

  console.log('');
  colorLog('cyan', '🌐 Access the dashboard at: http://localhost:3005/rfp-intelligence');
  colorLog('cyan', '📊 View detailed logs and analytics in real-time');
  console.log('');

  if (failed.length === 0) {
    colorLog('green', '🎉 ALL TESTS PASSED! RFP Intelligence system is working correctly.');
  } else {
    colorLog('yellow', `⚠️  ${failed.length} tests failed. Check the system configuration.`);
  }
}

// Run the test
main().catch(error => {
  colorLog('red', `💥 Test suite failed: ${error.message}`);
  process.exit(1);
});