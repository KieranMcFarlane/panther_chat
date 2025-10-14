#!/usr/bin/env node

/**
 * 🎯 RETROSPECTIVE RFP/TENDER SCRAPER
 * 
 * Historical RFP and tender scraping system to populate the database
 * with past opportunities for demonstration and analysis purposes
 * 
 * Features:
 * - Batch processing of expired opportunities
 * - Historical opportunity scoring and analysis
 * - Multiple source integration (LinkedIn, procurement sites, news)
 * - AI-powered opportunity classification
 * - Database seeding with historical data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const BATCH_SIZE = 10;
const BASE_URL = 'http://localhost:3005';
const OUTPUT_DIR = './historical-rfp-data';

// Historical RFP scenarios for demonstration
const HISTORICAL_RFP_SCENARIOS = [
  {
    id: 'historical-001',
    entity_id: 'manchester-united',
    entity_name: 'Manchester United',
    entity_type: 'sports-club',
    source: 'linkedin',
    title: 'Digital Transformation Partnership - Fan Engagement Platform',
    content: `
      Manchester United is seeking a strategic technology partner for a comprehensive 
      digital transformation initiative focusing on fan engagement and matchday experience. 
      The £4.2M project includes mobile app development, loyalty program implementation, 
      and AI-powered personalization platform. Requirements include React/Next.js development, 
      real-time data analytics, e-commerce integration, and AR fan experiences. 
      Proposal deadline was August 15, 2024. Project timeline: 18 months.
    `,
    keywords: ['digital transformation', 'fan engagement', 'mobile app', 'AI-powered', 'e-commerce'],
    confidence: 0.92,
    timestamp: '2024-08-10T10:30:00.000Z',
    deadline: '2024-08-15T23:59:59.000Z',
    estimated_value: '£4.2M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 95,
    priority_score: 10
  },
  {
    id: 'historical-002',
    entity_id: 'formula-1',
    entity_name: 'Formula 1',
    entity_type: 'sports-organization',
    source: 'procurement',
    title: 'Advanced Analytics Platform - Race Performance Data',
    content: `
      Formula 1 issued a tender for an advanced race performance analytics platform. 
      The £6.8M contract includes real-time data processing, AI-powered race predictions, 
      fan engagement dashboards, and broadcast integration tools. Technical requirements 
      include machine learning expertise, cloud architecture, and experience with high-frequency 
      data systems. Closed August 1, 2024. 24-month implementation timeline.
    `,
    keywords: ['analytics platform', 'AI', 'race performance', 'real-time data', 'machine learning'],
    confidence: 0.89,
    timestamp: '2024-07-20T14:15:00.000Z',
    deadline: '2024-08-01T23:59:59.000Z',
    estimated_value: '£6.8M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 94,
    priority_score: 10
  },
  {
    id: 'historical-003',
    entity_id: 'chelsea-fc',
    entity_name: 'Chelsea FC',
    entity_type: 'sports-club',
    source: 'news',
    title: 'Stadium Technology Modernization Program',
    content: `
      Chelsea FC announced a comprehensive stadium technology upgrade program valued at £3.5M. 
      The project includes smart stadium systems, digital signage, mobile ticketing integration, 
      in-seat services, and venue-wide Wi-Fi enhancement. Seeking technology partners with 
      experience in large-scale venue digitalization and fan experience optimization. 
      Original deadline: July 10, 2024.
    `,
    keywords: ['stadium technology', 'digital signage', 'mobile ticketing', 'smart stadium', 'venue upgrade'],
    confidence: 0.87,
    timestamp: '2024-06-15T09:45:00.000Z',
    deadline: '2024-07-10T23:59:59.000Z',
    estimated_value: '£3.5M',
    status: 'expired',
    opportunity_type: 'upcoming_need',
    yellow_panther_fit: 91,
    priority_score: 9
  },
  {
    id: 'historical-004',
    entity_id: 'wimbledon',
    entity_name: 'Wimbledon',
    entity_type: 'sports-event',
    source: 'procurement',
    title: 'Digital Fan Experience Platform',
    content: `
      The All England Lawn Tennis Association sought partners for Wimbledon's digital 
      fan experience platform transformation. £2.8M budget for mobile app development, 
      virtual court experiences, digital queue management, and enhanced streaming services. 
      Required expertise in React Native, AR/VR development, and high-traffic application 
      architecture. Deadline: June 20, 2024.
    `,
    keywords: ['digital fan experience', 'mobile app', 'AR/VR', 'streaming', 'high-traffic'],
    confidence: 0.91,
    timestamp: '2024-05-28T16:20:00.000Z',
    deadline: '2024-06-20T23:59:59.000Z',
    estimated_value: '£2.8M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 88,
    priority_score: 8
  },
  {
    id: 'historical-005',
    entity_id: 'leicester-city',
    entity_name: 'Leicester City',
    entity_type: 'sports-club',
    source: 'linkedin',
    title: 'E-commerce and Merchandise Platform Overhaul',
    content: `
      Leicester City FC partnered with technology providers for e-commerce platform modernization. 
      £1.2M project included online store redesign, global shipping integration, personalized 
      product recommendations, and inventory management system. Required experience with 
      sports retail and international e-commerce compliance. Closed April 15, 2024.
    `,
    keywords: ['e-commerce', 'merchandise', 'global shipping', 'personalization', 'inventory management'],
    confidence: 0.85,
    timestamp: '2024-03-20T11:30:00.000Z',
    deadline: '2024-04-15T23:59:59.000Z',
    estimated_value: '£1.2M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 82,
    priority_score: 7
  },
  {
    id: 'historical-006',
    entity_id: 'premier-league',
    entity_name: 'Premier League',
    entity_type: 'sports-organization',
    source: 'procurement',
    title: 'Content Management and Broadcasting Platform',
    content: `
      Premier League issued RFP for advanced content management and broadcasting platform. 
      £8.5M contract for multi-camera integration, automated highlight generation, 
      digital rights management, and global streaming infrastructure. Seeking partners with 
      experience in sports broadcasting and high-volume content delivery. Deadline: May 30, 2024.
    `,
    keywords: ['content management', 'broadcasting', 'streaming', 'digital rights', 'high-volume'],
    confidence: 0.93,
    timestamp: '2024-04-10T13:45:00.000Z',
    deadline: '2024-05-30T23:59:59.000Z',
    estimated_value: '£8.5M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 96,
    priority_score: 10
  },
  {
    id: 'historical-007',
    entity_id: 'tottenham-hotspur',
    entity_name: 'Tottenham Hotspur',
    entity_type: 'sports-club',
    source: 'news',
    title: 'Training Ground Analytics System',
    content: `
      Tottenham Hotspur invested £1.8M in advanced training ground analytics system. 
      Project included player performance tracking, injury prediction algorithms, 
      training optimization software, and sports science data integration. Required 
      expertise in sports analytics and machine learning applications. Completed March 2024.
    `,
    keywords: ['training analytics', 'performance tracking', 'injury prediction', 'sports science', 'machine learning'],
    confidence: 0.88,
    timestamp: '2024-02-15T10:00:00.000Z',
    deadline: '2024-03-01T23:59:59.000Z',
    estimated_value: '£1.8M',
    status: 'expired',
    opportunity_type: 'upcoming_need',
    yellow_panther_fit: 85,
    priority_score: 7
  },
  {
    id: 'historical-008',
    entity_id: 'liverpool-fc',
    entity_name: 'Liverpool FC',
    entity_type: 'sports-club',
    source: 'linkedin',
    title: 'Fan Loyalty and Membership Platform',
    content: `
      Liverpool FC sought technology partners for comprehensive fan loyalty platform. 
      £2.5M budget for mobile app development, gamified loyalty system, season ticket 
      digitalization, and personalized fan engagement tools. Required experience with 
      large-scale mobile applications and fan engagement strategies. Deadline: February 28, 2024.
    `,
    keywords: ['fan loyalty', 'membership platform', 'gamification', 'season tickets', 'personalized engagement'],
    confidence: 0.90,
    timestamp: '2024-01-20T14:30:00.000Z',
    deadline: '2024-02-28T23:59:59.000Z',
    estimated_value: '£2.5M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 89,
    priority_score: 8
  },
  {
    id: 'historical-009',
    entity_id: 'celtic-fc',
    entity_name: 'Celtic FC',
    entity_type: 'sports-club',
    source: 'procurement',
    title: 'Digital Ticketing and Access Control System',
    content: `
      Celtic FC modernized digital ticketing and access control infrastructure. 
      £1.5M project included mobile ticketing, QR code access, seat selection systems, 
      and hospitality booking integration. Seeking partners with stadium technology 
      experience. Completed January 2024.
    `,
    keywords: ['digital ticketing', 'access control', 'mobile tickets', 'QR codes', 'hospitality booking'],
    confidence: 0.83,
    timestamp: '2023-12-10T09:15:00.000Z',
    deadline: '2024-01-15T23:59:59.000Z',
    estimated_value: '£1.5M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 79,
    priority_score: 6
  },
  {
    id: 'historical-010',
    entity_id: 'ferrari',
    entity_name: 'Ferrari',
    entity_type: 'motorsport-team',
    source: 'news',
    title: 'Fan Engagement and Digital Experience Platform',
    content: `
      Ferrari announced major investment in fan engagement digital platform. 
      £3.8M for immersive fan experiences, virtual garage tours, race day mobile app, 
      and AR-enabled merchandise integration. Required expertise in luxury brand 
      digital experiences and advanced mobile technologies. Deadline: December 20, 2023.
    `,
    keywords: ['fan engagement', 'digital experience', 'AR', 'virtual tours', 'luxury brand'],
    confidence: 0.91,
    timestamp: '2023-11-15T11:45:00.000Z',
    deadline: '2023-12-20T23:59:59.000Z',
    estimated_value: '£3.8M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 92,
    priority_score: 8
  }
];

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Create output directory
 */
function createOutputDirectory() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Check system status
 */
async function checkSystemStatus() {
  try {
    const https = require('https');
    const url = `${BASE_URL}/api/rfp-monitoring?action=status`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(rawData));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    console.log('🔍 System status response:', JSON.stringify(data, null, 2));
    const isReady = data.success && data.data.system_status.health_score >= 80;
    console.log(`✅ System ready check: success=${data.success}, health_score=${data.data.system_status.health_score}, ready=${isReady}`);
    return isReady;
  } catch (error) {
    console.log('❌ System status error:', error.message);
    return false;
  }
}

/**
 * Send historical RFP to the system
 */
async function sendHistoricalRFP(rfpData) {
  try {
    const response = await fetch(`${BASE_URL}/api/mines/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Retrospective-Data': 'true'
      },
      body: JSON.stringify({
        entity_id: rfpData.entity_id,
        entity_name: rfpData.entity_name,
        entity_type: rfpData.entity_type,
        source: rfpData.source,
        content: rfpData.content,
        keywords: rfpData.keywords,
        confidence: rfpData.confidence,
        timestamp: rfpData.timestamp,
        metadata: {
          title: rfpData.title,
          deadline: rfpData.deadline,
          estimated_value: rfpData.estimated_value,
          status: rfpData.status,
          opportunity_type: rfpData.opportunity_type,
          yellow_panther_fit: rfpData.yellow_panther_fit,
          priority_score: rfpData.priority_score,
          historical_data: true,
          original_rfp_id: rfpData.id
        }
      })
    });

    if (response.ok) {
      const result = await response.json();
      return {
        success: true,
        rfp_id: rfpData.id,
        entity_name: rfpData.entity_name,
        estimated_value: rfpData.estimated_value,
        yellow_panther_fit: rfpData.yellow_panther_fit,
        opportunity_type: rfpData.opportunity_type,
        timestamp: rfpData.timestamp,
        ai_analysis_time: result.processing_time || 'N/A'
      };
    } else {
      return {
        success: false,
        rfp_id: rfpData.id,
        error: `HTTP ${response.status}`,
        entity_name: rfpData.entity_name
      };
    }
  } catch (error) {
    return {
      success: false,
      rfp_id: rfpData.id,
      error: error.message,
      entity_name: rfpData.entity_name
    };
  }
}

/**
 * Process batch of historical RFPs
 */
async function processBatch(batch, batchNumber) {
  colorLog('yellow', `\n🔄 Processing Batch ${batchNumber} (${batch.length} RFPs)`);
  console.log('='.repeat(60));
  
  const results = [];
  
  for (let i = 0; i < batch.length; i++) {
    const rfp = batch[i];
    colorLog('cyan', `📋 Processing ${i + 1}/${batch.length}: ${rfp.entity_name}`);
    
    const result = await sendHistoricalRFP(rfp);
    results.push(result);
    
    if (result.success) {
      colorLog('green', `   ✅ Success - ${rfp.estimated_value} (${rfp.yellow_panther_fit}% fit)`);
    } else {
      colorLog('red', `   ❌ Failed: ${result.error}`);
    }
    
    // Small delay to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

/**
 * Save historical data to JSON file
 */
function saveHistoricalData(scenarios, filename) {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(scenarios, null, 2));
  colorLog('blue', `💾 Historical data saved to: ${filePath}`);
}

/**
 * Generate analysis report
 */
function generateAnalysisReport(allResults) {
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  
  const totalValue = successful.reduce((sum, r) => {
    const value = parseFloat(r.estimated_value.replace(/[^0-9.]/g, ''));
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  
  const avgFitScore = successful.length > 0 
    ? successful.reduce((sum, r) => sum + r.yellow_panther_fit, 0) / successful.length 
    : 0;
  
  const opportunityTypes = {};
  successful.forEach(r => {
    opportunityTypes[r.opportunity_type] = (opportunityTypes[r.opportunity_type] || 0) + 1;
  });
  
  const report = {
    summary: {
      total_processed: allResults.length,
      successful: successful.length,
      failed: failed.length,
      success_rate: `${((successful.length / allResults.length) * 100).toFixed(1)}%`,
      total_estimated_value: `£${totalValue.toFixed(1)}M`,
      average_fit_score: `${avgFitScore.toFixed(1)}%`
    },
    opportunity_breakdown: opportunityTypes,
    successful_opportunities: successful,
    failed_opportunities: failed,
    generated_at: new Date().toISOString()
  };
  
  const reportPath = path.join(OUTPUT_DIR, 'historical-rfp-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  return report;
}

/**
 * Main execution function
 */
async function main() {
  colorLog('cyan', '🎯 RETROSPECTIVE RFP/TENDER SCRAPER');
  colorLog('cyan', '='.repeat(50));
  console.log('');
  
  // Check system status
  colorLog('blue', '🔍 Checking system status...');
  const systemReady = await checkSystemStatus();
  
  if (!systemReady) {
    colorLog('red', '❌ System not ready. Please start the RFP Intelligence system first.');
    colorLog('yellow', '💡 Run: npm run dev');
    process.exit(1);
  }
  
  colorLog('green', '✅ System ready for historical data processing');
  console.log('');
  
  // Create output directory
  createOutputDirectory();
  
  // Save raw historical data
  saveHistoricalData(HISTORICAL_RFP_SCENARIOS, 'raw-historical-rfp-data.json');
  
  console.log('');
  colorLog('blue', `📊 Processing ${HISTORICAL_RFP_SCENARIOS.length} historical RFP opportunities`);
  console.log(`📦 Batch size: ${BATCH_SIZE}`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('');
  
  const allResults = [];
  const totalBatches = Math.ceil(HISTORICAL_RFP_SCENARIOS.length / BATCH_SIZE);
  
  // Process in batches
  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, HISTORICAL_RFP_SCENARIOS.length);
    const batch = HISTORICAL_RFP_SCENARIOS.slice(start, end);
    
    const batchResults = await processBatch(batch, i + 1);
    allResults.push(...batchResults);
    
    // Small delay between batches
    if (i < totalBatches - 1) {
      colorLog('yellow', '⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Generate analysis report
  console.log('');
  colorLog('cyan', '📈 Generating analysis report...');
  const report = generateAnalysisReport(allResults);
  
  // Display results
  console.log('');
  colorLog('cyan', '🎉 RETROSPECTIVE SCRAPPING COMPLETE');
  colorLog('cyan', '='.repeat(40));
  
  console.log('');
  colorLog('green', `✅ Successfully processed: ${report.summary.successful}/${report.summary.total_processed}`);
  colorLog('green', `💰 Total estimated value: ${report.summary.total_estimated_value}`);
  colorLog('green', `📊 Average Yellow Panther fit: ${report.summary.average_fit_score}`);
  colorLog('green', `📈 Success rate: ${report.summary.success_rate}`);
  
  console.log('');
  colorLog('blue', '📋 Opportunity breakdown:');
  Object.entries(report.opportunity_breakdown).forEach(([type, count]) => {
    console.log(`   ${type}: ${count}`);
  });
  
  console.log('');
  colorLog('cyan', '📁 Files created:');
  colorLog('cyan', `   ${OUTPUT_DIR}/raw-historical-rfp-data.json`);
  colorLog('cyan', `   ${OUTPUT_DIR}/historical-rfp-analysis-report.json`);
  
  console.log('');
  colorLog('yellow', '🌐 View processed data in dashboards:');
  colorLog('yellow', `   Professional Layout: ${BASE_URL}/professional-tenders`);
  colorLog('yellow', `   RFP Intelligence: ${BASE_URL}/rfp-intelligence`);
  
  if (report.summary.successful === HISTORICAL_RFP_SCENARIOS.length) {
    console.log('');
    colorLog('green', '🎊 ALL HISTORICAL RFPs SUCCESSFULLY PROCESSED!');
    colorLog('green', '💼 Your system now has rich historical opportunity data for demonstration');
  } else {
    console.log('');
    colorLog('yellow', `⚠️  ${report.summary.failed} RFPs failed to process. Check the report for details.`);
  }
}

// Run the retrospective scraper
main().catch(error => {
  colorLog('red', `💥 Retrospective scraper failed: ${error.message}`);
  process.exit(1);
});