#!/usr/bin/env node

/**
 * 🎯 BATCH HISTORICAL RFP PROCESSOR
 * 
 * Advanced batch processing system for large-scale historical RFP data
 * 
 * Features:
 * - Configurable batch sizes and timing
 * - Progress tracking and resumption
 * - Error handling and retry logic
 * - Historical data enrichment
 * - Multiple export formats
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const CONFIG = {
  batchSize: 5,
  batchDelay: 2000, // 2 seconds between batches
  itemDelay: 500,   // 500ms between items
  maxRetries: 3,
  outputDir: './historical-rfp-data',
  progressFile: './historical-rfp-data/progress.json'
};

// Extended historical scenarios (more data for demonstration)
const EXTENDED_HISTORICAL_SCENARIOS = [
  // Premier League Opportunities
  {
    id: 'epl-001',
    entity_id: 'manchester-united',
    entity_name: 'Manchester United',
    entity_type: 'sports-club',
    source: 'procurement',
    title: 'Global Mobile Application Development Partnership',
    content: 'Manchester United seeks technology partners for global mobile application development. £8M project including iOS/Android apps, fan engagement features, live streaming integration, and e-commerce capabilities. Must support multiple languages and global payment systems.',
    keywords: ['mobile app', 'global deployment', 'fan engagement', 'e-commerce', 'live streaming'],
    confidence: 0.94,
    timestamp: '2024-01-15T10:00:00.000Z',
    deadline: '2024-02-28T23:59:59.000Z',
    estimated_value: '£8M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 96,
    priority_score: 10
  },
  {
    id: 'epl-002',
    entity_id: 'liverpool-fc',
    entity_name: 'Liverpool FC',
    entity_type: 'sports-club',
    source: 'linkedin',
    title: 'AI-Powered Performance Analytics Platform',
    content: 'Liverpool FC announces £3.5M investment in AI-powered performance analytics. Platform will include player tracking, injury prediction, tactical analysis, and fan-facing statistics dashboards. Seeking AI/ML expertise with sports industry experience.',
    keywords: ['AI analytics', 'performance tracking', 'injury prediction', 'machine learning'],
    confidence: 0.91,
    timestamp: '2024-02-10T14:30:00.000Z',
    deadline: '2024-03-20T23:59:59.000Z',
    estimated_value: '£3.5M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 92,
    priority_score: 9
  },
  {
    id: 'epl-003',
    entity_id: 'chelsea-fc',
    entity_name: 'Chelsea FC',
    entity_type: 'sports-club',
    source: 'news',
    title: 'Stadium Digital Experience Overhaul',
    content: 'Chelsea FC embarks on £5.2M stadium digital transformation. Project includes smart seating, mobile ordering, AR wayfinding, digital hospitality services, and venue-wide connectivity enhancement. Requires large venue technology expertise.',
    keywords: ['stadium technology', 'digital experience', 'AR wayfinding', 'mobile ordering'],
    confidence: 0.89,
    timestamp: '2024-03-05T09:15:00.000Z',
    deadline: '2024-04-15T23:59:59.000Z',
    estimated_value: '£5.2M',
    status: 'expired',
    opportunity_type: 'upcoming_need',
    yellow_panther_fit: 90,
    priority_score: 9
  },
  // Formula 1 Opportunities  
  {
    id: 'f1-001',
    entity_id: 'mercedes-f1',
    entity_name: 'Mercedes-AMG Petronas F1',
    entity_type: 'motorsport-team',
    source: 'procurement',
    title: 'Real-Time Race Strategy Simulation Platform',
    content: 'Mercedes F1 team seeks £4.8M real-time race strategy simulation platform. Must process telemetry data, weather conditions, tire degradation, and provide strategic recommendations. Required: advanced mathematics, real-time processing, F1 experience.',
    keywords: ['race strategy', 'real-time simulation', 'telemetry processing', 'advanced analytics'],
    confidence: 0.93,
    timestamp: '2024-01-20T11:00:00.000Z',
    deadline: '2024-02-25T23:59:59.000Z',
    estimated_value: '£4.8M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 95,
    priority_score: 10
  },
  {
    id: 'f1-002',
    entity_id: 'red-bull-racing',
    entity_name: 'Red Bull Racing',
    entity_type: 'motorsport-team',
    source: 'linkedin',
    title: 'Fan Engagement Digital Ecosystem',
    content: 'Red Bull Racing invests £6M in comprehensive fan engagement ecosystem. Includes virtual garage tours, driver interaction apps, race day mobile experiences, and social media integration platform. Seeking cutting-edge digital experience agencies.',
    keywords: ['fan engagement', 'virtual experiences', 'mobile apps', 'social integration'],
    confidence: 0.90,
    timestamp: '2024-02-15T16:45:00.000Z',
    deadline: '2024-03-30T23:59:59.000Z',
    estimated_value: '£6M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 94,
    priority_score: 10
  },
  // Major Competition Opportunities
  {
    id: 'comp-001',
    entity_id: 'uefa-champions-league',
    entity_name: 'UEFA Champions League',
    entity_type: 'sports-competition',
    source: 'procurement',
    title: 'Digital Broadcasting Enhancement Platform',
    content: 'UEFA announces £12M digital broadcasting platform enhancement for Champions League. Includes multi-angle streaming, interactive viewer features, real-time statistics overlay, and global content delivery network. Seeking broadcast technology specialists.',
    keywords: ['digital broadcasting', 'multi-angle streaming', 'interactive features', 'CDN'],
    confidence: 0.95,
    timestamp: '2024-01-10T08:30:00.000Z',
    deadline: '2024-02-20T23:59:59.000Z',
    estimated_value: '£12M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 97,
    priority_score: 10
  },
  {
    id: 'comp-002',
    entity_id: 'olympics-2024',
    entity_name: 'Paris Olympics 2024',
    entity_type: 'sports-event',
    source: 'news',
    title: 'Volunteer and Spectator Mobile Application',
    content: 'Paris Olympics 2024 launches £7.5M mobile application project. Includes volunteer coordination, spectator services, venue navigation, event schedules, and multi-language support. Requires large-scale mobile app development experience.',
    keywords: ['mobile app', 'volunteer coordination', 'venue navigation', 'multi-language'],
    confidence: 0.92,
    timestamp: '2024-01-25T13:20:00.000Z',
    deadline: '2024-03-10T23:59:59.000Z',
    estimated_value: '£7.5M',
    status: 'expired',
    opportunity_type: 'upcoming_need',
    yellow_panther_fit: 93,
    priority_score: 10
  },
  // Championship Opportunities
  {
    id: 'champ-001',
    entity_id: 'leeds-united',
    entity_name: 'Leeds United',
    entity_type: 'sports-club',
    source: 'linkedin',
    title: 'Digital Membership and Ticketing Platform',
    content: 'Leeds United seeks £2.2M digital membership and ticketing platform. Includes season ticket management, membership benefits, hospitality booking, and digital fan ID system. Seeking sports technology providers with membership system experience.',
    keywords: ['membership platform', 'digital ticketing', 'hospitality booking', 'fan ID'],
    confidence: 0.86,
    timestamp: '2024-02-05T10:45:00.000Z',
    deadline: '2024-03-15T23:59:59.000Z',
    estimated_value: '£2.2M',
    status: 'expired',
    opportunity_type: 'direct_rfp',
    yellow_panther_fit: 84,
    priority_score: 7
  },
  {
    id: 'champ-002',
    entity_id: 'southampton-fc',
    entity_name: 'Southampton FC',
    entity_type: 'sports-club',
    source: 'procurement',
    title: 'Youth Academy Performance Tracking System',
    content: 'Southampton FC invests £1.8M in youth academy performance tracking system. Includes young player development monitoring, skill assessment tools, recruitment analytics, and parent communication portal. Requires youth sports development expertise.',
    keywords: ['youth academy', 'performance tracking', 'skill assessment', 'recruitment analytics'],
    confidence: 0.84,
    timestamp: '2024-03-01T14:00:00.000Z',
    deadline: '2024-04-05T23:59:59.000Z',
    estimated_value: '£1.8M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 81,
    priority_score: 6
  },
  // Rugby Opportunities
  {
    id: 'rugby-001',
    entity_id: 'six-nations',
    entity_name: 'Six Nations Championship',
    entity_type: 'sports-competition',
    source: 'procurement',
    title: 'Match Analytics and Fan Engagement Platform',
    content: 'Six Nations Championship announces £4.5M digital platform project. Includes real-time match statistics, fan engagement features, fantasy league integration, and broadcast enhancement tools. Seeking rugby analytics specialists.',
    keywords: ['match analytics', 'fan engagement', 'fantasy league', 'broadcast enhancement'],
    confidence: 0.88,
    timestamp: '2024-02-20T11:30:00.000Z',
    deadline: '2024-04-01T23:59:59.000Z',
    estimated_value: '£4.5M',
    status: 'expired',
    opportunity_type: 'tender',
    yellow_panther_fit: 87,
    priority_score: 8
  },
  {
    id: 'rugby-002',
    entity_id: 'england-rugby',
    entity_name: 'England Rugby',
    entity_type: 'sports-organization',
    source: 'linkedin',
    title: 'Stadium Twickenham Digital Transformation',
    content: 'England Rugby invests £3.8M in Twickenham Stadium digital transformation. Includes connected stadium technology, mobile concessions, enhanced Wi-Fi, digital hospitality, and fan experience apps. Requires large venue expertise.',
    keywords: ['stadium transformation', 'connected venue', 'mobile concessions', 'fan experience'],
    confidence: 0.90,
    timestamp: '2024-01-30T09:00:00.000Z',
    deadline: '2024-03-20T23:59:59.000Z',
    estimated_value: '£3.8M',
    status: 'expired',
    opportunity_type: 'upcoming_need',
    yellow_panther_fit: 89,
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
 * Progress tracking
 */
class ProgressTracker {
  constructor(filePath) {
    this.filePath = filePath;
    this.progress = this.loadProgress();
  }

  loadProgress() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
    } catch (error) {
      // File doesn't exist or is corrupted
    }
    return {
      processed: [],
      failed: [],
      currentBatch: 0,
      startTime: null,
      lastUpdate: null
    };
  }

  saveProgress() {
    this.progress.lastUpdate = new Date().toISOString();
    fs.writeFileSync(this.filePath, JSON.stringify(this.progress, null, 2));
  }

  markProcessed(itemId) {
    if (!this.progress.processed.includes(itemId)) {
      this.progress.processed.push(itemId);
      this.saveProgress();
    }
  }

  markFailed(itemId, error) {
    this.progress.failed.push({
      id: itemId,
      error,
      timestamp: new Date().toISOString()
    });
    this.saveProgress();
  }

  updateBatch(batchNumber) {
    this.progress.currentBatch = batchNumber;
    this.saveProgress();
  }

  setStartTime() {
    this.progress.startTime = new Date().toISOString();
    this.saveProgress();
  }

  getProcessedItems() {
    return this.progress.processed;
  }

  getUnprocessedItems(allItems) {
    return allItems.filter(item => !this.progress.processed.includes(item.id));
  }
}

/**
 * Send RFP data with retry logic
 */
async function sendRFPWithRetry(rfpData, maxRetries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`http://localhost:3005/api/mines/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Retrospective-Data': 'true',
          'X-Batch-Processing': 'true'
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
            batch_processing: true,
            original_rfp_id: rfpData.id
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          attempt,
          rfp_id: rfpData.id,
          entity_name: rfpData.entity_name,
          estimated_value: rfpData.estimated_value,
          yellow_panther_fit: rfpData.yellow_panther_fit,
          processing_time: result.processing_time || 'N/A'
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      if (attempt === maxRetries) {
        return {
          success: false,
          attempt,
          rfp_id: rfpData.id,
          entity_name: rfpData.entity_name,
          error: error.message
        };
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Process batch with detailed tracking
 */
async function processBatch(batch, batchNumber, tracker) {
  colorLog('yellow', `\n🔄 Processing Batch ${batchNumber} (${batch.length} items)`);
  colorLog('cyan', 'Started: ' + new Date().toLocaleTimeString());
  console.log('─'.repeat(60));
  
  const results = [];
  
  for (let i = 0; i < batch.length; i++) {
    const rfp = batch[i];
    
    // Skip if already processed
    if (tracker.getProcessedItems().includes(rfp.id)) {
      colorLog('blue', `⏭️  Skipping ${rfp.entity_name} (already processed)`);
      continue;
    }
    
    colorLog('cyan', `📋 [${i + 1}/${batch.length}] Processing: ${rfp.entity_name}`);
    colorLog('gray', `    📊 Value: ${rfp.estimated_value} | Fit: ${rfp.yellow_panther_fit}%`);
    
    const startTime = Date.now();
    const result = await sendRFPWithRetry(rfp);
    const processingTime = Date.now() - startTime;
    
    if (result.success) {
      colorLog('green', `   ✅ Success (${processingTime}ms) - Attempt ${result.attempt}`);
      tracker.markProcessed(rfp.id);
    } else {
      colorLog('red', `   ❌ Failed - Attempt ${result.attempt}: ${result.error}`);
      tracker.markFailed(rfp.id, result.error);
    }
    
    results.push(result);
    
    // Small delay between items
    if (i < batch.length - 1) {
      await new Promise(resolve => setTimeout(resolve, CONFIG.itemDelay));
    }
  }
  
  tracker.updateBatch(batchNumber);
  
  return results;
}

/**
 * Generate comprehensive report
 */
function generateDetailedReport(allResults, scenarios) {
  const successful = allResults.filter(r => r.success);
  const failed = allResults.filter(r => !r.success);
  
  // Calculate statistics
  const totalValue = successful.reduce((sum, r) => {
    const value = parseFloat(r.estimated_value.replace(/[^0-9.]/g, ''));
    return sum + (isNaN(value) ? 0 : value);
  }, 0);
  
  const avgFitScore = successful.length > 0 
    ? successful.reduce((sum, r) => sum + r.yellow_panther_fit, 0) / successful.length 
    : 0;
  
  const avgProcessingTime = successful.filter(r => r.processing_time !== 'N/A').length > 0
    ? successful.filter(r => r.processing_time !== 'N/A').reduce((sum, r) => sum + parseInt(r.processing_time), 0) / successful.filter(r => r.processing_time !== 'N/A').length
    : 0;
  
  // Entity analysis
  const entityStats = {};
  successful.forEach(r => {
    if (!entityStats[r.entity_name]) {
      entityStats[r.entity_name] = { count: 0, totalValue: 0, avgFit: 0 };
    }
    entityStats[r.entity_name].count++;
    entityStats[r.entity_name].totalValue += parseFloat(r.estimated_value.replace(/[^0-9.]/g, ''));
  });
  
  // Calculate average fit per entity
  Object.keys(entityStats).forEach(entity => {
    const entityResults = successful.filter(r => r.entity_name === entity);
    entityStats[entity].avgFit = entityResults.reduce((sum, r) => sum + r.yellow_panther_fit, 0) / entityResults.length;
  });
  
  const report = {
    execution_summary: {
      total_scenarios: scenarios.length,
      total_processed: allResults.length,
      successful: successful.length,
      failed: failed.length,
      success_rate: `${((successful.length / allResults.length) * 100).toFixed(1)}%`,
      processing_time_ms: Date.now() - new Date(allResults[0]?.timestamp || Date.now()).getTime()
    },
    value_analysis: {
      total_estimated_value: `£${totalValue.toFixed(1)}M`,
      average_value_per_opportunity: `£${(totalValue / successful.length).toFixed(2)}M`,
      average_fit_score: `${avgFitScore.toFixed(1)}%`,
      average_processing_time: `${Math.round(avgProcessingTime)}ms`
    },
    opportunity_breakdown: {
      by_type: {},
      by_entity: entityStats,
      by_value_range: {
        'high_value_5M_plus': successful.filter(r => parseFloat(r.estimated_value.replace(/[^0-9.]/g, '')) >= 5).length,
        'medium_value_2M_5M': successful.filter(r => {
          const val = parseFloat(r.estimated_value.replace(/[^0-9.]/g, ''));
          return val >= 2 && val < 5;
        }).length,
        'low_value_under_2M': successful.filter(r => parseFloat(r.estimated_value.replace(/[^0-9.]/g, '')) < 2).length
      }
    },
    top_opportunities: successful
      .sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)
      .slice(0, 10),
    failed_opportunities: failed,
    performance_metrics: {
      avg_processing_time_per_item: `${Math.round(avgProcessingTime)}ms`,
      total_processing_time: `${Math.round(allResults.reduce((sum, r) => sum + (r.processing_time || 0), 0))}ms`,
      items_per_minute: Math.round((successful.length / (avgProcessingTime / 1000)) * 60)
    },
    generated_at: new Date().toISOString()
  };
  
  // Add opportunity type breakdown
  successful.forEach(r => {
    const scenario = scenarios.find(s => s.id === r.rfp_id);
    if (scenario) {
      report.opportunity_breakdown.by_type[scenario.opportunity_type] = 
        (report.opportunity_breakdown.by_type[scenario.opportunity_type] || 0) + 1;
    }
  });
  
  return report;
}

/**
 * Main execution
 */
async function main() {
  colorLog('cyan', '🎯 BATCH HISTORICAL RFP PROCESSOR');
  colorLog('cyan', '='.repeat(50));
  
  const BASE_URL = 'http://localhost:3005';
  
  // Check system status
  try {
    const response = await fetch(`${BASE_URL}/api/rfp-monitoring?action=status`);
    const data = await response.json();
    if (!data.success) {
      throw new Error('System not responding');
    }
    colorLog('green', '✅ System ready');
  } catch (error) {
    colorLog('red', '❌ System not ready. Please start the RFP Intelligence system first.');
    process.exit(1);
  }
  
  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }
  
  // Initialize progress tracker
  const tracker = new ProgressTracker(CONFIG.progressFile);
  tracker.setStartTime();
  
  // Get unprocessed items
  const unprocessedItems = tracker.getUnprocessedItems(EXTENDED_HISTORICAL_SCENARIOS);
  
  colorLog('blue', `\n📊 Processing Statistics:`);
  colorLog('cyan', `   Total scenarios: ${EXTENDED_HISTORICAL_SCENARIOS.length}`);
  colorLog('cyan', `   Already processed: ${tracker.getProcessedItems().length}`);
  colorLog('cyan', `   Remaining: ${unprocessedItems.length}`);
  colorLog('cyan', `   Batch size: ${CONFIG.batchSize}`);
  
  if (unprocessedItems.length === 0) {
    colorLog('green', '\n🎉 All items already processed!');
    return;
  }
  
  const allResults = [];
  const totalBatches = Math.ceil(unprocessedItems.length / CONFIG.batchSize);
  
  // Process batches
  for (let i = 0; i < totalBatches; i++) {
    const start = i * CONFIG.batchSize;
    const end = Math.min(start + CONFIG.batchSize, unprocessedItems.length);
    const batch = unprocessedItems.slice(start, end);
    
    const batchResults = await processBatch(batch, i + 1, tracker);
    allResults.push(...batchResults);
    
    // Delay between batches
    if (i < totalBatches - 1) {
      colorLog('yellow', `⏳ Waiting ${CONFIG.batchDelay/1000}s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.batchDelay));
    }
  }
  
  // Generate and save reports
  console.log('\n📈 Generating comprehensive analysis report...');
  const report = generateDetailedReport(allResults, EXTENDED_HISTORICAL_SCENARIOS);
  
  const reportPath = path.join(CONFIG.outputDir, 'batch-processing-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Display final results
  console.log('\n' + '='.repeat(60));
  colorLog('cyan', '🎊 BATCH PROCESSING COMPLETE');
  colorLog('cyan', '='.repeat(60));
  
  console.log('\n📊 SUMMARY:');
  colorLog('green', `   ✅ Processed: ${report.execution_summary.successful}/${report.execution_summary.total_processed}`);
  colorLog('green', `   💰 Total Value: ${report.value_analysis.total_estimated_value}`);
  colorLog('green', `   📈 Success Rate: ${report.execution_summary.success_rate}`);
  colorLog('green', `   🎯 Avg Fit Score: ${report.value_analysis.average_fit_score}`);
  colorLog('green', `   ⚡ Avg Processing: ${report.value_analysis.average_processing_time}`);
  
  console.log('\n🏆 TOP OPPORTUNITIES:');
  report.top_opportunities.slice(0, 5).forEach((opp, i) => {
    colorLog('yellow', `   ${i + 1}. ${opp.entity_name} - ${opp.estimated_value} (${opp.yellow_panther_fit}% fit)`);
  });
  
  console.log('\n📁 Files Created:');
  colorLog('cyan', `   ${CONFIG.progressFile}`);
  colorLog('cyan', `   ${reportPath}`);
  
  console.log('\n🌐 View Results:');
  colorLog('yellow', `   Professional Layout: ${BASE_URL}/professional-tenders`);
  colorLog('yellow', `   RFP Intelligence: ${BASE_URL}/rfp-intelligence`);
}

// Execute
main().catch(error => {
  colorLog('red', `💥 Batch processor failed: ${error.message}`);
  process.exit(1);
});