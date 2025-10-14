/**
 * 🚀 RFP Real Data Scanner API
 * 
 * Triggers real RFP scanning to populate database with live opportunities
 */

import { NextRequest, NextResponse } from 'next/server';
import { realRFPMonitor } from '@/lib/real-rfp-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    switch (action) {
      case 'status':
        // Get current monitoring status
        const stats = realRFPMonitor.getMonitoringStats();
        return NextResponse.json({
          success: true,
          data: {
            monitoring: stats,
            message: stats.is_monitoring ? 'RFP monitoring is active' : 'RFP monitoring is inactive',
            timestamp: new Date().toISOString()
          }
        });

      case 'start':
        // Start real-time RFP monitoring
        await realRFPMonitor.startMonitoring();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Real-time RFP monitoring started',
            monitoring_started: true,
            timestamp: new Date().toISOString()
          }
        });

      case 'stop':
        // Stop real-time RFP monitoring
        realRFPMonitor.stopMonitoring();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Real-time RFP monitoring stopped',
            monitoring_stopped: true,
            timestamp: new Date().toISOString()
          }
        });

      case 'scan':
        // Trigger one-time RFP scan
        console.log('🔍 Triggering one-time RFP scan...');
        
        // Set up event listeners for this scan
        const scanResults: any[] = [];
        const scanPromise = new Promise((resolve) => {
          const timeout = setTimeout(() => {
            realRFPMonitor.removeAllListeners();
            resolve({
              results: scanResults,
              timeout: true
            });
          }, 60000); // 60 second timeout

          realRFPMonitor.once('scan_completed', (data) => {
            clearTimeout(timeout);
            realRFPMonitor.removeAllListeners();
            resolve({
              results: scanResults,
              completed: true,
              ...data
            });
          });

          realRFPMonitor.on('rfp_detected', (alert) => {
            console.log(`🎯 RFP detected during scan: ${alert.title}`);
            scanResults.push({
              type: 'rfp_detected',
              alert: {
                id: alert.id,
                title: alert.title,
                organization: alert.organization,
                yellow_panther_fit: alert.yellow_panther_fit,
                confidence: alert.confidence,
                urgency: alert.urgency
              },
              timestamp: new Date().toISOString()
            });
          });
        });

        // Trigger the scan
        await realRFPMonitor.performRFPScan();
        const scanResult: any = await scanPromise;

        return NextResponse.json({
          success: true,
          data: {
            scan_completed: true,
            results: scanResult.results || [],
            summary: {
              total_rfps_found: scanResult.results?.length || 0,
              high_value_rfps: scanResult.results?.filter((r: any) => r.alert.yellow_panther_fit >= 80).length || 0,
              scan_duration: scanResult.timeout ? '60+ seconds (timeout)' : 'Completed',
              timestamp: new Date().toISOString()
            }
          }
        });

      case 'reset':
        // Reset processed opportunities cache
        realRFPMonitor.resetProcessedOpportunities();
        return NextResponse.json({
          success: true,
          data: {
            message: 'Processed opportunities cache reset',
            cache_cleared: true,
            timestamp: new Date().toISOString()
          }
        });

      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid action',
          available_actions: [
            'status - Get monitoring status',
            'start - Start real-time monitoring',
            'stop - Stop real-time monitoring', 
            'scan - Trigger one-time scan',
            'reset - Reset processed opportunities cache'
          ]
        }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ RFP Scanner API error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    if (action === 'scan_with_keywords') {
      // Perform scan with specific keywords
      const { keywords = ['sports technology', 'digital transformation', 'fan engagement'], limit = 50 } = params;
      
      console.log(`🔍 Scanning with keywords: ${keywords.join(', ')}`);
      
      // Import the realRFPDataSource dynamically
      const { realRFPDataSource } = await import('@/lib/real-rfp-data-sources');
      
      const opportunities = await realRFPDataSource.searchRealOpportunities(keywords, limit);
      
      return NextResponse.json({
        success: true,
        data: {
          scan_completed: true,
          keywords_used: keywords,
          opportunities_found: opportunities.length,
          opportunities: opportunities.slice(0, 10).map(opp => ({
            id: opp.id,
            title: opp.title,
            organization: opp.organization,
            category: opp.category,
            value: opp.value,
            source: opp.source,
            source_url: opp.source_url
          })),
          timestamp: new Date().toISOString()
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid POST action',
      available_actions: [
        'scan_with_keywords - Scan with specific keywords'
      ]
    }, { status: 400 });

  } catch (error) {
    console.error('❌ RFP Scanner POST error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}