#!/usr/bin/env node

/**
 * 🚀 Complete RFP Capture & Storage System
 * 
 * Orchestrates the entire RFP detection and storage workflow:
 * 1. RFP capture and parsing
 * 2. Supabase storage
 * 3. Neo4j integration
 * 4. System reporting
 * 
 * Uses internal MCP tools for web research and database operations
 */

const { runRFPCapture } = require('./rfp-capture-system');
const { processRFPCaptureResults } = require('./rfp-supabase-integration');
const { processRFPsForNeo4j } = require('./rfp-neo4j-integration');

/**
 * Display system banner
 */
function displayBanner() {
  console.log('');
  console.log('🎯 COMPLETE RFP CAPTURE & STORAGE SYSTEM');
  console.log('==========================================');
  console.log('📊 Target: 10 High-Value Sports Entities');
  console.log('🔍 Tools: BrightData MCP, Neo4j MCP, Supabase');
  console.log('📄 Output: RFPs stored in Supabase + Neo4j relationships');
  console.log('');
}

/**
 * Display entity selection
 */
function displayEntitySelection() {
  const { TARGET_ENTITIES } = require('./rfp-capture-system');
  
  console.log('🎯 TARGET ENTITIES FOR RFP MONITORING');
  console.log('=====================================');
  
  TARGET_ENTITIES.forEach((entity, index) => {
    const priority = index < 3 ? '🔴 HIGH' : index < 7 ? '🟡 MEDIUM' : '🟢 STANDARD';
    console.log(`${(index + 1).toString().padStart(2)}. ${entity.name.padEnd(35)} ${entity.type.padEnd(12)} ${entity.sport.padEnd(20)} ${priority}`);
  });
  
  console.log('');
  console.log(`📋 Total Entities: ${TARGET_ENTITIES.length}`);
  console.log(`🔴 High Priority: 3 (Premier clubs, major federations)`);
  console.log(`🟡 Medium Priority: 4 (Established organizations)`);
  console.log(`🟢 Standard Priority: 3 (Growing entities)`);
  console.log('');
}

/**
 * Run complete RFP system
 */
async function runCompleteRFPSystem() {
  const startTime = Date.now();
  displayBanner();
  displayEntitySelection();
  
  console.log('🚀 Starting complete RFP capture and storage workflow...\n');
  
  const systemStats = {
    capture_phase: { success: false, duration: 0, errors: [] },
    storage_phase: { success: false, duration: 0, errors: [] },
    neo4j_phase: { success: false, duration: 0, errors: [] },
    total_duration: 0,
    overall_success: false
  };
  
  try {
    // Phase 1: RFP Capture and Parsing
    console.log('📡 PHASE 1: RFP CAPTURE & PARSING');
    console.log('==================================');
    const captureStartTime = Date.now();
    
    const captureResults = await runRFPCapture();
    systemStats.capture_phase = {
      success: true,
      duration: Date.now() - captureStartTime,
      entities_processed: captureResults.total_entities_processed,
      rfps_found: captureResults.total_rfps_found,
      high_value_rfps: captureResults.high_value_rfps,
      errors: []
    };
    
    console.log(`✅ Phase 1 completed in ${(systemStats.capture_phase.duration / 1000).toFixed(2)}s`);
    console.log(`   Entities: ${captureResults.total_entities_processed}/10`);
    console.log(`   RFPs Found: ${captureResults.total_rfps_found}`);
    console.log(`   High-Value: ${captureResults.high_value_rfps}\n`);
    
    // Phase 2: Supabase Storage
    console.log('💾 PHASE 2: SUPABASE STORAGE');
    console.log('=============================');
    const storageStartTime = Date.now();
    
    const storageResults = await processRFPCaptureResults(captureResults);
    systemStats.storage_phase = {
      success: true,
      duration: Date.now() - storageStartTime,
      rfps_processed: storageResults.total_rfps_processed,
      high_value_stored: storageResults.high_value_rfps,
      links_verified: storageResults.links_verified,
      errors: storageResults.errors
    };
    
    console.log(`✅ Phase 2 completed in ${(systemStats.storage_phase.duration / 1000).toFixed(2)}s`);
    console.log(`   RFPs Processed: ${storageResults.total_rfps_processed}`);
    console.log(`   High-Value Stored: ${storageResults.high_value_rfps}`);
    console.log(`   Links Verified: ${storageResults.links_verified}`);
    console.log(`   Errors: ${storageResults.errors.length}\n`);
    
    // Phase 3: Neo4j Integration
    console.log('🕸️  PHASE 3: NEO4J INTEGRATION');
    console.log('===============================');
    const neo4jStartTime = Date.now();
    
    const neo4jResults = await processRFPsForNeo4j(captureResults);
    systemStats.neo4j_phase = {
      success: true,
      duration: Date.now() - neo4jStartTime,
      rfp_nodes_created: neo4jResults.rfp_nodes_created,
      relationships_created: neo4jResults.entity_relationships_created,
      competitive_relationships: neo4jResults.competitive_relationships_created,
      entities_updated: neo4jResults.entities_updated,
      errors: neo4jResults.errors
    };
    
    console.log(`✅ Phase 3 completed in ${(systemStats.neo4j_phase.duration / 1000).toFixed(2)}s`);
    console.log(`   RFP Nodes Created: ${neo4jResults.rfp_nodes_created}`);
    console.log(`   Entity Relationships: ${neo4jResults.entity_relationships_created}`);
    console.log(`   Competitive Relationships: ${neo4jResults.competitive_relationships_created}`);
    console.log(`   Entities Updated: ${neo4jResults.entities_updated}`);
    console.log(`   Errors: ${neo4jResults.errors.length}\n`);
    
    // Overall success
    systemStats.total_duration = Date.now() - startTime;
    systemStats.overall_success = true;
    
    // Generate final report
    const finalReport = generateFinalReport(captureResults, storageResults, neo4jResults, systemStats);
    
    // Display final summary
    displayFinalSummary(finalReport);
    
    // Save final report
    const reportPath = require('path').join(__dirname, 'rfp-system-final-report.json');
    require('fs').writeFileSync(reportPath, JSON.stringify(finalReport, null, 2));
    console.log(`📁 Final report saved to: ${reportPath}`);
    
    console.log('\n🎉 COMPLETE RFP SYSTEM EXECUTION SUCCESSFUL!');
    console.log('==================================================');
    
    return finalReport;
    
  } catch (error) {
    systemStats.total_duration = Date.now() - startTime;
    systemStats.overall_success = false;
    
    console.error('\n❌ COMPLETE RFP SYSTEM FAILED:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Generate error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      system_stats: systemStats,
      phase_completed: determineFailedPhase(systemStats)
    };
    
    const errorReportPath = require('path').join(__dirname, 'rfp-system-error-report.json');
    require('fs').writeFileSync(errorReportPath, JSON.stringify(errorReport, null, 2));
    console.log(`📁 Error report saved to: ${errorReportPath}`);
    
    throw error;
  }
}

/**
 * Generate comprehensive final report
 */
function generateFinalReport(captureResults, storageResults, neo4jResults, systemStats) {
  const report = {
    timestamp: new Date().toISOString(),
    execution_summary: {
      total_duration_seconds: systemStats.total_duration / 1000,
      overall_success: systemStats.overall_success,
      phases_completed: determineCompletedPhases(systemStats)
    },
    phase_results: {
      capture: systemStats.capture_phase,
      storage: systemStats.storage_phase,
      neo4j: systemStats.neo4j_phase
    },
    key_metrics: {
      entities_monitored: captureResults.total_entities_processed,
      rfps_discovered: captureResults.total_rfps_found,
      high_value_opportunities: captureResults.high_value_rfps,
      rfps_stored: storageResults.total_rfps_processed,
      links_verified: storageResults.links_verified,
      neo4j_nodes_created: neo4jResults.rfp_nodes_created,
      neo4j_relationships_created: neo4jResults.entity_relationships_created,
      entities_with_intelligence: neo4jResults.entities_updated
    },
    entity_breakdown: captureResults.entity_results.map(entity => ({
      name: entity.entity_name,
      type: entity.entity_type,
      sport: entity.sport,
      rfp_count: entity.rfp_count,
      high_value_count: entity.high_value_count,
      top_opportunity: entity.opportunities.length > 0 ? {
        title: entity.opportunities.sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)[0].title,
        fit_score: entity.opportunities.sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)[0].yellow_panther_fit,
        confidence: entity.opportunities.sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)[0].confidence,
        category: entity.opportunities.sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)[0].category
      } : null
    })),
    top_opportunities: getTopOpportunities(captureResults),
    system_health: {
      errors_total: systemStats.capture_phase.errors.length + 
                   systemStats.storage_phase.errors.length + 
                   systemStats.neo4j_phase.errors.length,
      success_rate: calculateSuccessRate(systemStats),
      performance_rating: calculatePerformanceRating(systemStats)
    },
    data_quality: {
      average_confidence: calculateAverageConfidence(captureResults),
      average_fit_score: calculateAverageFitScore(captureResults),
      link_verification_rate: storageResults.links_verified / storageResults.total_rfps_processed,
      completeness_score: calculateCompletenessScore(captureResults)
    },
    business_impact: {
      estimated_pipeline_value: calculatePipelineValue(captureResults),
      competitive_advantages: identifyCompetitiveAdvantages(captureResults),
      immediate_actions: generateImmediateActions(captureResults),
      strategic_insights: generateStrategicInsights(captureResults)
    },
    recommendations: generateSystemRecommendations(captureResults, systemStats)
  };
  
  return report;
}

/**
 * Helper functions for report generation
 */
function determineFailedPhase(systemStats) {
  if (!systemStats.capture_phase.success) return 'capture_phase';
  if (!systemStats.storage_phase.success) return 'storage_phase';
  if (!systemStats.neo4j_phase.success) return 'neo4j_phase';
  return 'completed';
}

function determineCompletedPhases(systemStats) {
  const phases = [];
  if (systemStats.capture_phase.success) phases.push('capture');
  if (systemStats.storage_phase.success) phases.push('storage');
  if (systemStats.neo4j_phase.success) phases.push('neo4j');
  return phases;
}

function getTopOpportunities(captureResults) {
  const allOpportunities = [];
  captureResults.entity_results.forEach(entity => {
    entity.opportunities.forEach(rfp => {
      allOpportunities.push(rfp);
    });
  });
  
  return allOpportunities
    .sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)
    .slice(0, 10)
    .map(rfp => ({
      title: rfp.title,
      organization: rfp.organization,
      fit_score: rfp.yellow_panther_fit,
      confidence: rfp.confidence,
      category: rfp.category,
      value: rfp.value,
      urgency: rfp.urgency
    }));
}

function calculateSuccessRate(systemStats) {
  const phases = Object.keys(systemStats).filter(key => key.includes('_phase'));
  const successfulPhases = phases.filter(phase => systemStats[phase].success).length;
  return (successfulPhases / phases.length) * 100;
}

function calculatePerformanceRating(systemStats) {
  const successRate = calculateSuccessRate(systemStats);
  if (successRate === 100) return 'excellent';
  if (successRate >= 80) return 'good';
  if (successRate >= 60) return 'fair';
  return 'poor';
}

function calculateAverageConfidence(captureResults) {
  const allOpportunities = [];
  captureResults.entity_results.forEach(entity => {
    allOpportunities.push(...entity.opportunities);
  });
  
  if (allOpportunities.length === 0) return 0;
  const totalConfidence = allOpportunities.reduce((sum, rfp) => sum + rfp.confidence, 0);
  return Math.round(totalConfidence / allOpportunities.length);
}

function calculateAverageFitScore(captureResults) {
  const allOpportunities = [];
  captureResults.entity_results.forEach(entity => {
    allOpportunities.push(...entity.opportunities);
  });
  
  if (allOpportunities.length === 0) return 0;
  const totalFit = allOpportunities.reduce((sum, rfp) => sum + rfp.yellow_panther_fit, 0);
  return Math.round(totalFit / allOpportunities.length);
}

function calculateCompletenessScore(captureResults) {
  const allOpportunities = [];
  captureResults.entity_results.forEach(entity => {
    allOpportunities.push(...entity.opportunities);
  });
  
  if (allOpportunities.length === 0) return 0;
  
  const completeRFPs = allOpportunities.filter(rfp => 
    rfp.title && rfp.description && rfp.organization && rfp.category
  ).length;
  
  return Math.round((completeRFPs / allOpportunities.length) * 100);
}

function calculatePipelineValue(captureResults) {
  const allOpportunities = [];
  captureResults.entity_results.forEach(entity => {
    allOpportunities.push(...entity.opportunities);
  });
  
  // Estimate value based on Yellow Panther fit scores
  const totalFit = allOpportunities.reduce((sum, rfp) => sum + rfp.yellow_panther_fit, 0);
  const avgFit = totalFit / allOpportunities.length || 0;
  
  // Estimated value ranges based on fit scores
  if (avgFit >= 90) return '$5M-$10M';
  if (avgFit >= 80) return '$2M-$5M';
  if (avgFit >= 70) return '$1M-$2M';
  if (avgFit >= 60) return '$500K-$1M';
  return '$100K-$500K';
}

function identifyCompetitiveAdvantages(captureResults) {
  const advantages = [];
  
  const highValueCount = captureResults.high_value_rfps;
  if (highValueCount > 0) {
    advantages.push(`${highValueCount} high-fit opportunities identified`);
  }
  
  const uniqueCategories = [...new Set(
    captureResults.entity_results.flatMap(entity => 
      entity.opportunities.map(rfp => rfp.category)
    )
  )];
  if (uniqueCategories.length > 0) {
    advantages.push(`Diverse opportunities across ${uniqueCategories.length} categories`);
  }
  
  advantages.push('Automated competitive analysis for all opportunities');
  advantages.push('Market intelligence integration');
  
  return advantages;
}

function generateImmediateActions(captureResults) {
  const actions = [];
  
  const highValueOpportunities = captureResults.entity_results
    .flatMap(entity => entity.opportunities)
    .filter(rfp => rfp.yellow_panther_fit >= 80)
    .sort((a, b) => b.yellow_panther_fit - a.yellow_panther_fit)
    .slice(0, 3);
  
  highValueOpportunities.forEach((rfp, index) => {
    actions.push({
      priority: index === 0 ? 'critical' : 'high',
      action: `Contact ${rfp.organization} about ${rfp.category}`,
      deadline: 'Within 48 hours',
      estimated_value: rfp.value || 'High value'
    });
  });
  
  return actions;
}

function generateStrategicInsights(captureResults) {
  const insights = [];
  
  // Entity performance insights
  const topEntities = captureResults.entity_results
    .filter(entity => entity.rfp_count > 0)
    .sort((a, b) => b.high_value_count - a.high_value_count)
    .slice(0, 3);
  
  if (topEntities.length > 0) {
    insights.push(`Top RFP-generating entities: ${topEntities.map(e => e.entity_name).join(', ')}`);
  }
  
  // Category insights
  const categoryCounts = {};
  captureResults.entity_results.forEach(entity => {
    entity.opportunities.forEach(rfp => {
      categoryCounts[rfp.category] = (categoryCounts[rfp.category] || 0) + 1;
    });
  });
  
  const topCategory = Object.entries(categoryCounts)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topCategory) {
    insights.push(`Most common opportunity type: ${topCategory[0]} (${topCategory[1]} occurrences)`);
  }
  
  return insights;
}

function generateSystemRecommendations(captureResults, systemStats) {
  const recommendations = [];
  
  // System performance recommendations
  if (systemStats.total_duration > 60000) { // > 1 minute
    recommendations.push({
      priority: 'medium',
      action: 'Optimize processing performance',
      reason: `Processing took ${(systemStats.total_duration / 1000).toFixed(2)}s`
    });
  }
  
  // Data quality recommendations
  const avgConfidence = calculateAverageConfidence(captureResults);
  if (avgConfidence < 80) {
    recommendations.push({
      priority: 'high',
      action: 'Improve RFP detection accuracy',
      reason: `Average confidence score is ${avgConfidence}%`
    });
  }
  
  // Business intelligence recommendations
  if (captureResults.total_rfps_found > 0) {
    recommendations.push({
      priority: 'critical',
      action: 'Set up automated RFP monitoring alerts',
      reason: `${captureResults.total_rfps_found} opportunities found - need real-time tracking`
    });
  }
  
  // Scaling recommendations
  if (captureResults.entities_with_rfps > 5) {
    recommendations.push({
      priority: 'medium',
      action: 'Expand monitoring to additional entities',
      reason: `High success rate with ${captureResults.entities_with_rfps}/10 entities yielding RFPs`
    });
  }
  
  return recommendations;
}

/**
 * Display final summary
 */
function displayFinalSummary(report) {
  console.log('📊 FINAL SYSTEM EXECUTION SUMMARY');
  console.log('===============================');
  
  console.log(`⏱️  Total Duration: ${(report.execution_summary.total_duration_seconds).toFixed(2)}s`);
  console.log(`✅ Overall Success: ${report.execution_summary.overall_success ? 'YES' : 'NO'}`);
  console.log(`📊 Success Rate: ${report.system_health.success_rate}%`);
  console.log(`🏆 Performance Rating: ${report.system_health.performance_rating.toUpperCase()}`);
  
  console.log('\n📈 KEY RESULTS');
  console.log('===============');
  console.log(`Entities Monitored: ${report.key_metrics.entities_monitored}/10`);
  console.log(`RFPs Discovered: ${report.key_metrics.rfps_discovered}`);
  console.log(`High-Value Opportunities: ${report.key_metrics.high_value_opportunities}`);
  console.log(`RFPs Stored in Supabase: ${report.key_metrics.rfps_stored}`);
  console.log(`Neo4j Nodes Created: ${report.key_metrics.neo4j_nodes_created}`);
  console.log(`Neo4j Relationships: ${report.key_metrics.neo4j_relationships_created}`);
  
  if (report.top_opportunities.length > 0) {
    console.log('\n🎯 TOP 3 OPPORTUNITIES');
    console.log('=======================');
    report.top_opportunities.slice(0, 3).forEach((opp, index) => {
      console.log(`${index + 1}. ${opp.title} (${opp.organization})`);
      console.log(`   Fit Score: ${opp.fit_score}% | Confidence: ${opp.confidence}%`);
      console.log(`   Category: ${opp.category} | Urgency: ${opp.urgency}`);
      if (opp.value) console.log(`   Value: ${opp.value}`);
      console.log('');
    });
  }
  
  if (report.business_impact.immediate_actions.length > 0) {
    console.log('🚨 IMMEDIATE ACTIONS REQUIRED');
    console.log('===========================');
    report.business_impact.immediate_actions.forEach((action, index) => {
      const priority = action.priority === 'critical' ? '🔴' : action.priority === 'high' ? '🟡' : '🟢';
      console.log(`${priority} ${index + 1}. ${action.action}`);
      console.log(`   Deadline: ${action.deadline} | Priority: ${action.priority.toUpperCase()}`);
      console.log('');
    });
  }
  
  console.log('💡 STRATEGIC INSIGHTS');
  console.log('====================');
  report.business_impact.strategic_insights.forEach(insight => {
    console.log(`• ${insight}`);
  });
  
  console.log(`\n💰 Estimated Pipeline Value: ${report.business_impact.estimated_pipeline_value}`);
  console.log(`🏆 Data Quality Score: ${report.data_quality.completeness_score}%`);
  console.log(`🔗 Link Verification Rate: ${(report.data_quality.link_verification_rate * 100).toFixed(1)}%`);
}

// Execute if run directly
if (require.main === module) {
  runCompleteRFPSystem()
    .then(report => {
      console.log('\n🎉 System execution completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ System execution failed:', error);
      process.exit(1);
    });
}

module.exports = {
  runCompleteRFPSystem,
  generateFinalReport,
  displayFinalSummary
};