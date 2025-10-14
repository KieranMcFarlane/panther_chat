#!/usr/bin/env node

/**
 * 🚀 Enhanced Historical Batch Processing Script
 * 
 * Integrates the existing batch processor with Claude Agent SDK for
 * AI-powered analysis of historical RFP and entity data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  batchSize: 10,           // Smaller batches for AI analysis
  maxConcurrent: 3,        // Max concurrent AI analyses
  batchDelay: 5000,        // 5 seconds between AI batches
  itemDelay: 1000,         // 1 second between items
  useClaudeAgent: true,    // Enable Claude Agent integration
  storeResults: true,      // Store results in Neo4j
  outputDir: './enhanced-historical-results',
  apiBaseUrl: 'http://localhost:3005'
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * 📊 Load entities from existing batch cache
 */
function loadHistoricalEntities() {
  const cacheDir = '.cache/historical-batches';
  const entities = [];

  try {
    if (!fs.existsSync(cacheDir)) {
      colorLog('red', `❌ Cache directory not found: ${cacheDir}`);
      return [];
    }

    // Read batch files
    const batchFiles = fs.readdirSync(cacheDir)
      .filter(file => file.startsWith('batch-') && file.endsWith('.json'))
      .sort();

    colorLog('blue', `📁 Found ${batchFiles.length} batch files`);

    for (const batchFile of batchFiles) {
      const batchPath = path.join(cacheDir, batchFile);
      const batchData = JSON.parse(fs.readFileSync(batchPath, 'utf8'));

      if (batchData.entities && Array.isArray(batchData.entities)) {
        batchData.entities.forEach(entity => {
          entities.push({
            id: entity.id || entity.name?.replace(/\s+/g, '-').toLowerCase(),
            name: entity.name,
            type: entity.type || 'sports-club',
            industry: entity.industry || 'Sports',
            data: entity,
            lastUpdated: entity.lastUpdated || new Date().toISOString()
          });
        });
      }
    }

    colorLog('green', `✅ Loaded ${entities.length} entities from cache`);
    return entities;

  } catch (error) {
    colorLog('red', `❌ Failed to load entities: ${error.message}`);
    return [];
  }
}

/**
 * 🚀 Start enhanced batch processing with Claude Agent
 */
async function startEnhancedBatchProcessing(entities) {
  if (entities.length === 0) {
    colorLog('yellow', '⚠️ No entities to process');
    return;
  }

  colorLog('cyan', '🚀 Starting Enhanced Historical Batch Processing');
  colorLog('cyan', '='.repeat(60));
  colorLog('blue', `📊 Processing ${entities.length} entities with Claude Agent`);
  colorLog('blue', `🤖 AI Configuration: Batch size ${CONFIG.batchSize}, Max concurrent ${CONFIG.maxConcurrent}`);
  
  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const startTime = Date.now();
  const batchId = `enhanced_${Date.now()}`;

  try {
    // Start the enhanced batch processing
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/historical-batch-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entities,
        options: {
          batchSize: CONFIG.batchSize,
          maxConcurrent: CONFIG.maxConcurrent,
          useClaudeAgent: CONFIG.useClaudeAgent,
          storeResults: CONFIG.storeResults,
          mcpTools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp', 'better-auth']
        },
        metadata: {
          source: 'enhanced_historical_processor',
          batchId,
          timestamp: new Date().toISOString()
        }
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    
    if (result.success) {
      colorLog('green', `✅ Enhanced batch processing started: ${result.batchId}`);
      colorLog('yellow', `⏱️ Estimated duration: ${result.estimatedDuration}s`);
      
      // Monitor progress
      await monitorProgress(result.batchId, startTime);
      
    } else {
      throw new Error(result.error || 'Failed to start processing');
    }

  } catch (error) {
    colorLog('red', `❌ Failed to start enhanced batch processing: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 📊 Monitor processing progress
 */
async function monitorProgress(batchId, startTime) {
  colorLog('cyan', '\n📊 Monitoring Enhanced Processing Progress:');
  console.log('─'.repeat(60));

  let lastStatus = {};
  let monitoring = true;

  while (monitoring) {
    try {
      const response = await fetch(`${CONFIG.apiBaseUrl}/api/historical-batch-processor?action=status`);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }

      const statusData = await response.json();
      const currentStatus = statusData.data;

      if (currentStatus.batchId === batchId) {
        // Display progress
        const progress = currentStatus.progress;
        const results = currentStatus.results;
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Clear previous progress line and show updated status
        process.stdout.write('\r' + ' '.repeat(80) + '\r');
        
        colorLog('cyan', `🔄 Progress: ${progress.processed}/${progress.total} (${progress.percentage}%) - ${elapsed}s elapsed`);
        
        if (results.insights > 0 || results.opportunities > 0) {
          colorLog('blue', `   📈 Insights: ${results.insights} | Opportunities: ${results.opportunities} | Value: ${results.estimatedValue}`);
        }

        // Check if processing is complete
        if (currentStatus.status === 'completed') {
          colorLog('green', `\n🎉 Enhanced Processing Complete!`);
          
          const totalTime = Math.floor((Date.now() - startTime) / 1000);
          
          console.log('\n' + '='.repeat(60));
          colorLog('cyan', '📊 ENHANCED PROCESSING RESULTS');
          console.log('='.repeat(60));
          
          console.log('\n🎯 Summary:');
          colorLog('green', `   ✅ Entities Processed: ${progress.total}`);
          colorLog('green', `   🧠 AI Insights Generated: ${results.insights}`);
          colorLog('green', `   💰 Opportunities Identified: ${results.opportunities}`);
          colorLog('green', `   ⚠️ Risks Assessed: ${results.risks}`);
          colorLog('green', `   💎 Estimated Value: ${results.estimatedValue}`);
          colorLog('green', `   🎯 Average Confidence: ${results.averageConfidence}%`);
          colorLog('green', `   ⏱️ Total Processing Time: ${totalTime}s`);
          
          // Save final results
          await saveFinalResults(batchId, currentStatus, totalTime);
          
          monitoring = false;
          
        } else if (currentStatus.status === 'error') {
          colorLog('red', `\n❌ Processing failed: ${currentStatus.error || 'Unknown error'}`);
          monitoring = false;
        }
      }

      // Wait before next status check
      if (monitoring) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      colorLog('yellow', `⚠️ Status check failed: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * 💾 Save final results
 */
async function saveFinalResults(batchId, status, totalTime) {
  try {
    const results = {
      batchId,
      summary: {
        totalEntities: status.progress.total,
        processedEntities: status.progress.processed,
        insights: status.results.insights,
        opportunities: status.results.opportunities,
        risks: status.results.risks,
        estimatedValue: status.results.estimatedValue,
        averageConfidence: status.results.averageConfidence,
        processingTime: totalTime,
        completedAt: new Date().toISOString()
      },
      configuration: CONFIG,
      enhanced: {
        claudeAgentUsed: true,
        mcpTools: ['neo4j-mcp', 'brightdata-mcp', 'perplexity-mcp', 'better-auth'],
        aiAnalysis: true,
        knowledgeGraphIntegration: true
      }
    };

    const resultsPath = path.join(CONFIG.outputDir, `${batchId}_results.json`);
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));

    // Also save a simple summary for quick reference
    const summaryPath = path.join(CONFIG.outputDir, 'latest_summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(results.summary, null, 2));

    colorLog('green', `\n📁 Results saved:`);
    colorLog('cyan', `   ${resultsPath}`);
    colorLog('cyan', `   ${summaryPath}`);

  } catch (error) {
    colorLog('red', `❌ Failed to save results: ${error.message}`);
  }
}

/**
 * 🔧 Check system readiness
 */
async function checkSystemReadiness() {
  try {
    const response = await fetch(`${CONFIG.apiBaseUrl}/api/historical-batch-processor?action=claude-status`);
    
    if (!response.ok) {
      throw new Error(`System readiness check failed: ${response.status}`);
    }

    const status = await response.json();
    
    if (status.success) {
      colorLog('green', '✅ Enhanced Historical Processor ready');
      colorLog('blue', `   Claude Agent: ${status.data.claudeAgent}`);
      colorLog('blue', `   MCP Tools: ${status.data.mcpTools.join(', ')}`);
      return true;
    } else {
      throw new Error('System not ready');
    }

  } catch (error) {
    colorLog('red', `❌ System not ready: ${error.message}`);
    colorLog('yellow', 'Please ensure the Signal Noise app is running on port 3005');
    return false;
  }
}

/**
 * 🎯 Main execution
 */
async function main() {
  colorLog('cyan', '🤖 Enhanced Historical Batch Processor with Claude Agent');
  colorLog('cyan', '='.repeat(60));
  colorLog('blue', 'Integrating AI-powered analysis with historical entity data');
  
  // Check system readiness
  const ready = await checkSystemReadiness();
  if (!ready) {
    process.exit(1);
  }

  // Load historical entities
  const entities = loadHistoricalEntities();
  
  if (entities.length === 0) {
    colorLog('yellow', 'No historical entities found. Please run the historical batch processor first.');
    process.exit(0);
  }

  // Start enhanced processing
  await startEnhancedBatchProcessing(entities);
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    colorLog('red', `💥 Enhanced processor failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { main, loadHistoricalEntities, startEnhancedBatchProcessing };