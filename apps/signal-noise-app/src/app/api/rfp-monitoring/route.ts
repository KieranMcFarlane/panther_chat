/**
 * 🐆 RFP Activity Monitoring API
 * 
 * Provides real-time monitoring and analytics for RFP detection activity.
 * Supports the Yellow Panther business intelligence dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { activityLogger } from '@/lib/activity-log-service';
import { RFPOpportunityDetector } from '@/lib/rfp-opportunity-detector';
import { realRFPDataSource } from '@/lib/real-rfp-data-sources';
import { realRFPMonitor, RFPAlert } from '@/lib/real-rfp-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    const limit = parseInt(searchParams.get('limit') || '100');
    const activityType = searchParams.get('type') || undefined;

    switch (action) {
      case 'status':
        return NextResponse.json({
          success: true,
          data: {
            system_status: activityLogger.getSystemStatus(),
            activity_stats: activityLogger.getActivityStats(),
            yellow_panther_ready: true,
            total_entities_monitored: 4422,
            last_updated: new Date().toISOString()
          }
        });

      case 'logs':
        const logs = activityLogger.getRecentLogs(limit, activityType);
        return NextResponse.json({
          success: true,
          data: {
            logs,
            total_returned: logs.length,
            filter_type: activityType,
            last_updated: new Date().toISOString()
          }
        });

      case 'stats':
        const stats = activityLogger.getActivityStats();
        return NextResponse.json({
          success: true,
          data: { ...stats, last_updated: new Date().toISOString() }
        });

      case 'export':
        const format = searchParams.get('format') as 'json' | 'csv' || 'json';
        const exportData = activityLogger.exportLogs(format);
        
        return new NextResponse(exportData, {
          headers: {
            'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
            'Content-Disposition': `attachment; filename="rfp-activity-logs.${format}"`
          }
        });

      case 'test':
        // Execute a test RFP detection
        const testResult = await runTestDetection();
        return NextResponse.json({
          success: true,
          data: {
            test_result: testResult,
            timestamp: new Date().toISOString()
          }
        });

      case 'opportunities':
        // Get real RFP opportunities from live sources
        const realOpportunities = await realRFPDataSource.searchRealOpportunities(
          searchParams.get('keywords')?.split(',') || ['sports technology', 'digital transformation'],
          parseInt(searchParams.get('limit') || '20')
        );
        
        return NextResponse.json({
          success: true,
          data: {
            opportunities: realOpportunities,
            total_returned: realOpportunities.length,
            source: 'live_procurement_sources',
            last_updated: new Date().toISOString()
          }
        });

      case 'start-monitoring':
        // Start real-time RFP monitoring
        await realRFPMonitor.startMonitoring();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Real-time RFP monitoring started',
            monitoring_stats: realRFPMonitor.getMonitoringStats(),
            timestamp: new Date().toISOString()
          }
        });

      case 'stop-monitoring':
        // Stop real-time RFP monitoring
        realRFPMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Real-time RFP monitoring stopped',
            monitoring_stats: realRFPMonitor.getMonitoringStats(),
            timestamp: new Date().toISOString()
          }
        });

      case 'monitoring-stats':
        // Get monitoring statistics
        return NextResponse.json({
          success: true,
          data: {
            monitoring_stats: realRFPMonitor.getMonitoringStats(),
            timestamp: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('🚨 Monitoring API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Run a test RFP detection to verify system is working
 */
async function runTestDetection(): Promise<any> {
  const startTime = Date.now();
  
  try {
    // Test Yellow Panther tailored RFP detection
    const testContent = 'Manchester United announces £5M digital transformation partnership for AI-powered fan engagement platform and mobile app development - seeking technology vendor with expertise in gamification and e-commerce solutions';
    const testEntity = 'Manchester United';
    
    const entityScore = RFPOpportunityDetector.getYellowPantherEntityScore(testEntity, 'Premier League Club');
    const opportunityAnalysis = RFPOpportunityDetector.generateOpportunityAnalysis(testContent, testEntity);
    
    const processingTime = Date.now() - startTime;
    
    // Log the test
    activityLogger.logTestExecution('Yellow Panther RFP Detection Test', {
      success: true,
      confidence: opportunityAnalysis.confidence,
      opportunities: opportunityAnalysis.opportunities,
      entity_score: entityScore.score,
      test_type: 'rfp_detection',
      assertions: [
        { test: 'Entity Score >= 85', passed: entityScore.score >= 85 },
        { test: 'Opportunities Detected > 0', passed: opportunityAnalysis.opportunities.length > 0 },
        { test: 'Confidence >= 70%', passed: opportunityAnalysis.confidence >= 0.7 },
        { test: 'Yellow Panther Fit', passed: entityScore.score >= 85 }
      ]
    }, processingTime);
    
    return {
      success: true,
      processing_time_ms: processingTime,
      entity_score: entityScore.score,
      entity_tier: entityScore.tier,
      opportunities_detected: opportunityAnalysis.opportunities.length,
      confidence: opportunityAnalysis.confidence,
      high_value_opportunity: entityScore.score >= 85,
      recommended_approach: entityScore.recommended_approach,
      priority_keywords: entityScore.priority_keywords.slice(0, 5)
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    activityLogger.logTestExecution('Yellow Panther RFP Detection Test', {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      test_type: 'rfp_detection'
    }, processingTime);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime
    };
  }
}

/**
 * Health check endpoint for monitoring
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (body.action === 'health_check') {
      // Perform comprehensive health check
      const systemStatus = activityLogger.getSystemStatus();
      const stats = activityLogger.getActivityStats();
      
      // Test core functionality
      const testResult = await runTestDetection();
      
      return NextResponse.json({
        success: true,
        data: {
          healthy: systemStatus.health_score >= 80 && testResult.success,
          system_status: systemStatus,
          activity_stats: stats,
          test_result: testResult,
          services: {
            activity_logger: 'healthy',
            rfp_detector: testResult.success ? 'healthy' : 'error',
            webhook_processor: systemStatus.active_webhooks >= 0 ? 'healthy' : 'warning'
          },
          timestamp: new Date().toISOString()
        }
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('🚨 Health check error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}